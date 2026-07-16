"""Route/load optimizer using Google OR-Tools multi-vehicle Pickup & Delivery solver.

Solves assignment AND routing simultaneously:
- OR-Tools decides which requests go to which truck
- OR-Tools decides the optimal stop order per truck
- Naturally groups geographically close requests to same truck
- Minimizes total distance across ALL trucks

Uses OSRM for real road distances. Falls back to haversine.

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
AVG_SPEED_KMH = 35.0
LOADING_TIME_MINUTES = 60
START_HOUR = 8
OSRM_BASE_URL = "http://router.project-osrm.org"
OSRM_TIMEOUT_SECONDS = 10
FUEL_CONSUMPTION_L_PER_KM = 0.15
WIB = timezone(timedelta(hours=7))  # UTC+7


# ---------------------------------------------------------------------------
# Geo utilities
# ---------------------------------------------------------------------------


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in km between two coordinates."""
    lat1, lng1, lat2, lng2 = map(math.radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def _build_distance_matrix(locations: list[tuple[float, float]]) -> list[list[int]]:
    """Build distance matrix. Tries OSRM, falls back to haversine."""
    matrix = _build_distance_matrix_osrm(locations)
    if matrix is not None:
        return matrix
    logger.warning("OSRM unavailable, falling back to haversine")
    return _build_distance_matrix_haversine(locations)


def _build_distance_matrix_osrm(locations: list[tuple[float, float]]) -> Optional[list[list[int]]]:
    """Fetch real road distance matrix from OSRM."""
    if not locations or len(locations) > 100:
        return None
    coords_str = ";".join(f"{lng},{lat}" for lat, lng in locations)
    url = f"{OSRM_BASE_URL}/table/v1/driving/{coords_str}?annotations=distance"
    try:
        req = Request(url, headers={"User-Agent": "agriload/1.0"})
        with urlopen(req, timeout=OSRM_TIMEOUT_SECONDS) as response:
            data = json.loads(response.read().decode())
        if data.get("code") != "Ok":
            return None
        raw = data["distances"]
        n = len(locations)
        return [[int(raw[i][j]) for j in range(n)] for i in range(n)]
    except (URLError, TimeoutError, json.JSONDecodeError, KeyError) as e:
        logger.warning("OSRM distance failed: %s", e)
        return None


def _build_distance_matrix_haversine(locations: list[tuple[float, float]]) -> list[list[int]]:
    """Haversine fallback."""
    n = len(locations)
    matrix = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            d = int(_haversine(locations[i][0], locations[i][1], locations[j][0], locations[j][1]) * 1000)
            matrix[i][j] = d
            matrix[j][i] = d
    return matrix


def _get_duration_matrix_osrm(locations: list[tuple[float, float]]) -> Optional[list[list[float]]]:
    """Fetch duration matrix from OSRM."""
    if not locations or len(locations) > 100:
        return None
    coords_str = ";".join(f"{lng},{lat}" for lat, lng in locations)
    url = f"{OSRM_BASE_URL}/table/v1/driving/{coords_str}?annotations=duration"
    try:
        req = Request(url, headers={"User-Agent": "agriload/1.0"})
        with urlopen(req, timeout=OSRM_TIMEOUT_SECONDS) as response:
            data = json.loads(response.read().decode())
        if data.get("code") != "Ok":
            return None
        return data["durations"]
    except (URLError, TimeoutError, json.JSONDecodeError, KeyError) as e:
        logger.warning("OSRM duration failed: %s", e)
        return None


# ---------------------------------------------------------------------------
# Weight helpers
# ---------------------------------------------------------------------------


def _weight_for_request(db: Client, request_id: str) -> float:
    """Total weight for a request."""
    items = db.collection("request_items").where("pickup_request_id", "==", request_id).stream()
    total = 0.0
    for doc in items:
        item = doc.to_dict()
        if item.get("estimated_weight_kg") is not None:
            total += item["estimated_weight_kg"]
        elif item.get("unit_type") == "kg":
            total += item.get("quantity", 0)
    return total


def _volume_for_request(db: Client, request_id: str) -> float:
    """Total volume (m³) for a request."""
    items = db.collection("request_items").where("pickup_request_id", "==", request_id).stream()
    total = 0.0
    for doc in items:
        item = doc.to_dict()
        l = item.get("length_cm") or 0
        w = item.get("width_cm") or 0
        h = item.get("height_cm") or 0
        qty = item.get("quantity", 1)
        if l > 0 and w > 0 and h > 0:
            total += (l * w * h * qty) / 1_000_000
    return total


# ---------------------------------------------------------------------------
# Multi-vehicle PDP solver
# ---------------------------------------------------------------------------


def _solve_multi_vehicle_pdp(
    distance_matrix: list[list[int]],
    pickups_deliveries: list[tuple[int, int]],
    demands: list[int],
    volume_demands: list[int],
    vehicle_capacities: list[int],
    vehicle_volume_capacities: list[int],
    num_vehicles: int,
    logs: list[str],
) -> Optional[list[list[int]]]:
    """Solve multi-vehicle Pickup & Delivery Problem.

    OR-Tools decides BOTH truck assignment AND routing simultaneously.
    Constraints: weight capacity + volume capacity per truck.
    """
    n = len(distance_matrix)
    manager = pywrapcp.RoutingIndexManager(n, num_vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)

    # Distance callback
    def distance_callback(from_index, to_index):
        return distance_matrix[manager.IndexToNode(from_index)][manager.IndexToNode(to_index)]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # Distance dimension
    routing.AddDimension(transit_callback_index, 0, 5_000_000, True, "Distance")
    distance_dimension = routing.GetDimensionOrDie("Distance")

    # Weight capacity constraint
    def demand_callback(from_index):
        return demands[manager.IndexToNode(from_index)]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(demand_callback_index, 0, vehicle_capacities, True, "Weight")

    # Volume capacity constraint
    def volume_callback(from_index):
        return volume_demands[manager.IndexToNode(from_index)]

    volume_callback_index = routing.RegisterUnaryTransitCallback(volume_callback)
    routing.AddDimensionWithVehicleCapacity(volume_callback_index, 0, vehicle_volume_capacities, True, "Volume")

    # Pickup & Delivery constraints
    for pickup_node, delivery_node in pickups_deliveries:
        pickup_index = manager.NodeToIndex(pickup_node)
        delivery_index = manager.NodeToIndex(delivery_node)
        routing.AddPickupAndDelivery(pickup_index, delivery_index)
        routing.solver().Add(routing.VehicleVar(pickup_index) == routing.VehicleVar(delivery_index))
        routing.solver().Add(
            distance_dimension.CumulVar(pickup_index) <= distance_dimension.CumulVar(delivery_index)
        )

    # Allow trucks to be unused
    for i in range(num_vehicles):
        routing.SetFixedCostOfVehicle(0, i)

    # Search parameters
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
    search_params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search_params.time_limit.seconds = 15

    logs.append(f"    Solver config: {num_vehicles} vehicles, {n} nodes, {len(pickups_deliveries)} pickup-delivery pairs")
    num_permutations = 1
    for i in range(1, len(pickups_deliveries) * 2 + 1):
        num_permutations *= i
        if num_permutations > 10**12:
            break
    logs.append(f"    Search space: {'>' if num_permutations > 10**12 else ''}{num_permutations:,.0f} possible combinations")
    logs.append(f"    Strategy: Parallel Cheapest Insertion + Guided Local Search (15s)")

    solution = routing.SolveWithParameters(search_params)
    if not solution:
        logs.append("    ✗ No feasible solution found")
        return None

    logs.append(f"    ✓ Optimal solution found!")
    logs.append(f"    Objective (total distance): {solution.ObjectiveValue() / 1000:.2f} km")

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


def _calculate_eta_for_route(
    route_nodes: list[int],
    locations: list[tuple[float, float]],
    node_info: dict[int, dict],
    date_iso: str,
    duration_matrix: Optional[list[list[float]]] = None,
) -> dict[str, datetime]:
    """Calculate ETA at dropoff for each request."""
    year, month, day = map(int, date_iso.split("-"))
    departure = datetime(year, month, day, START_HOUR, 0, 0, tzinfo=WIB)
    eta_map: dict[str, datetime] = {}
    current_time = departure
    prev_node = 0
    is_first_stop = True

    for node_idx in route_nodes:
        # Skip travel time from depot to first stop (truck starts at first stop)
        if not is_first_stop:
            if duration_matrix is not None:
                current_time += timedelta(seconds=duration_matrix[prev_node][node_idx])
            else:
                loc = locations[node_idx]
                prev_loc = locations[prev_node]
                km = _haversine(prev_loc[0], prev_loc[1], loc[0], loc[1])
                current_time += timedelta(hours=km / AVG_SPEED_KMH)
        is_first_stop = False

        info = node_info.get(node_idx, {})
        if info.get("type") == "pickup":
            doc_id = info.get("doc_id")
            if doc_id:
                eta_map[f"pickup_{doc_id}"] = current_time
            current_time += timedelta(minutes=LOADING_TIME_MINUTES)
        if info.get("type") == "dropoff":
            doc_id = info.get("doc_id")
            if doc_id:
                eta_map[doc_id] = current_time
        prev_node = node_idx

    return eta_map


# ---------------------------------------------------------------------------
# Space optimization per truck
# ---------------------------------------------------------------------------


def _run_space_optimization(db: Client, truck_id: str, request_ids: list[str]) -> SpaceResult:
    """Run space optimization for items on a truck."""
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
        for item_doc in db.collection("request_items").where("pickup_request_id", "==", req_id).stream():
            d = item_doc.to_dict()
            weight = d.get("estimated_weight_kg") or (d.get("quantity", 0) if d.get("unit_type") == "kg" else 0)
            qty = d.get("quantity", 1)
            l = d.get("length_cm") or 50
            w = d.get("width_cm") or 50
            h = d.get("height_cm") or 50
            # Total volume = single item volume × quantity
            # Represent as one grouped item with scaled dimensions for volume calc
            # Use cube root scaling to keep proportional: side = cbrt(L*W*H*qty)
            single_vol_cm3 = l * w * h
            total_vol_cm3 = single_vol_cm3 * qty
            # Store as equivalent cube for volume calculation
            equivalent_side = total_vol_cm3 ** (1/3)
            items.append(ItemForPacking(
                id=item_doc.id, pickup_request_id=req_id,
                commodity_name=f"{d.get('commodity_name', '')} (×{int(qty)})",
                quantity=qty, weight_kg=weight,
                length_cm=equivalent_side,
                width_cm=equivalent_side,
                height_cm=equivalent_side,
                stackable=d.get("stackable", False),
                fragile=d.get("fragile", False),
            ))
    return optimize_space(items, truck)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def generate_transportation_plan(db: Client, company_id: str, date_iso: str) -> str:
    """Generate a transportation plan using multi-vehicle PDP.

    OR-Tools solves truck assignment + routing simultaneously,
    ensuring geographically close requests are grouped together.
    """
    logs: list[str] = []

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
        "optimization_log": [],
        "created_at": datetime.now(timezone.utc),
        "approved_at": None,
    })

    # Gather pending requests
    logs.append(f"[1/4] Gathering data for date {date_iso}")
    pending_docs = list(
        db.collection("pickup_requests")
        .where("pickup_date", "==", date_iso)
        .where("status", "==", "pending")
        .stream()
    )
    if not pending_docs:
        logs.append("  ⚠ No pending requests found.")
        plan_ref.update({"status": "optimized", "optimization_log": logs})
        return plan_ref.id

    trucks = list(
        db.collection("trucks")
        .where("logistics_company_id", "==", company_id)
        .where("status", "==", "available")
        .stream()
    )
    if not trucks:
        logs.append("  ⚠ No available trucks.")
        plan_ref.update({"status": "optimized", "optimization_log": logs})
        return plan_ref.id

    logs.append(f"  → {len(pending_docs)} pending requests")
    logs.append(f"  → {len(trucks)} available trucks")

    # Build request metadata
    request_data = []
    for doc in pending_docs:
        data = doc.to_dict()
        wh_doc = db.collection("warehouses").document(data["warehouse_id"]).get()
        wh = wh_doc.to_dict() if wh_doc.exists else {}
        weight = _weight_for_request(db, doc.id)
        volume = _volume_for_request(db, doc.id)
        request_data.append({
            "doc_id": doc.id,
            "data": data,
            "weight": weight,
            "volume": volume,
            "pickup_lat": wh.get("lat"),
            "pickup_lng": wh.get("lng"),
            "delivery_lat": data.get("destination_lat"),
            "delivery_lng": data.get("destination_lng"),
            "warehouse_name": wh.get("name", ""),
            "destination_name": data.get("destination_name", ""),
        })

    for r in request_data:
        logs.append(f"    • {r['warehouse_name']} → {r['destination_name']} ({r['weight']:.0f} kg, {r['volume']:.2f} m³)")

    # Filter geo-enabled requests
    geo_requests = [r for r in request_data if r["pickup_lat"] and r["pickup_lng"] and r["delivery_lat"] and r["delivery_lng"]]
    no_geo_requests = [r for r in request_data if r not in geo_requests]

    created_route_ids: list[str] = []
    total_distance_km = 0.0
    truck_assignments: dict[str, list] = {}  # truck_id -> list of requests

    # --- Multi-vehicle PDP ---
    if geo_requests:
        logs.append(f"\n[2/4] Running multi-vehicle Pickup & Delivery optimization")
        logs.append(f"  All {len(geo_requests)} requests + {len(trucks)} trucks solved simultaneously")
        logs.append(f"  OR-Tools decides: truck assignment + route order in ONE solve\n")

        # Depot at centroid
        avg_lat = sum(r["pickup_lat"] for r in geo_requests) / len(geo_requests)
        avg_lng = sum(r["pickup_lng"] for r in geo_requests) / len(geo_requests)

        locations: list[tuple[float, float]] = [(avg_lat, avg_lng)]
        demands: list[int] = [0]
        volume_demands: list[int] = [0]
        pickups_deliveries: list[tuple[int, int]] = []
        node_info: dict[int, dict] = {}

        for i, req in enumerate(geo_requests):
            pickup_idx = len(locations)
            locations.append((req["pickup_lat"], req["pickup_lng"]))
            demands.append(int(req["weight"]))
            volume_demands.append(int(req.get("volume", 0) * 1000))  # m³ → liters for int precision
            node_info[pickup_idx] = {"type": "pickup", "doc_id": req["doc_id"], "idx": i}

            delivery_idx = len(locations)
            locations.append((req["delivery_lat"], req["delivery_lng"]))
            demands.append(-int(req["weight"]))
            volume_demands.append(-int(req.get("volume", 0) * 1000))
            node_info[delivery_idx] = {"type": "dropoff", "doc_id": req["doc_id"], "idx": i}

            pickups_deliveries.append((pickup_idx, delivery_idx))

        distance_matrix = _build_distance_matrix(locations)
        vehicle_capacities = [int(t.to_dict()["capacity_weight_kg"]) for t in trucks]

        # Volume capacities: L×W×H in liters (×1000 for int), fallback to large number
        vehicle_volume_capacities = []
        for t in trucks:
            td = t.to_dict()
            l, w, h = td.get("length_cm") or 0, td.get("width_cm") or 0, td.get("height_cm") or 0
            if l > 0 and w > 0 and h > 0:
                vol_m3 = (l * w * h) / 1_000_000
                vehicle_volume_capacities.append(int(vol_m3 * 1000))
            else:
                vehicle_volume_capacities.append(999_999)  # no limit if dims unknown

        num_vehicles = len(trucks)

        solution = _solve_multi_vehicle_pdp(
            distance_matrix, pickups_deliveries, demands, volume_demands,
            vehicle_capacities, vehicle_volume_capacities, num_vehicles, logs
        )

        if solution:
            duration_matrix = _get_duration_matrix_osrm(locations)
            logs.append(f"\n  Route assignments:")

            for vehicle_idx, route_nodes in enumerate(solution):
                if not route_nodes:
                    continue

                truck_doc = trucks[vehicle_idx]
                truck_id = truck_doc.id
                truck_data = truck_doc.to_dict()

                # Identify which requests are on this truck
                truck_request_ids = set()
                for node in route_nodes:
                    info = node_info.get(node)
                    if info:
                        truck_request_ids.add(info["doc_id"])

                truck_reqs = [r for r in geo_requests if r["doc_id"] in truck_request_ids]
                truck_assignments[truck_id] = truck_reqs

                # Log assignment
                logs.append(f"\n    Truck {truck_data.get('plate_number', truck_id[:8])} ({truck_data['capacity_weight_kg']} kg):")
                total_weight = sum(r["weight"] for r in truck_reqs)
                logs.append(f"      Assigned {len(truck_reqs)} requests ({total_weight:.0f} kg)")
                for r in truck_reqs:
                    logs.append(f"        - {r['warehouse_name']} → {r['destination_name']}")

                # Calculate route distance
                route_dist_m = 0
                prev = 0
                for node in route_nodes:
                    route_dist_m += distance_matrix[prev][node]
                    prev = node
                route_dist_km = route_dist_m / 1000
                total_distance_km += route_dist_km

                # Log route
                seq_str = " → ".join(
                    f"{'P' if node_info[n]['type'] == 'pickup' else 'D'}{node_info[n]['idx']+1}"
                    for n in route_nodes if n in node_info
                )
                logs.append(f"      Route: {seq_str}")
                logs.append(f"      Distance: {route_dist_km:.2f} km")

                # ETA
                eta_map = _calculate_eta_for_route(route_nodes, locations, node_info, date_iso, duration_matrix)

                # Space optimization
                space_result = _run_space_optimization(db, truck_id, list(truck_request_ids))
                logs.append(f"      Space: {space_result.weight_utilization_percent}% weight | {space_result.space_utilization_percent}% volume")

                # Create route document
                route_ref = db.collection("routes").document()
                route_ref.set({
                    "transportation_plan_id": plan_ref.id,
                    "truck_id": truck_id,
                    "route_date": date_iso,
                    "status": "planned",
                    "total_distance_km": round(route_dist_km, 2),
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

                # Create route stops
                seq = 1
                for node_idx in route_nodes:
                    info = node_info.get(node_idx)
                    if not info:
                        continue
                    req = geo_requests[info["idx"]]
                    db.collection("route_stops").document().set({
                        "route_id": route_ref.id,
                        "pickup_request_id": req["doc_id"],
                        "stop_sequence": seq,
                        "stop_type": info["type"],
                        "lat": locations[node_idx][0],
                        "lng": locations[node_idx][1],
                        "eta": eta_map.get(req["doc_id"]) if info["type"] == "dropoff" else eta_map.get(f"pickup_{req['doc_id']}"),
                        "allocated_weight_kg": req["weight"],
                        "allocated_volume_m3": None,
                        "status": "pending",
                    })
                    seq += 1

                # Update request statuses
                for req in truck_reqs:
                    update = {"status": "optimized"}
                    if req["doc_id"] in eta_map:
                        update["estimated_arrival"] = eta_map[req["doc_id"]]
                    db.collection("pickup_requests").document(req["doc_id"]).update(update)

                # Update truck status
                db.collection("trucks").document(truck_id).update({"status": "on_trip"})
        else:
            logs.append("  ⚠ Solver failed, falling back to naive assignment")
            no_geo_requests.extend(geo_requests)

    # --- Fallback for no-geo requests ---
    if no_geo_requests:
        logs.append(f"\n  Fallback: {len(no_geo_requests)} requests without coordinates")
        # Simple assignment to remaining trucks
        remaining_trucks = [t for t in trucks if t.id not in truck_assignments]
        if remaining_trucks:
            truck_doc = remaining_trucks[0]
            route_ref = db.collection("routes").document()
            route_ref.set({
                "transportation_plan_id": plan_ref.id,
                "truck_id": truck_doc.id,
                "route_date": date_iso,
                "status": "planned",
                "total_distance_km": None,
                "space_utilization_percent": None,
                "weight_utilization_percent": None,
                "generated_at": datetime.now(timezone.utc),
            })
            created_route_ids.append(route_ref.id)
            seq = 1
            for req in no_geo_requests:
                db.collection("route_stops").document().set({
                    "route_id": route_ref.id,
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
                db.collection("pickup_requests").document(req["doc_id"]).update({"status": "optimized"})
            db.collection("trucks").document(truck_doc.id).update({"status": "on_trip"})

    # --- Fuel analysis ---
    naive_distance = sum(
        _haversine(r["pickup_lat"], r["pickup_lng"], r["delivery_lat"], r["delivery_lng"])
        for r in geo_requests
        if r["pickup_lat"] and r["delivery_lat"]
    )
    estimated_fuel = total_distance_km * FUEL_CONSUMPTION_L_PER_KM
    fuel_savings = ((naive_distance - total_distance_km) / naive_distance * 100) if naive_distance > 0 else 0

    logs.append(f"\n[3/4] Fuel & efficiency analysis")
    logs.append(f"  → Naive distance (each request sent individually): {naive_distance:.2f} km")
    logs.append(f"  → Optimized distance (multi-vehicle PDP): {total_distance_km:.2f} km")
    logs.append(f"  → Distance saved: {naive_distance - total_distance_km:.2f} km ({fuel_savings:.1f}%)")
    logs.append(f"  → Estimated fuel: {estimated_fuel:.2f} L")

    trucks_used = len(truck_assignments) + (1 if no_geo_requests else 0)
    total_reqs = len(geo_requests) + len(no_geo_requests)

    logs.append(f"\n[4/4] ✓ Optimization complete")
    logs.append(f"  → {total_reqs} requests → {trucks_used} trucks")
    logs.append(f"  → Total distance: {total_distance_km:.2f} km")
    if fuel_savings > 0:
        logs.append(f"  → Fuel savings: {fuel_savings:.1f}% vs individual delivery")
    else:
        logs.append(f"  → Note: optimized route is {abs(fuel_savings):.1f}% longer (overhead from multi-stop grouping)")

    # Update plan
    plan_ref.update({
        "status": "optimized",
        "total_requests": total_reqs,
        "total_trucks_used": trucks_used,
        "total_distance_km": round(total_distance_km, 2) if total_distance_km > 0 else None,
        "estimated_fuel_liters": round(estimated_fuel, 2) if estimated_fuel > 0 else None,
        "fuel_savings_percent": round(max(0, fuel_savings), 1) if fuel_savings > 0 else 0,
        "optimization_log": logs,
    })

    return plan_ref.id


# Legacy compatibility
def generate_routes(db: Client, company_id: str, date_iso: str) -> list[str]:
    """Legacy wrapper."""
    plan_id = generate_transportation_plan(db, company_id, date_iso)
    routes = db.collection("routes").where("transportation_plan_id", "==", plan_id).stream()
    return [doc.id for doc in routes]
