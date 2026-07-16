from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel

from app.schemas.route import RouteOut

UnitType = Literal["kg", "sack", "pallet"]
RequestStatus = Literal["pending", "matched", "in_progress", "completed", "cancelled"]


class RequestItemIn(BaseModel):
    commodity_name: str
    unit_type: UnitType
    quantity: float
    estimated_weight_kg: Optional[float] = None
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None


class RequestItemOut(RequestItemIn):
    id: str
    pickup_request_id: str


class PickupRequestCreate(BaseModel):
    pickup_date: date
    destination_name: str
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    items: List[RequestItemIn]


class PickupRequestOut(BaseModel):
    id: str
    warehouse_id: str
    pickup_date: date
    destination_name: str
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    status: RequestStatus
    created_at: datetime
    estimated_arrival: Optional[datetime] = None
    items: List[RequestItemOut] = []
    matched_route: Optional[RouteOut] = None
