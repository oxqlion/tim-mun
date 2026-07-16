"""Seed script — creates demo users, warehouses, trucks, and pickup requests.

Run: cd backend && source .venv/bin/activate && python seed.py
Requires Firestore emulator to be running.
"""

from datetime import datetime, timezone

from app.core.security import hash_password
from app.db.firestore import get_db


def seed():
    db = get_db()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # =========================================================================
    # WAREHOUSE USERS (4 warehouses across West Java)
    # =========================================================================

    warehouses = [
        {
            "user": {"name": "Pak Tani", "email": "warehouse1@demo.com", "phone": "081234567890"},
            "warehouse": {"name": "Gudang Padi Bandung", "address": "Jl. Raya Cimahi No. 10, Bandung", "lat": -6.8721, "lng": 107.5421},
        },
        {
            "user": {"name": "Bu Sari", "email": "warehouse2@demo.com", "phone": "081234567891"},
            "warehouse": {"name": "Gudang Sayur Lembang", "address": "Jl. Grand Hotel No. 5, Lembang", "lat": -6.8115, "lng": 107.6174},
        },
        {
            "user": {"name": "Haji Udin", "email": "warehouse3@demo.com", "phone": "081234567892"},
            "warehouse": {"name": "Gudang Buah Subang", "address": "Jl. Otista No. 23, Subang", "lat": -6.5714, "lng": 107.7524},
        },
        {
            "user": {"name": "Ibu Ratna", "email": "warehouse4@demo.com", "phone": "081234567893"},
            "warehouse": {"name": "Gudang Rempah Garut", "address": "Jl. Siliwangi No. 8, Garut", "lat": -7.2106, "lng": 107.9054},
        },
    ]

    warehouse_ids = []
    for wh in warehouses:
        user_ref = db.collection("users").document()
        user_ref.set({
            "name": wh["user"]["name"],
            "role": "warehouse",
            "phone": wh["user"]["phone"],
            "email": wh["user"]["email"],
            "password_hash": hash_password("password123"),
            "created_at": datetime.now(timezone.utc),
        })
        wh_ref = db.collection("warehouses").document()
        wh_ref.set({"user_id": user_ref.id, **wh["warehouse"]})
        warehouse_ids.append(wh_ref.id)
        print(f"  ✓ Warehouse: {wh['user']['email']} — {wh['warehouse']['name']}")

    # =========================================================================
    # LOGISTICS USER + TRUCKS
    # =========================================================================

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
    company_ref.set({"user_id": log_user_ref.id, "name": "PT Angkut Sejahtera"})

    trucks_data = [
        {"vehicle_type": "truck_medium", "plate_number": "B 1234 XYZ", "capacity_weight_kg": 5000, "length_cm": 400, "width_cm": 200, "height_cm": 200},
        {"vehicle_type": "truck_large", "plate_number": "B 5678 ABC", "capacity_weight_kg": 10000, "length_cm": 600, "width_cm": 240, "height_cm": 240},
        {"vehicle_type": "truck_small", "plate_number": "B 9012 DEF", "capacity_weight_kg": 2500, "length_cm": 300, "width_cm": 180, "height_cm": 180},
    ]

    for t in trucks_data:
        db.collection("trucks").document().set({
            "logistics_company_id": company_ref.id,
            **t,
            "capacity_volume_m3": None,
            "status": "available",
        })

    print(f"  ✓ Logistics: logistics@demo.com — PT Angkut Sejahtera ({len(trucks_data)} trucks)")

    # =========================================================================
    # PICKUP REQUESTS (6 requests from 4 warehouses, various destinations)
    # =========================================================================

    from datetime import timedelta
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    day_after = (datetime.now(timezone.utc) + timedelta(days=2)).strftime("%Y-%m-%d")

    # NOTE: Dimensions are per CONTAINER/PALLET, not per individual item.
    # quantity = number of containers/pallets, each with the given dimensions.
    requests_data = [
        # Warehouse 1 (Bandung) → Jakarta Barat
        {
            "warehouse_idx": 0,
            "pickup_date": today,
            "required_arrival_date": today,
            "destination_name": "Pasar Tanah Abang, Jakarta Barat",
            "destination_lat": -6.1862,
            "destination_lng": 106.8126,
            "notes": "Beras premium, handle with care",
            "items": [
                {"commodity_name": "Beras Premium", "unit_type": "sack", "quantity": 5, "estimated_weight_kg": 2500, "length_cm": 120, "width_cm": 100, "height_cm": 80, "stackable": True, "fragile": False},
                {"commodity_name": "Beras Organik", "unit_type": "sack", "quantity": 3, "estimated_weight_kg": 1250, "length_cm": 120, "width_cm": 100, "height_cm": 60, "stackable": True, "fragile": False},
            ],
        },
        # Warehouse 2 (Lembang) → Jakarta Selatan
        {
            "warehouse_idx": 1,
            "pickup_date": today,
            "required_arrival_date": tomorrow,
            "destination_name": "Pasar Minggu, Jakarta Selatan",
            "destination_lat": -6.2884,
            "destination_lng": 106.8440,
            "notes": "Sayuran segar, jangan kena panas",
            "items": [
                {"commodity_name": "Wortel", "unit_type": "kg", "quantity": 2, "estimated_weight_kg": 500, "length_cm": 120, "width_cm": 80, "height_cm": 60, "stackable": True, "fragile": False},
                {"commodity_name": "Tomat", "unit_type": "kg", "quantity": 2, "estimated_weight_kg": 300, "length_cm": 100, "width_cm": 80, "height_cm": 50, "stackable": False, "fragile": True},
                {"commodity_name": "Brokoli", "unit_type": "kg", "quantity": 1, "estimated_weight_kg": 200, "length_cm": 100, "width_cm": 80, "height_cm": 50, "stackable": False, "fragile": True},
            ],
        },
        # Warehouse 3 (Subang) → Jakarta Timur
        {
            "warehouse_idx": 2,
            "pickup_date": today,
            "required_arrival_date": tomorrow,
            "destination_name": "Pasar Induk Kramat Jati, Jakarta Timur",
            "destination_lat": -6.2728,
            "destination_lng": 106.8686,
            "notes": None,
            "items": [
                {"commodity_name": "Nanas", "unit_type": "pallet", "quantity": 2, "estimated_weight_kg": 800, "length_cm": 120, "width_cm": 100, "height_cm": 80, "stackable": True, "fragile": False},
                {"commodity_name": "Mangga Harum Manis", "unit_type": "pallet", "quantity": 2, "estimated_weight_kg": 600, "length_cm": 120, "width_cm": 100, "height_cm": 60, "stackable": False, "fragile": True},
            ],
        },
        # Warehouse 4 (Garut) → Jakarta Barat (same direction as warehouse 1!)
        {
            "warehouse_idx": 3,
            "pickup_date": today,
            "required_arrival_date": today,
            "destination_name": "Pasar Tanah Abang, Jakarta Barat",
            "destination_lat": -6.1862,
            "destination_lng": 106.8126,
            "notes": "Rempah-rempah kering",
            "items": [
                {"commodity_name": "Jahe Merah", "unit_type": "sack", "quantity": 1, "estimated_weight_kg": 200, "length_cm": 100, "width_cm": 80, "height_cm": 60, "stackable": True, "fragile": False},
                {"commodity_name": "Kunyit", "unit_type": "sack", "quantity": 1, "estimated_weight_kg": 150, "length_cm": 100, "width_cm": 80, "height_cm": 50, "stackable": True, "fragile": False},
            ],
        },
        # Warehouse 1 (Bandung) → Bekasi
        {
            "warehouse_idx": 0,
            "pickup_date": today,
            "required_arrival_date": day_after,
            "destination_name": "Pasar Baru Bekasi",
            "destination_lat": -6.2383,
            "destination_lng": 106.9756,
            "notes": None,
            "items": [
                {"commodity_name": "Tepung Beras", "unit_type": "sack", "quantity": 4, "estimated_weight_kg": 2000, "length_cm": 120, "width_cm": 100, "height_cm": 80, "stackable": True, "fragile": False},
            ],
        },
        # Warehouse 2 (Lembang) → Bekasi (same direction as above!)
        {
            "warehouse_idx": 1,
            "pickup_date": today,
            "required_arrival_date": day_after,
            "destination_name": "Pasar Baru Bekasi",
            "destination_lat": -6.2383,
            "destination_lng": 106.9756,
            "notes": "Kentang, jangan ditumpuk",
            "items": [
                {"commodity_name": "Kentang", "unit_type": "pallet", "quantity": 1, "estimated_weight_kg": 400, "length_cm": 120, "width_cm": 100, "height_cm": 80, "stackable": False, "fragile": False},
            ],
        },
    ]

    for req in requests_data:
        wh_id = warehouse_ids[req["warehouse_idx"]]
        request_ref = db.collection("pickup_requests").document()
        request_ref.set({
            "warehouse_id": wh_id,
            "pickup_date": req["pickup_date"],
            "required_arrival_date": req["required_arrival_date"],
            "destination_name": req["destination_name"],
            "destination_lat": req["destination_lat"],
            "destination_lng": req["destination_lng"],
            "notes": req["notes"],
            "status": "pending",
            "estimated_arrival": None,
            "created_at": datetime.now(timezone.utc),
        })
        for item in req["items"]:
            db.collection("request_items").document().set({
                "pickup_request_id": request_ref.id,
                **item,
            })
        print(f"  ✓ Request: {req['destination_name']} ({len(req['items'])} items)")

    print(f"\n{'='*60}")
    print("SEED COMPLETE")
    print(f"{'='*60}")
    print(f"\nLogin credentials (all password: password123):")
    print(f"  Logistics: logistics@demo.com")
    print(f"  Warehouse 1: warehouse1@demo.com (Bandung)")
    print(f"  Warehouse 2: warehouse2@demo.com (Lembang)")
    print(f"  Warehouse 3: warehouse3@demo.com (Subang)")
    print(f"  Warehouse 4: warehouse4@demo.com (Garut)")
    print(f"\n  {len(requests_data)} pickup requests ready for today ({today})")
    print(f"  3 trucks available")
    print(f"\n  Test: login as logistics@demo.com → Plans → Generate Plan")


if __name__ == "__main__":
    seed()
