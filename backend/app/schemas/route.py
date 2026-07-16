from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel

RouteStatus = Literal["planned", "in_progress", "completed"]
StopType = Literal["pickup", "dropoff"]


class RouteStopOut(BaseModel):
    id: str
    route_id: str
    pickup_request_id: str
    stop_sequence: int
    stop_type: StopType
    lat: Optional[float] = None
    lng: Optional[float] = None
    eta: Optional[datetime] = None
    allocated_weight_kg: Optional[float] = None
    allocated_volume_m3: Optional[float] = None
    status: Literal["pending", "in_progress", "completed"] = "pending"


class RouteOut(BaseModel):
    id: str
    truck_id: str
    route_date: date
    status: RouteStatus
    total_distance_km: Optional[float] = None
    generated_at: datetime
    stops: List[RouteStopOut] = []


class GenerateRoutesRequest(BaseModel):
    date: date


class RouteStopUpdate(BaseModel):
    status: Literal["pending", "in_progress", "completed"]
