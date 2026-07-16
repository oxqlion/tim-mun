"""Seed script — creates 1 warehouse user + 1 logistics user with sample data.

Run: cd backend && source .venv/bin/activate && python seed.py
Requires Firestore emulator to be running.
"""

from datetime import datetime, timezone

from app.core.security import hash_password
from app.db.firestore import get_db


def seed():
    db = get_db()

    # --- Warehouse user ---
    wh_user_ref = db.collection("users").document()
    wh_user_ref.set({
        "name": "Pak Tani",
        "role": "warehouse",
        "phone": "081234567890",
        "email": "warehouse@demo.com",
        "password_hash": hash_password("password123"),
        "created_at": datetime.now(timezone.utc),
    })

    db.collection("warehouses").document().set({
        "user_id": wh_user_ref.id,
        "name": "Gudang Padi Bandung",
        "address": "Jl. Raya Cimahi No. 10, Bandung",
        "lat": -6.8721,
        "lng": 107.5421,
    })

    print(f"✓ Warehouse user created: warehouse@demo.com / password123 (id: {wh_user_ref.id})")

    # --- Logistics user ---
    log_user_ref = db.collection("users").document()
    log_user_ref.set({
        "name": "Budi Transporter",
        "role": "logistics",
        "phone": "089876543210",
        "email": "logistics@demo.com",
        "password_hash": hash_password("password123"),
        "created_at": datetime.now(timezone.utc),
    })

    company_ref = db.collection("logistics_companies").document()
    company_ref.set({
        "user_id": log_user_ref.id,
        "name": "PT Angkut Sejahtera",
    })

    # Add 2 sample trucks
    db.collection("trucks").document().set({
        "logistics_company_id": company_ref.id,
        "vehicle_type": "truck_medium",
        "plate_number": "B 1234 XYZ",
        "capacity_weight_kg": 5000,
        "capacity_volume_m3": None,
        "length_cm": 400,
        "width_cm": 200,
        "height_cm": 200,
        "status": "available",
    })

    db.collection("trucks").document().set({
        "logistics_company_id": company_ref.id,
        "vehicle_type": "truck_large",
        "plate_number": "B 5678 ABC",
        "capacity_weight_kg": 10000,
        "capacity_volume_m3": None,
        "length_cm": 600,
        "width_cm": 240,
        "height_cm": 240,
        "status": "available",
    })

    print(f"✓ Logistics user created: logistics@demo.com / password123 (id: {log_user_ref.id})")
    print(f"  Company: PT Angkut Sejahtera (id: {company_ref.id})")
    print("  Trucks: B 1234 XYZ (5t), B 5678 ABC (10t)")


if __name__ == "__main__":
    seed()
    print("\n✓ Seeding complete!")
