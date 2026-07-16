from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from google.cloud.firestore import Client

from app.core.auth import create_access_token
from app.core.security import hash_password, verify_password
from app.db.firestore import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def _find_user_by_email(db: Client, email: str) -> dict | None:
    query = db.collection("users").where("email", "==", email).limit(1).stream()
    for doc in query:
        data = doc.to_dict()
        data["id"] = doc.id
        return data
    return None


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest):
    db = get_db()

    if _find_user_by_email(db, body.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    if body.role == "warehouse" and body.warehouse is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="warehouse profile is required for role=warehouse")
    if body.role == "logistics" and body.logistics is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="logistics profile is required for role=logistics")

    user_ref = db.collection("users").document()
    user_ref.set(
        {
            "name": body.name,
            "role": body.role,
            "phone": body.phone,
            "email": body.email,
            "password_hash": hash_password(body.password),
            "created_at": datetime.now(timezone.utc),
        }
    )

    if body.role == "warehouse":
        db.collection("warehouses").document().set(
            {
                "user_id": user_ref.id,
                "name": body.warehouse.name,
                "address": body.warehouse.address,
                "lat": body.warehouse.lat,
                "lng": body.warehouse.lng,
            }
        )
    else:
        db.collection("logistics_companies").document().set(
            {
                "user_id": user_ref.id,
                "name": body.logistics.name,
            }
        )

    token = create_access_token(user_id=user_ref.id, role=body.role)
    return TokenResponse(access_token=token, role=body.role, user_id=user_ref.id)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    db = get_db()
    user = _find_user_by_email(db, body.email)
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(user_id=user["id"], role=user["role"])
    return TokenResponse(access_token=token, role=user["role"], user_id=user["id"])
