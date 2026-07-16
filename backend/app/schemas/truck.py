from typing import Literal, Optional

from pydantic import BaseModel

TruckStatus = Literal["available", "on_trip", "maintenance"]


class TruckCreate(BaseModel):
    plate_number: str
    capacity_weight_kg: float
    capacity_volume_m3: Optional[float] = None


class TruckOut(BaseModel):
    id: str
    logistics_company_id: str
    plate_number: str
    capacity_weight_kg: float
    capacity_volume_m3: Optional[float] = None
    status: TruckStatus
