from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from google.cloud.firestore import Client

from app.core.auth import CurrentUser, require_role
from app.db.firestore import get_db
from app.schemas.pickup_request import PickupRequestCreate, PickupRequestOut, RequestItemOut
from app.schemas.route import RouteOut, RouteStopOut
from app.services.lookups import get_warehouse_id_for_user

router = APIRouter(prefix="/pickup-requests", tags=["pickup-requests"])


def _items_for_request(db: Client, request_id: str) -> list[RequestItemOut]:
    docs = db.collection("request_items").where("pickup_request_id", "==", request_id).stream()
    items = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        items.append(RequestItemOut(**data))
    return items


def _matched_route_for_request(db: Client, request_id: str) -> RouteOut | None:
    stop_docs = list(db.collection("route_stops").where("pickup_request_id", "==", request_id).stream())
    if not stop_docs:
        return None

    route_id = stop_docs[0].to_dict()["route_id"]
    route_doc = db.collection("routes").document(route_id).get()
    if not route_doc.exists:
        return None

    route_data = route_doc.to_dict()
    route_data["id"] = route_doc.id

    all_stops_docs = db.collection("route_stops").where("route_id", "==", route_id).stream()
    stops = []
    for doc in all_stops_docs:
        data = doc.to_dict()
        data["id"] = doc.id
        stops.append(RouteStopOut(**data))
    stops.sort(key=lambda s: s.stop_sequence)
    route_data["stops"] = stops

    return RouteOut(**route_data)


def _to_out(db: Client, doc, include_route: bool = False) -> PickupRequestOut:
    data = doc.to_dict()
    data["id"] = doc.id
    data["items"] = _items_for_request(db, doc.id)
    if include_route:
        data["matched_route"] = _matched_route_for_request(db, doc.id)
    return PickupRequestOut(**data)


@router.post("", response_model=PickupRequestOut, status_code=status.HTTP_201_CREATED)
def create_pickup_request(
    body: PickupRequestCreate,
    current_user: CurrentUser = Depends(require_role("warehouse")),
):
    db = get_db()
    warehouse_id = get_warehouse_id_for_user(db, current_user.user_id)

    request_ref = db.collection("pickup_requests").document()
    request_ref.set(
        {
            "warehouse_id": warehouse_id,
            "pickup_date": body.pickup_date.isoformat(),
            "destination_name": body.destination_name,
            "destination_lat": body.destination_lat,
            "destination_lng": body.destination_lng,
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
        }
    )

    for item in body.items:
        db.collection("request_items").document().set(
            {
                "pickup_request_id": request_ref.id,
                **item.model_dump(),
            }
        )

    doc = request_ref.get()
    return _to_out(db, doc)


@router.get("", response_model=list[PickupRequestOut])
def list_pickup_requests(current_user: CurrentUser = Depends(require_role("warehouse"))):
    db = get_db()
    warehouse_id = get_warehouse_id_for_user(db, current_user.user_id)

    docs = (
        db.collection("pickup_requests")
        .where("warehouse_id", "==", warehouse_id)
        .order_by("created_at", direction="DESCENDING")
        .stream()
    )
    return [_to_out(db, doc) for doc in docs]


@router.get("/{request_id}", response_model=PickupRequestOut)
def get_pickup_request(
    request_id: str,
    current_user: CurrentUser = Depends(require_role("warehouse")),
):
    db = get_db()
    warehouse_id = get_warehouse_id_for_user(db, current_user.user_id)

    doc = db.collection("pickup_requests").document(request_id).get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pickup request not found")

    data = doc.to_dict()
    if data.get("warehouse_id") != warehouse_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pickup request not found")

    return _to_out(db, doc, include_route=True)
