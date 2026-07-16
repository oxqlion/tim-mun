from fastapi import HTTPException, status
from google.cloud.firestore import Client


def get_warehouse_id_for_user(db: Client, user_id: str) -> str:
    query = db.collection("warehouses").where("user_id", "==", user_id).limit(1).stream()
    for doc in query:
        return doc.id
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse profile not found for user")


def get_logistics_company_id_for_user(db: Client, user_id: str) -> str:
    query = db.collection("logistics_companies").where("user_id", "==", user_id).limit(1).stream()
    for doc in query:
        return doc.id
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Logistics company profile not found for user")
