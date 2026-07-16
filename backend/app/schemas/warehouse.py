from typing import Optional

from pydantic import BaseModel


class WarehouseOut(BaseModel):
    id: str
    user_id: str
    name: str
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
