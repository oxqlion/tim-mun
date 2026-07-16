"""Automatic fleet allocation service.

Assigns pending pickup requests to available trucks based on:
- Vehicle capacity (weight + volume)
- Total shipment weight per request
- Vehicle availability
- Delivery schedule (required_arrival_date priority)

Contract: allocate_fleet(db, company_id, date_iso) -> dict[truck_id, list[request_doc]]
"""

from google.cloud.firestore import Client


def _total_weight_for_request(db: Client, request_id: str) -> float:
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


def _total_volume_for_request(db: Client, request_id: str) -> float:
    """Calculate total volume (m³) for a pickup request from its items."""
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


def allocate_fleet(
    db: Client, company_id: str, date_iso: str
) -> dict[str, list]:
    """Allocate pending requests to available trucks.

    Strategy:
    1. Sort requests by priority (required_arrival_date soonest first, then by weight descending)
    2. Best-fit decreasing: assign each request to the truck with least remaining capacity
       that still fits the request (minimizes wasted space)

    Returns:
        Dict mapping truck_id -> list of request dicts with metadata.
        Each request dict: {doc_id, data, weight, volume}
    """
    # Gather pending requests for this date
    pending_docs = list(
        db.collection("pickup_requests")
        .where("pickup_date", "==", date_iso)
        .where("status", "==", "pending")
        .stream()
    )
    if not pending_docs:
        return {}

    # Gather available trucks for this company
    trucks = list(
        db.collection("trucks")
        .where("logistics_company_id", "==", company_id)
        .where("status", "==", "available")
        .stream()
    )
    if not trucks:
        return {}

    # Build request metadata
    requests = []
    for doc in pending_docs:
        data = doc.to_dict()
        weight = _total_weight_for_request(db, doc.id)
        volume = _total_volume_for_request(db, doc.id)
        requests.append({
            "doc_id": doc.id,
            "data": data,
            "weight": weight,
            "volume": volume,
            "required_arrival_date": data.get("required_arrival_date"),
        })

    # Sort: urgent deliveries first (earliest required_arrival_date),
    # then heaviest first (best-fit decreasing heuristic)
    def sort_key(r):
        arrival = r["required_arrival_date"] or "9999-12-31"
        return (arrival, -r["weight"])

    requests.sort(key=sort_key)

    # Build truck state
    truck_state = []
    for t in trucks:
        td = t.to_dict()
        l = td.get("length_cm") or 0
        w = td.get("width_cm") or 0
        h = td.get("height_cm") or 0
        truck_volume = (l * w * h) / 1_000_000 if (l > 0 and w > 0 and h > 0) else (td.get("capacity_volume_m3") or float("inf"))

        truck_state.append({
            "id": t.id,
            "remaining_weight_kg": td["capacity_weight_kg"],
            "remaining_volume_m3": truck_volume,
            "capacity_weight_kg": td["capacity_weight_kg"],
            "capacity_volume_m3": truck_volume,
            "assigned_requests": [],
        })

    # Best-fit decreasing allocation
    for req in requests:
        # Find truck with smallest remaining capacity that still fits
        candidates = [
            t for t in truck_state
            if t["remaining_weight_kg"] >= req["weight"]
            and t["remaining_volume_m3"] >= req["volume"]
        ]

        if not candidates:
            continue  # no truck can fit this request, skip

        # Best-fit: pick truck with least remaining weight after assignment
        best_truck = min(candidates, key=lambda t: t["remaining_weight_kg"] - req["weight"])

        best_truck["remaining_weight_kg"] -= req["weight"]
        best_truck["remaining_volume_m3"] -= req["volume"]
        best_truck["assigned_requests"].append(req)

    # Build output: truck_id -> list of requests
    allocation: dict[str, list] = {}
    for t in truck_state:
        if t["assigned_requests"]:
            allocation[t["id"]] = t["assigned_requests"]

    return allocation
