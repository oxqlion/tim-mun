"""Route/load optimizer using Google OR-Tools Pickup & Delivery solver.

Solves a Pickup and Delivery Problem with Capacity Constraints (PDPTW):
- Each request has TWO nodes: pickup (warehouse) + delivery (destination)
- Constraint: pickup before delivery, same vehicle
- Vehicles: available trucks with weight capacity
- Objective: minimize total travel distance

Uses OSRM (OpenStreetMap Routing Machine) for real road distances.
Falls back to haversine when OSRM is unavailable.

Contract: generate_routes(db, company_id, date_iso) -> list[route_id]
"""

import math
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.request import urlopen, Request
from urllib.error import URLError
import json

from google.cloud.firestore import Client
from ortools.constraint_solver import pywrapcp, routing_enums_pb2

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

EARTH_RADIUS_KM = 6371.0
AVG_SPEED_KMH = 40.0
LOADING_TIME_MINUTES = 30
START_HOUR = 8
OSRM_BASE_URL = "http://router.project-osrm.org"
OSRM_TIMEOUT_SECONDS = 10


# ---------------------------------------------------------------------------
# Geo utilities
# ---------------------------------------------------------------------------


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in km between two coordinates using haversine formula."""
    lat1, lng1, lat2, lng2 = map(math.radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def _build_distance_matrix(locations: list[tuple[float, float]]) -> list[list[int]]:
    """Build a distance matrix (integer meters) from (lat, lng) tuples.

    Tries OSRM Table API for real road distances first.
    Falls back to haversine if OSRM is unavailable or errors.
    """
    matrix = _build_distance_matrix_osrm(locations)
    if matrix is not None:
        return matrix

    logger.warning("OSRM unavailable, falling back to haversine distances")
    return _build_distance_matrix_haversine(locations)


def _build_distance_matrix_osrm(locations: list[tuple[float, float]]) -> Optional[list[list[int]]]:
    """Fetch real road distance matrix from OSRM Table API.

    OSRM expects coordinates as lng,lat (not lat,lng).
    Returns NxN matrix in meters, or None on failure.
    """
    if not locations:
        return None

    # OSRM format: lng,lat;lng,lat;...
    coords_str = ";".join(f"{lng},{lat}" for lat, lng in locations)
    url = f"{OSRM_BASE_URL}/table/v1/driving/{coords_str}?annotations=distance"

    try:
        req = Request(url, headers={"User-Agent": "agri-logistics-poc/1.0"})
        with urlopen(req, timeout=OSRM_TIMEOUT_SECONDS) as response:
            data = json.loads(response.read().decode())

        if data.get("code") != "Ok":
            logger.warning("OSRM returned non-OK code: %s", data.get("code"))
            return None

        # OSRM returns distances in meters (floats), convert to int
        raw_matrix = data["distances"]
        n = len(locations)
        matrix = [[0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                matrix[i][j] = int(raw_matrix[i][j])

        return matrix

    except (URLError, TimeoutError, json.JSONDecodeError, KeyError) as e:
        logger.warning("OSRM request failed: %s", e)
        return None


def _build_distance_matrix_haversine(locations: list[tuple[float, float]]) -> list[list[int]]:
    """Build distance matrix using haversine (straight-line) as fallback."""
    n = len(locations)
    matrix = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            dist_m = int(
                _haversine(locations[i][0], locations[i][1], locations[j][0], locations[j][1]) * 1000
            )
            matrix[i][j] = dist_m
            matrix[j][i] = dist_m
    return matrix


# ---------------------------------------------------------------------------
# Weight calculation
# ---------------------------------------------------------------------------


def _weight_for_request(db: Client, request_id: str) -> float:
    """Calculate total weight for a pickup request from its items."""
    items = db.collection("request_items").where("pickup_request_id", "==", request_id).stream()
    total = 0.0
    for doc in items:
        item = doc.to_dict()
        if item.get("estimated_weight_kg") is not None:
            total += item["estimated_weight_kg"]
        elif item.get("unit_type") == "kg":
            total += item.get("quantity", 0)
    return total


# ---------------------------------------------------------------------------
# OR-Tools Pickup & Delivery solver
# ---------------------------------------------------------------------------


def _solve_pdp(
    distance_matrix: list[list[int]],
    pickups_deliveries: list[tuple[int, int]],
    demands: list[int],
    vehicle_capacities: list[int],
    num_vehicles: int,
) -> Optional[list[list[int]]]:
    """Solve Pickup & Delivery Problem with capacity constraints.

    Args:
        distance_matrix: NxN integer distance matrix (meters).
        pickups_deliveries: List of (pickup_node, delivery_node) pairs.
        demands: Demand at each node. Pickup nodes have positive demand,
                 delivery nodes have negative demand, depot is 0.
        vehicle_capacities: Max capacity per vehicle.
        num_vehicles: Number of available vehicles.

    Returns:
        List of node-index routes per vehicle (excluding depot), or None.
    """
    n = len(distance_matrix)
    manager = pywrapcp.RoutingIndexManager(n, num_vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)

    # Distance callback
    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # Distance dimension (needed for pickup-delivery ordering constraint)
    routing.AddDimension(
        transit_callback_index,
        0,  # no slack
        3_000_000,  # max distance per vehicle (3000 km in meters)
        True,
        "Distance",
    )
    distance_dimension = routing.GetDimensionOrDie("Distance")

    # Capacity constraint
    def demand_callback(from_index):
        from_node = manager.IndexToNode(from_index)
        return demands[from_node]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,
        vehicle_capacities,
        True,
        "Capacity",
    )

    # Pickup and delivery constraints
    for pickup_node, delivery_node in pickups_deliveries:
        pickup_index = manager.NodeToIndex(pickup_node)
        delivery_index = manager.NodeToIndex(delivery_node)

        # Same vehicle
        routing.AddPickupAndDelivery(pickup_index, delivery_index)
        routing.solver().Add(
            routing.VehicleVar(pickup_index) == routing.VehicleVar(delivery_index)
        )
        # Pickup before delivery
        routing.solver().Add(
            distance_dimension.CumulVar(pickup_index)
            <= distance_dimension.CumulVar(delivery_index)
        )

    # Search parameters
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
    )
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_params.time_limit.seconds = 10

    solution = routing.SolveWithParameters(search_params)
    if not solution:
        return None

    routes: list[list[int]] = []
    for vehicle_id in range(num_vehicles):
        route: list[int] = []
        index = routing.Start(vehicle_id)
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node != 0:
                route.append(node)
            index = solution.Value(routing.NextVar(index))
        routes.append(route)

    return routes


# ---------------------------------------------------------------------------
# ETA calculation
# ---------------------------------------------------------------------------


def _get_duration_matrix_osrm(locations: list[tuple[float, float]]) -> Optional[list[list[float]]]:
    """Fetch travel duration matrix from OSRM Table API.

    Returns NxN matrix in seconds, or None on failure.
    """
    if not locations:
        return None

    coords_str = ";".join(f"{lng},{lat}" for lat, lng in locations)
    url = f"{OSRM_BASE_URL}/table/v1/driving/{coords_str}?annotations=duration"

    try:
        req = Request(url, headers={"User-Agent": "agri-logistics-poc/1.0"})
        with urlopen(req, timeout=OSRM_TIMEOUT_SECONDS) as response:
            data = json.loads(response.read().decode())

        if data.get("code") != "Ok":
            return None

        return data["durations"]

    except (URLError, TimeoutError, json.JSONDecodeError, KeyError) as e:
        logger.warning("OSRM duration request failed: %s", e)
        return None


def _calculate_eta_for_route(
    route_nodes: list[int],
    locations: list[tuple[float, float]],
    node_info: dict[int, dict],
    date_iso: str,
    duration_matrix: Optional[list[list[float]]] = None,
) -> dict[str, datetime]:
    """Calculate ETA at dropoff node for each request in a route.

    Uses OSRM duration matrix if available, otherwise haversine / avg speed.
    """
    year, month, day = map(int, date_iso.split("-"))
    departure = datetime(year, month, day, START_HOUR, 0, 0, tzinfo=timezone.utc)

    eta_map: dict[str, datetime] = {}
    current_time = departure
    prev_node_idx = 0  # start at depot

    for node_idx in route_nodes:
        # Travel time to this node
        if duration_matrix is not None:
            travel_seconds = duration_matrix[prev_node_idx][node_idx]
            current_time += timedelta(seconds=travel_seconds)
        else:
            node_location = locations[node_idx]
            prev_location = locations[prev_node_idx]
            travel_km = _haversine(
                prev_location[0], prev_location[1],
                node_location[0], node_location[1],
            )
            travel_hours = travel_km / AVG_SPEED_KMH
            current_time += timedelta(hours=travel_hours)

        info = node_info.get(node_idx, {})

        # Add loading time at pickup stops
        if info.get("type") == "pickup":
            current_time += timedelta(minutes=LOADING_TIME_MINUTES)

        # Record ETA at dropoff stops
        if info.get("type") == "dropoff":
            doc_id = info.get("doc_id")
            if doc_id:
                eta_map[doc_id] = current_time

        prev_node_idx = node_idx

    return eta_map


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def generate_routes(db: Client, company_id: str, date_iso: str) -> list[str]:
    """Generate optimized routes using Pickup & Delivery Problem solver.

    Each pickup request becomes two nodes:
    - Pickup node at the warehouse location
    - Delivery node at the destination location

    OR-Tools ensures pickup happens before delivery on the same truck,
    and groups requests with same-direction destinations together.
    """
    # Gather pending requests
    pending_docs = list(
        db.collection("pickup_requests")
        .where("pickup_date", "==", date_iso)
        .where("status", "==", "pending")
        .stream()
    )
    if not pending_docs:
        return []

    # Gather available trucks
    trucks = list(
        db.collection("trucks")
        .where("logistics_company_id", "==", company_id)
        .where("status", "==", "available")
        .stream()
    )
    if not trucks:
        return []

    # Resolve locations for each request
    request_data = []
    for doc in pending_docs:
        data = doc.to_dict()
        warehouse_doc = db.collection("warehouses").document(data["warehouse_id"]).get()
        wh = warehouse_doc.to_dict() if warehouse_doc.exists else {}
        weight = _weight_for_request(db, doc.id)
        request_data.append({
            "doc_id": doc.id,
            "data": data,
            "weight": weight,
            "pickup_lat": wh.get("lat"),
            "pickup_lng": wh.get("lng"),
            "delivery_lat": data.get("destination_lat"),
            "delivery_lng": data.get("destination_lng"),
        })

    # Split: need BOTH pickup and delivery coords for PDP
    geo_requests = [
        r for r in request_data
        if r["pickup_lat"] is not None
        and r["pickup_lng"] is not None
        and r["delivery_lat"] is not None
        and r["delivery_lng"] is not None
    ]
    no_geo_requests = [r for r in request_data if r not in geo_requests]

    created_route_ids: list[str] = []

    # --- OR-Tools Pickup & Delivery for geo-enabled requests ---
    if geo_requests:
        # Build locations list:
        # Index 0: depot (centroid of all pickup locations)
        # Index 1, 2: pickup_node, delivery_node for request 0
        # Index 3, 4: pickup_node, delivery_node for request 1
        # ...
        avg_lat = sum(r["pickup_lat"] for r in geo_requests) / len(geo_requests)
        avg_lng = sum(r["pickup_lng"] for r in geo_requests) / len(geo_requests)

        locations: list[tuple[float, float]] = [(avg_lat, avg_lng)]  # depot
        demands: list[int] = [0]  # depot demand
        pickups_deliveries: list[tuple[int, int]] = []
        node_info: dict[int, dict] = {}  # node_idx -> {type, doc_id, request_idx}

        for i, req in enumerate(geo_requests):
            pickup_idx = len(locations)
            locations.append((req["pickup_lat"], req["pickup_lng"]))
            demands.append(int(req["weight"]))  # positive = load at pickup
            node_info[pickup_idx] = {"type": "pickup", "doc_id": req["doc_id"], "request_idx": i}

            delivery_idx = len(locations)
            locations.append((req["delivery_lat"], req["delivery_lng"]))
            demands.append(-int(req["weight"]))  # negative = unload at delivery
            node_info[delivery_idx] = {"type": "dropoff", "doc_id": req["doc_id"], "request_idx": i}

            pickups_deliveries.append((pickup_idx, delivery_idx))

        distance_matrix = _build_distance_matrix(locations)

        vehicle_capacities = [int(t.to_dict()["capacity_weight_kg"]) for t in trucks]
        num_vehicles = len(trucks)

        solution = _solve_pdp(
            distance_matrix, pickups_deliveries, demands, vehicle_capacities, num_vehicles
        )

        if solution:
            # Fetch OSRM duration matrix for ETA calculation
            duration_matrix = _get_duration_matrix_osrm(locations)

            for vehicle_idx, route_nodes in enumerate(solution):
                if not route_nodes:
                    continue

                truck_doc = trucks[vehicle_idx]

                # Calculate ETA for deliveries in this route
                eta_map = _calculate_eta_for_route(
                    route_nodes, locations, node_info, date_iso, duration_matrix
                )

                # Create route document
                route_ref = db.collection("routes").document()
                route_ref.set({
                    "truck_id": truck_doc.id,
                    "route_date": date_iso,
                    "status": "planned",
                    "total_distance_km": None,
                    "generated_at": datetime.now(timezone.utc),
                })
                created_route_ids.append(route_ref.id)
                db.collection("trucks").document(truck_doc.id).update({"status": "on_trip"})

                # Create route stops in sequence
                seq = 1
                for node_idx in route_nodes:
                    info = node_info.get(node_idx)
                    if not info:
                        continue

                    req = geo_requests[info["request_idx"]]
                    stop_type = info["type"]  # "pickup" or "dropoff"
                    stop_location = locations[node_idx]

                    db.collection("route_stops").document().set({
                        "route_id": route_ref.id,
                        "pickup_request_id": req["doc_id"],
                        "stop_sequence": seq,
                        "stop_type": stop_type,
                        "lat": stop_location[0],
                        "lng": stop_location[1],
                        "eta": eta_map.get(req["doc_id"]) if stop_type == "dropoff" else None,
                        "allocated_weight_kg": req["weight"],
                        "allocated_volume_m3": None,
                        "status": "pending",
                    })
                    seq += 1

                # Update pickup request statuses + ETA
                seen_requests = set()
                for node_idx in route_nodes:
                    info = node_info.get(node_idx)
                    if not info or info["doc_id"] in seen_requests:
                        continue
                    seen_requests.add(info["doc_id"])

                    req = geo_requests[info["request_idx"]]
                    update_data: dict = {"status": "matched"}
                    if req["doc_id"] in eta_map:
                        update_data["estimated_arrival"] = eta_map[req["doc_id"]]
                    db.collection("pickup_requests").document(req["doc_id"]).update(update_data)
        else:
            # Solver couldn't find solution — fall back to naive
            no_geo_requests.extend(geo_requests)

    # --- Naive first-fit fallback for requests without full coordinates ---
    if no_geo_requests:
        used_truck_ids = set()
        for rid in created_route_ids:
            route_doc = db.collection("routes").document(rid).get()
            if route_doc.exists:
                used_truck_ids.add(route_doc.to_dict()["truck_id"])

        remaining_trucks = [
            {
                "id": t.id,
                "remaining_weight_kg": t.to_dict()["capacity_weight_kg"],
                "route_id": None,
                "next_sequence": 1,
            }
            for t in trucks
            if t.id not in used_truck_ids
        ]

        no_geo_requests.sort(key=lambda r: r["data"].get("destination_name", ""))

        for req in no_geo_requests:
            truck = next(
                (t for t in remaining_trucks if t["remaining_weight_kg"] >= req["weight"]),
                None,
            )
            if truck is None:
                continue

            if truck["route_id"] is None:
                route_ref = db.collection("routes").document()
                route_ref.set({
                    "truck_id": truck["id"],
                    "route_date": date_iso,
                    "status": "planned",
                    "total_distance_km": None,
                    "generated_at": datetime.now(timezone.utc),
                })
                truck["route_id"] = route_ref.id
                created_route_ids.append(route_ref.id)
                db.collection("trucks").document(truck["id"]).update({"status": "on_trip"})

            db.collection("route_stops").document().set({
                "route_id": truck["route_id"],
                "pickup_request_id": req["doc_id"],
                "stop_sequence": truck["next_sequence"],
                "stop_type": "pickup",
                "eta": None,
                "allocated_weight_kg": req["weight"],
                "allocated_volume_m3": None,
                "status": "pending",
            })
            truck["next_sequence"] += 1
            truck["remaining_weight_kg"] -= req["weight"]

            db.collection("pickup_requests").document(req["doc_id"]).update({"status": "matched"})

    return created_route_ids
