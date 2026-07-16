from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import CurrentUser, require_role
from app.db.firestore import get_db
from app.schemas.route import RouteOut, RouteStopOut, SpaceAllocationOut
from app.schemas.transportation_plan import (
    TransportationPlanCreate,
    TransportationPlanOut,
    TransportationPlanSummary,
)
from app.services.lookups import get_logistics_company_id_for_user
from app.services.optimizer import generate_transportation_plan

router = APIRouter(prefix="/transportation-plans", tags=["transportation-plans"])


def _stops_for_route(db, route_id: str) -> list[RouteStopOut]:
    docs = db.collection("route_stops").where("route_id", "==", route_id).stream()
    stops = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        # Resolve location name from pickup request
        req_id = data.get("pickup_request_id")
        if req_id:
            req_doc = db.collection("pickup_requests").document(req_id).get()
            if req_doc.exists:
                req_data = req_doc.to_dict()
                if data.get("stop_type") == "pickup":
                    wh_doc = db.collection("warehouses").document(req_data.get("warehouse_id", "")).get()
                    data["location_name"] = wh_doc.to_dict().get("name") if wh_doc.exists else None
                else:
                    data["location_name"] = req_data.get("destination_name")
        stops.append(RouteStopOut(**data))
    stops.sort(key=lambda s: s.stop_sequence)
    return stops


def _space_allocations_for_route(db, route_id: str) -> list[SpaceAllocationOut]:
    docs = db.collection("space_allocations").where("route_id", "==", route_id).stream()
    allocations = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        allocations.append(SpaceAllocationOut(**data))
    allocations.sort(key=lambda a: a.loading_sequence)
    return allocations


def _routes_for_plan(db, plan_id: str) -> list[RouteOut]:
    docs = db.collection("routes").where("transportation_plan_id", "==", plan_id).stream()
    routes = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        data["stops"] = _stops_for_route(db, doc.id)
        data["space_allocations"] = _space_allocations_for_route(db, doc.id)
        # Resolve truck info
        truck_doc = db.collection("trucks").document(data["truck_id"]).get()
        if truck_doc.exists:
            td = truck_doc.to_dict()
            data["truck_plate_number"] = td.get("plate_number")
            data["truck_vehicle_type"] = td.get("vehicle_type")
        routes.append(RouteOut(**data))
    return routes


def _plan_to_out(db, doc) -> TransportationPlanOut:
    data = doc.to_dict()
    data["id"] = doc.id
    data["routes"] = _routes_for_plan(db, doc.id)
    return TransportationPlanOut(**data)


@router.post("", response_model=TransportationPlanOut, status_code=status.HTTP_201_CREATED)
def create_transportation_plan(
    body: TransportationPlanCreate,
    current_user: CurrentUser = Depends(require_role("logistics")),
):
    """Generate a new transportation plan for a given date.

    Performs:
    1. Fleet allocation (assign requests to trucks)
    2. Route optimization (OR-Tools PDP + OSRM)
    3. Space optimization (loading arrangement)
    """
    db = get_db()
    company_id = get_logistics_company_id_for_user(db, current_user.user_id)

    plan_id = generate_transportation_plan(db, company_id, body.plan_date.isoformat())

    plan_doc = db.collection("transportation_plans").document(plan_id).get()
    return _plan_to_out(db, plan_doc)


@router.get("", response_model=list[TransportationPlanSummary])
def list_transportation_plans(
    current_user: CurrentUser = Depends(require_role("logistics")),
):
    """List all transportation plans for the logistics company."""
    db = get_db()
    company_id = get_logistics_company_id_for_user(db, current_user.user_id)

    docs = (
        db.collection("transportation_plans")
        .where("logistics_company_id", "==", company_id)
        .order_by("created_at", direction="DESCENDING")
        .stream()
    )
    plans = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        plans.append(TransportationPlanSummary(**data))
    return plans


@router.get("/{plan_id}", response_model=TransportationPlanOut)
def get_transportation_plan(
    plan_id: str,
    current_user: CurrentUser = Depends(require_role("logistics")),
):
    """Get a transportation plan with full route and space optimization details."""
    db = get_db()
    company_id = get_logistics_company_id_for_user(db, current_user.user_id)

    doc = db.collection("transportation_plans").document(plan_id).get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    data = doc.to_dict()
    if data.get("logistics_company_id") != company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    return _plan_to_out(db, doc)


@router.post("/{plan_id}/approve", response_model=TransportationPlanOut)
def approve_transportation_plan(
    plan_id: str,
    current_user: CurrentUser = Depends(require_role("logistics")),
):
    """Approve a transportation plan, making it active."""
    db = get_db()
    company_id = get_logistics_company_id_for_user(db, current_user.user_id)

    doc = db.collection("transportation_plans").document(plan_id).get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    data = doc.to_dict()
    if data.get("logistics_company_id") != company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    if data.get("status") != "optimized":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only optimized plans can be approved",
        )

    # Update plan status
    db.collection("transportation_plans").document(plan_id).update({
        "status": "approved",
        "approved_at": datetime.now(timezone.utc),
    })

    # Update all related pickup requests to "assigned"
    routes = db.collection("routes").where("transportation_plan_id", "==", plan_id).stream()
    for route_doc in routes:
        stops = db.collection("route_stops").where("route_id", "==", route_doc.id).stream()
        seen_requests = set()
        for stop in stops:
            req_id = stop.to_dict().get("pickup_request_id")
            if req_id and req_id not in seen_requests:
                seen_requests.add(req_id)
                db.collection("pickup_requests").document(req_id).update({"status": "assigned"})

    updated_doc = db.collection("transportation_plans").document(plan_id).get()
    return _plan_to_out(db, updated_doc)
