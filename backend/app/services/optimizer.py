"""Route/load optimizer using Google OR-Tools Pickup & Delivery solver.

Solves a Pickup and Delivery Problem with Capacity Constraints (PDPTW):
- Each request has TWO nodes: pickup (warehouse) + delivery (destination)
- Constraint: pickup before delivery, same vehicle
- Vehicles: available trucks with weight capacity
- Objective: minimize total travel distance

Uses OSRM (OpenStreetMap Routing Machine) for real road distances.
Falls back to haversine when OSRM is unavailable.

Integrates with space_optimizer for loading arrangement per truck.

Contract: generate_transportation_plan(db, company_id, date_iso) -> plan_id
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

from app.services.fleet_allocator import allocate_fleet
from app.services.space_optimizer import (
    ItemForPacking,
    SpaceResult,
    TruckDimensions,
    optimize_space,
)

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
FUEL_CONSUMPTION_L_PER_KM = 0.15  # avg truck fuel consumption


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
    """Build distance matrix. Tries OSRM first, falls back to haversine."""
    matrix = _build_distance_matrix_osrm(locations)
    if matrix is not None:
        return matrix
    logger.warning("OSRM unavailable, falling back to haversine distances")
    return _build_distance_matrix_haversine(locations)


def _build_distance_matrix_osrm(locations: list[tuple[float, float]]) -> Optional[list[list[int]]]:
    """Fetch real road distance matrix from OSRM Table API."""
    if not locations:
        return None

    coords_str = ";".join(f"{lng},{lat}" for lat, lng in locations)
    url = f"{OSRM_BASE_URL}/table/v1/driving/{coords_str}?annotations=distance"

    try:
        req = Request(url, headers={"User-Agent": "agri-logistics-poc/1.0"})
        with urlopen(req, timeout=OSRM_TIMEOUT_SECONDS) as response:
            data = json.loads(response.read().decode())

        if data.get("code") != "Ok":
            return None

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
# OSRM duration
# ---------------------------------------------------------------------------


def _get_duration_matrix_osrm(locations: list[tuple[float, float]]) -> Optional[list[list[float]]]:
    """Fetch travel duration matrix from OSRM Table API."""
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


# ---------------------------------------------------------------------------
# ETA calculation
# ---------------------------------------------------------------------------


def _calculate_eta_for_route(
    route_nodes: list[int],
    locations: list[tuple[float, float]],
    node_info: dict[int, dict],
    date_iso: str,
    duration_matrix: Optional[list[list[float]]] = None,
) -> dict[str, datetime]:
    """Calculate ETA at dropoff node for each request in a route."""
    year, month, day = map(int, date_iso.split("-"))
    departure = datetime(year, month, day, START_HOUR, 0, 0, tzinfo=timezone.utc)

    eta_map: dict[str, datetime] = {}
    current_time = departure
    prev_node_idx = 0

    for node_idx in route_nodes:
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
            current_time += timedelta(hours=travel_km / AVG_SPEED_KMH)

        info = node_info.get(node_idx, {})
        if info.get("type") == "pickup":
            current_time += timedelta(minutes=LOADING_TIME_MINUTES)
        if info.get("type") == "dropoff":
            doc_id = info.get("doc_id")
            if doc_id:
                eta_map[doc_id] = current_time

        prev_node_idx = node_idx

    return eta_map


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
    """Solve Pickup & Delivery Problem with capacity constraints."""
    n = len(distance_matrix)
    manager = pywrapcp.RoutingIndexManager(n, num_vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        return distance_matrix[manager.IndexToNode(from_index)][manager.IndexToNode(to_index)]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    routing.AddDimension(transit_callback_index, 0, 3_000_000, True, "Distance")
    distance_dimension = routing.GetDimensionOrDie("Distance")

    def demand_callback(from_index):
        return demands[manager.IndexToNode(from_index)]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(demand_callback_index, 0, vehicle_capacities, True, "Capacity")

    for pickup_node, delivery_node in pickups_deliveries:
        pickup_index = manager.NodeToIndex(pickup_node)
        delivery_index = manager.NodeToIndex(delivery_node)
        routing.AddPickupAndDelivery(pickup_index, delivery_index)
        routing.solver().Add(routing.VehicleVar(pickup_index) == routing.VehicleVar(delivery_index))
        routing.solver().Add(
            distance_dimension.CumulVar(pickup_index) <= distance_dimension.CumulVar(delivery_index)
        )

    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
    search_params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
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
# Space optimization per route
# ---------------------------------------------------------------------------


def _run_space_optimization(
    db: Client, truck_id: str, request_ids: list[str]
) -> SpaceResult:
    """Run space optimization for items assigned to a truck."""
    truck_doc = db.collection("trucks").document(truck_id).get()
    td = truck_doc.to_dict()

    truck = TruckDimensions(
        id=truck_id,
        capacity_weight_kg=td["capacity_weight_kg"],
        capacity_volume_m3=td.get("capacity_volume_m3"),
        length_cm=td.get("length_cm"),
        width_cm=td.get("width_cm"),
        height_cm=td.get("height_cm"),
    )

    items: list[ItemForPacking] = []
    for req_id in request_ids:
        item_docs = db.collection("request_items").where("pickup_request_id", "==", req_id).stream()
        for item_doc in item_docs:
            item_data = item_doc.to_dict()
            weight = item_data.get("estimated_weight_kg") or (
                item_data.get("quantity", 0) if item_data.get("unit_type") == "kg" else 0
            )
            items.append(ItemForPacking(
                id=item_doc.id,
                pickup_request_id=req_id,
                commodity_name=item_data.get("commodity_name", ""),
                quantity=item_data.get("quantity", 1),
                weight_kg=weight,
                length_cm=item_data.get("length_cm") or 50,  # defaults for items without dims
                width_cm=item_data.get("width_cm") or 50,
                height_cm=item_data.get("height_cm") or 50,
                stackable=item_data.get("stackable", False),
                fragile=item_data.get("fragile", False),
            ))

    return optimize_space(items, truck)


# ---------------------------------------------------------------------------
# Main entry point — Transportation Plan generation
# ---------------------------------------------------------------------------


def generate_transportation_plan(db: Client, company_id: str, date_iso: str) -> str:
    """Generate a full transportation plan: fleet allocation + route + space optimization.

    Returns the transportation_plan document ID.
    """
    # Create plan document
    plan_ref = db.collection("transportation_plans").document()
    plan_ref.set({
        "logistics_company_id": company_id,
        "plan_date": date_iso,
        "status": "draft",
        "total_requests": 0,
        "total_trucks_used": 0,
        "total_distance_km": None,
        "estimated_fuel_liters": None,
        "fuel_savings_percent": None,
        "created_at": datetime.now(timezone.utc),
        "approved_at": None,
    })

    # Step 1: Fleet allocation
    allocation = allocate_fleet(db, company_id, date_iso)
    if not allocation:
        plan_ref.update({"status": "optimized", "total_requests": 0, "total_trucks_used": 0})
        return plan_ref.id

    # Gather all request data for route optimization
    all_request_ids = []
    for reqs in allocation.values():
        for r in reqs:
            all_request_ids.append(r["doc_id"])

    # Resolve warehouse locations
    request_data = []
    for truck_id, reqs in allocation.items():
        for r in reqs:
            data = r["data"]
            warehouse_doc = db.collection("warehouses").document(data["warehouse_id"]).get()
            wh = warehouse_doc.to_dict() if warehouse_doc.exists else {}
            request_data.append({
                "doc_id": r["doc_id"],
                "truck_id": truck_id,
                "data": data,
                "weight": r["weight"],
                "pickup_lat": wh.get("lat"),
                "pickup_lng": wh.get("lng"),
                "delivery_lat": data.get("destination_lat"),
                "delivery_lng": data.get("destination_lng"),
            })

    # Step 2: Route optimization per truck
    total_distance_km = 0.0
    created_route_ids: list[str] = []

    for truck_id, reqs in allocation.items():
        truck_requests = [r for r in request_data if r["truck_id"] == truck_id]

        # Check if we have geo data for PDP
        geo_requests = [
            r for r in truck_requests
            if r["pickup_lat"] and r["pickup_lng"] and r["delivery_lat"] and r["delivery_lng"]
        ]

        # Get request IDs for this truck
        truck_request_ids = [r["doc_id"] for r in truck_requests]

        # Step 2b: Space optimization
        space_result = _run_space_optimization(db, truck_id, truck_request_ids)

        # Create route
        route_ref = db.collection("routes").document()
        route_ref.set({
            "transportation_plan_id": plan_ref.id,
            "truck_id": truck_id,
            "route_date": date_iso,
            "status": "planned",
            "total_distance_km": None,
            "space_utilization_percent": space_result.space_utilization_percent,
            "weight_utilization_percent": space_result.weight_utilization_percent,
            "generated_at": datetime.now(timezone.utc),
        })
        created_route_ids.append(route_ref.id)

        # Save space allocations
        for loaded in space_result.loaded_items:
            db.collection("space_allocations").document().set({
                "route_id": route_ref.id,
                "pickup_request_id": loaded.pickup_request_id,
                "item_id": loaded.item_id,
                "commodity_name": loaded.commodity_name,
                "loading_sequence": loaded.loading_sequence,
                "position_notes": loaded.position_notes,
                "weight_kg": loaded.weight_kg,
                "volume_m3": loaded.volume_m3,
            })

        # Route optimization with OR-Tools if geo data available
        if geo_requests and len(geo_requests) > 0:
            avg_lat = sum(r["pickup_lat"] for r in geo_requests) / len(geo_requests)
            avg_lng = sum(r["pickup_lng"] for r in geo_requests) / len(geo_requests)

            locations: list[tuple[float, float]] = [(avg_lat, avg_lng)]
            demands: list[int] = [0]
            pickups_deliveries: list[tuple[int, int]] = []
            node_info: dict[int, dict] = {}

            for i, req in enumerate(geo_requests):
                pickup_idx = len(locations)
                locations.append((req["pickup_lat"], req["pickup_lng"]))
                demands.append(int(req["weight"]))
                node_info[pickup_idx] = {"type": "pickup", "doc_id": req["doc_id"], "request_idx": i}

                delivery_idx = len(locations)
                locations.append((req["delivery_lat"], req["delivery_lng"]))
                demands.append(-int(req["weight"]))
                node_info[delivery_idx] = {"type": "dropoff", "doc_id": req["doc_id"], "request_idx": i}

                pickups_deliveries.append((pickup_idx, delivery_idx))

            distance_matrix = _build_distance_matrix(locations)
            vehicle_capacities = [int(space_result.truck_weight_capacity_kg)]

            solution = _solve_pdp(distance_matrix, pickups_deliveries, demands, vehicle_capacities, 1)

            if solution and solution[0]:
                route_nodes = solution[0]
                duration_matrix = _get_duration_matrix_osrm(locations)
                eta_map = _calculate_eta_for_route(route_nodes, locations, node_info, date_iso, duration_matrix)

                # Calculate route distance
                route_distance_m = 0
                prev = 0
                for node in route_nodes:
                    route_distance_m += distance_matrix[prev][node]
                    prev = node
                route_distance_km = route_distance_m / 1000
                total_distance_km += route_distance_km

                route_ref.update({"total_distance_km": round(route_distance_km, 2)})

                # Create stops
                seq = 1
                for node_idx in route_nodes:
                    info = node_info.get(node_idx)
                    if not info:
                        continue
                    req = geo_requests[info["request_idx"]]
                    stop_location = locations[node_idx]

                    db.collection("route_stops").document().set({
                        "route_id": route_ref.id,
                        "pickup_request_id": req["doc_id"],
                        "stop_sequence": seq,
                        "stop_type": info["type"],
                        "lat": stop_location[0],
                        "lng": stop_location[1],
                        "eta": eta_map.get(req["doc_id"]) if info["type"] == "dropoff" else None,
                        "allocated_weight_kg": req["weight"],
                        "allocated_volume_m3": None,
                        "status": "pending",
                    })
                    seq += 1

                # Update request statuses + ETA
                seen = set()
                for node_idx in route_nodes:
                    info = node_info.get(node_idx)
                    if not info or info["doc_id"] in seen:
                        continue
                    seen.add(info["doc_id"])
                    update_data: dict = {"status": "optimized"}
                    if info["doc_id"] in eta_map:
                        update_data["estimated_arrival"] = eta_map[info["doc_id"]]
                    db.collection("pickup_requests").document(info["doc_id"]).update(update_data)
            else:
                # Fallback: create simple stops without optimization
                _create_fallback_stops(db, route_ref.id, truck_requests)
        else:
            # No geo data: create basic stops
            _create_fallback_stops(db, route_ref.id, truck_requests)

        # Update truck status
        db.collection("trucks").document(truck_id).update({"status": "on_trip"})

    # Calculate fuel metrics
    estimated_fuel = total_distance_km * FUEL_CONSUMPTION_L_PER_KM
    # Naive direct distance (all requests going individually)
    naive_distance = _calculate_naive_distance(request_data)
    fuel_savings = ((naive_distance - total_distance_km) / naive_distance * 100) if naive_distance > 0 else 0

    # Update plan
    plan_ref.update({
        "status": "optimized",
        "total_requests": len(all_request_ids),
        "total_trucks_used": len(allocation),
        "total_distance_km": round(total_distance_km, 2) if total_distance_km > 0 else None,
        "estimated_fuel_liters": round(estimated_fuel, 2) if estimated_fuel > 0 else None,
        "fuel_savings_percent": round(max(0, fuel_savings), 1) if naive_distance > 0 else None,
    })

    return plan_ref.id


def _create_fallback_stops(db: Client, route_id: str, requests: list[dict]) -> None:
    """Create simple sequential stops without route optimization."""
    seq = 1
    for req in requests:
        # Pickup stop
        db.collection("route_stops").document().set({
            "route_id": route_id,
            "pickup_request_id": req["doc_id"],
            "stop_sequence": seq,
            "stop_type": "pickup",
            "lat": req.get("pickup_lat"),
            "lng": req.get("pickup_lng"),
            "eta": None,
            "allocated_weight_kg": req["weight"],
            "allocated_volume_m3": None,
            "status": "pending",
        })
        seq += 1
        # Dropoff stop
        db.collection("route_stops").document().set({
            "route_id": route_id,
            "pickup_request_id": req["doc_id"],
            "stop_sequence": seq,
            "stop_type": "dropoff",
            "lat": req.get("delivery_lat"),
            "lng": req.get("delivery_lng"),
            "eta": None,
            "allocated_weight_kg": req["weight"],
            "allocated_volume_m3": None,
            "status": "pending",
        })
        seq += 1
        db.collection("pickup_requests").document(req["doc_id"]).update({"status": "optimized"})


def _calculate_naive_distance(request_data: list[dict]) -> float:
    """Calculate total distance if each request was delivered individually (no optimization)."""
    total = 0.0
    for r in request_data:
        plat, plng = r.get("pickup_lat"), r.get("pickup_lng")
        dlat, dlng = r.get("delivery_lat"), r.get("delivery_lng")
        if plat and plng and dlat and dlng:
            total += _haversine(plat, plng, dlat, dlng)
    return total


# Legacy compatibility wrapper
def generate_routes(db: Client, company_id: str, date_iso: str) -> list[str]:
    """Legacy wrapper — generates a plan and returns route IDs."""
    plan_id = generate_transportation_plan(db, company_id, date_iso)
    # Get route IDs from the plan
    routes = db.collection("routes").where("transportation_plan_id", "==", plan_id).stream()
    return [doc.id for doc in routes]
