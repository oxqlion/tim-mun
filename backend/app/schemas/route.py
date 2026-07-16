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
    location_name: Optional[str] = None  # warehouse name for pickup, destination for dropoff


class SpaceAllocationOut(BaseModel):
    id: str
    route_id: str
    pickup_request_id: str
    item_id: str
    commodity_name: str = ""
    loading_sequence: int
    position_notes: Optional[str] = None
    weight_kg: float
    volume_m3: float


class RouteOut(BaseModel):
    id: str
    transportation_plan_id: Optional[str] = None
    truck_id: str
    truck_plate_number: Optional[str] = None
    truck_vehicle_type: Optional[str] = None
    route_date: date
    status: RouteStatus
    total_distance_km: Optional[float] = None
    space_utilization_percent: Optional[float] = None
    weight_utilization_percent: Optional[float] = None
    generated_at: datetime
    stops: List[RouteStopOut] = []
    space_allocations: List[SpaceAllocationOut] = []


class GenerateRoutesRequest(BaseModel):
    date: date


class RouteStopUpdate(BaseModel):
    status: Literal["pending", "in_progress", "completed"]
