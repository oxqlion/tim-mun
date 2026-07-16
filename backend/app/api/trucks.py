from fastapi import APIRouter, Depends, status

from app.core.auth import CurrentUser, require_role
from app.db.firestore import get_db
from app.schemas.truck import TruckCreate, TruckOut
from app.services.lookups import get_logistics_company_id_for_user

router = APIRouter(prefix="/trucks", tags=["trucks"])


@router.get("", response_model=list[TruckOut])
def list_trucks(current_user: CurrentUser = Depends(require_role("logistics"))):
    db = get_db()
    company_id = get_logistics_company_id_for_user(db, current_user.user_id)

    docs = db.collection("trucks").where("logistics_company_id", "==", company_id).stream()
    trucks = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        trucks.append(TruckOut(**data))
    return trucks


@router.post("", response_model=TruckOut, status_code=status.HTTP_201_CREATED)
def create_truck(
    body: TruckCreate,
    current_user: CurrentUser = Depends(require_role("logistics")),
):
    db = get_db()
    company_id = get_logistics_company_id_for_user(db, current_user.user_id)

    truck_ref = db.collection("trucks").document()
    truck_ref.set(
        {
            "logistics_company_id": company_id,
            "plate_number": body.plate_number,
            "capacity_weight_kg": body.capacity_weight_kg,
            "capacity_volume_m3": body.capacity_volume_m3,
            "status": "available",
        }
    )

    data = truck_ref.get().to_dict()
    data["id"] = truck_ref.id
    return TruckOut(**data)
