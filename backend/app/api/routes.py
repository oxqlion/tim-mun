from fastapi import APIRouter, Depends, HTTPException, Query, status
from google.cloud.firestore import Client

from app.core.auth import CurrentUser, require_role
from app.schemas.route import GenerateRoutesRequest, RouteOut, RouteStopOut, RouteStopUpdate
from app.db.firestore import get_db
from app.services.lookups import get_logistics_company_id_for_user
from app.services.optimizer import generate_routes

router = APIRouter(tags=["routes"])


def _stops_for_route(db: Client, route_id: str) -> list[RouteStopOut]:
    docs = db.collection("route_stops").where("route_id", "==", route_id).stream()
    stops = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        stops.append(RouteStopOut(**data))
    stops.sort(key=lambda s: s.stop_sequence)
    return stops


def _route_to_out(db: Client, doc) -> RouteOut:
    data = doc.to_dict()
    data["id"] = doc.id
    data["stops"] = _stops_for_route(db, doc.id)
    return RouteOut(**data)


def _company_truck_ids(db: Client, company_id: str) -> list[str]:
    docs = db.collection("trucks").where("logistics_company_id", "==", company_id).stream()
    return [doc.id for doc in docs]


@router.get("/routes", response_model=list[RouteOut])
def list_routes(
    date: str = Query(..., description="ISO date, YYYY-MM-DD"),
    current_user: CurrentUser = Depends(require_role("logistics")),
):
    db = get_db()
    company_id = get_logistics_company_id_for_user(db, current_user.user_id)
    truck_ids = _company_truck_ids(db, company_id)
    if not truck_ids:
        return []

    routes = []
    # Firestore 'in' queries are capped at 10 values; fine for a POC fleet size.
    for chunk_start in range(0, len(truck_ids), 10):
        chunk = truck_ids[chunk_start : chunk_start + 10]
        docs = (
            db.collection("routes")
            .where("truck_id", "in", chunk)
            .where("route_date", "==", date)
            .stream()
        )
        routes.extend(_route_to_out(db, doc) for doc in docs)

    return routes


@router.post("/routes/generate", response_model=list[RouteOut], status_code=status.HTTP_201_CREATED)
def trigger_generate_routes(
    body: GenerateRoutesRequest,
    current_user: CurrentUser = Depends(require_role("logistics")),
):
    db = get_db()
    company_id = get_logistics_company_id_for_user(db, current_user.user_id)

    route_ids = generate_routes(db, company_id, body.date.isoformat())

    return [_route_to_out(db, db.collection("routes").document(rid).get()) for rid in route_ids]


@router.patch("/route-stops/{stop_id}", response_model=RouteStopOut)
def update_route_stop(
    stop_id: str,
    body: RouteStopUpdate,
    current_user: CurrentUser = Depends(require_role("logistics")),
):
    db = get_db()
    company_id = get_logistics_company_id_for_user(db, current_user.user_id)

    stop_ref = db.collection("route_stops").document(stop_id)
    stop_doc = stop_ref.get()
    if not stop_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route stop not found")
    stop_data = stop_doc.to_dict()

    route_doc = db.collection("routes").document(stop_data["route_id"]).get()
    if not route_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")
    route_data = route_doc.to_dict()

    truck_doc = db.collection("trucks").document(route_data["truck_id"]).get()
    if not truck_doc.exists or truck_doc.to_dict().get("logistics_company_id") != company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route stop not found")

    stop_ref.update({"status": body.status})

    pickup_request_ref = db.collection("pickup_requests").document(stop_data["pickup_request_id"])
    if body.status == "completed":
        pickup_request_ref.update({"status": "completed"})
    elif body.status == "in_progress":
        pickup_request_ref.update({"status": "in_progress"})

    sibling_stops = list(
        db.collection("route_stops").where("route_id", "==", stop_data["route_id"]).stream()
    )
    statuses = [
        body.status if doc.id == stop_id else doc.to_dict().get("status", "pending")
        for doc in sibling_stops
    ]
    route_ref = db.collection("routes").document(stop_data["route_id"])
    if all(s == "completed" for s in statuses):
        route_ref.update({"status": "completed"})
    elif any(s in ("completed", "in_progress") for s in statuses):
        route_ref.update({"status": "in_progress"})

    updated = stop_ref.get().to_dict()
    updated["id"] = stop_id
    return RouteStopOut(**updated)
