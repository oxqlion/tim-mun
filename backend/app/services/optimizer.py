"""Route/load optimizer.

Naive stub for the POC: group pending pickup requests by destination, assign
each to the first available truck with enough remaining capacity, sequence
stops in the order requests were created. Swap this function's body for a
real routing/bin-packing algorithm later — callers only depend on the
(db, company_id, date_iso) -> list[route_id] contract, not the internals.
"""

from datetime import datetime, timezone
from itertools import groupby

from google.cloud.firestore import Client


def _weight_for_request(db: Client, request_id: str) -> float:
    items = db.collection("request_items").where("pickup_request_id", "==", request_id).stream()
    total = 0.0
    for doc in items:
        item = doc.to_dict()
        if item.get("estimated_weight_kg") is not None:
            total += item["estimated_weight_kg"]
        elif item.get("unit_type") == "kg":
            total += item.get("quantity", 0)
    return total


def generate_routes(db: Client, company_id: str, date_iso: str) -> list[str]:
    pending_requests = list(
        db.collection("pickup_requests")
        .where("pickup_date", "==", date_iso)
        .where("status", "==", "pending")
        .stream()
    )
    pending_requests.sort(key=lambda d: d.to_dict().get("destination_name", ""))

    trucks = list(
        db.collection("trucks")
        .where("logistics_company_id", "==", company_id)
        .where("status", "==", "available")
        .stream()
    )
    truck_state = [
        {
            "id": t.id,
            "remaining_weight_kg": t.to_dict()["capacity_weight_kg"],
            "route_id": None,
            "next_sequence": 1,
        }
        for t in trucks
    ]

    created_route_ids: list[str] = []

    for _destination, group in groupby(pending_requests, key=lambda d: d.to_dict().get("destination_name", "")):
        for request_doc in group:
            request_weight = _weight_for_request(db, request_doc.id)

            truck = next((t for t in truck_state if t["remaining_weight_kg"] >= request_weight), None)
            if truck is None:
                continue  # no truck has capacity; leave request pending

            if truck["route_id"] is None:
                route_ref = db.collection("routes").document()
                route_ref.set(
                    {
                        "truck_id": truck["id"],
                        "route_date": date_iso,
                        "status": "planned",
                        "total_distance_km": None,
                        "generated_at": datetime.now(timezone.utc),
                    }
                )
                truck["route_id"] = route_ref.id
                created_route_ids.append(route_ref.id)
                db.collection("trucks").document(truck["id"]).update({"status": "on_trip"})

            db.collection("route_stops").document().set(
                {
                    "route_id": truck["route_id"],
                    "pickup_request_id": request_doc.id,
                    "stop_sequence": truck["next_sequence"],
                    "stop_type": "pickup",
                    "eta": None,
                    "allocated_weight_kg": request_weight,
                    "allocated_volume_m3": None,
                    "status": "pending",
                }
            )
            truck["next_sequence"] += 1
            truck["remaining_weight_kg"] -= request_weight

            db.collection("pickup_requests").document(request_doc.id).update({"status": "matched"})

    return created_route_ids
