from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class WarehouseProfileIn(BaseModel):
    name: str
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class LogisticsProfileIn(BaseModel):
    name: str


class RegisterRequest(BaseModel):
    name: str
    role: Literal["warehouse", "logistics"]
    email: EmailStr
    password: str = Field(min_length=6)
    phone: Optional[str] = None
    warehouse: Optional[WarehouseProfileIn] = None
    logistics: Optional[LogisticsProfileIn] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Literal["warehouse", "logistics"]
    user_id: str
