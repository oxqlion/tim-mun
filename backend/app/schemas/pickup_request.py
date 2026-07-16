from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel

from app.schemas.route import RouteOut

UnitType = Literal["kg", "sack", "pallet"]
RequestStatus = Literal["pending", "assigned", "optimized", "in_transit", "completed", "cancelled"]


class RequestItemIn(BaseModel):
    commodity_name: str
    unit_type: UnitType
    quantity: float
    estimated_weight_kg: Optional[float] = None
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    stackable: bool = False
    fragile: bool = False


class RequestItemOut(RequestItemIn):
    id: str
    pickup_request_id: str


class PickupRequestCreate(BaseModel):
    pickup_date: date
    required_arrival_date: date
    destination_name: str
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    notes: Optional[str] = None
    items: List[RequestItemIn]


class PickupRequestOut(BaseModel):
    id: str
    warehouse_id: str
    warehouse_name: Optional[str] = None
    warehouse_address: Optional[str] = None
    pickup_date: date
    required_arrival_date: Optional[date] = None
    destination_name: str
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    notes: Optional[str] = None
    status: RequestStatus
    created_at: datetime
    estimated_arrival: Optional[datetime] = None
    items: List[RequestItemOut] = []
    matched_route: Optional[RouteOut] = None
