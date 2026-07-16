from typing import Literal, Optional

from pydantic import BaseModel

TruckStatus = Literal["available", "on_trip", "maintenance"]
VehicleType = Literal["pickup", "truck_small", "truck_medium", "truck_large"]


class TruckCreate(BaseModel):
    vehicle_type: VehicleType = "truck_medium"
    plate_number: str
    capacity_weight_kg: float
    capacity_volume_m3: Optional[float] = None
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None


class TruckOut(BaseModel):
    id: str
    logistics_company_id: str
    vehicle_type: VehicleType = "truck_medium"
    plate_number: str
    capacity_weight_kg: float
    capacity_volume_m3: Optional[float] = None
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    status: TruckStatus
