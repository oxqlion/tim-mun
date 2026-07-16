from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel

from app.schemas.route import RouteOut

PlanStatus = Literal["draft", "optimized", "approved", "in_transit", "completed"]


class TransportationPlanCreate(BaseModel):
    """Request body to generate a new transportation plan."""
    plan_date: date


class TransportationPlanOut(BaseModel):
    """Full transportation plan with routes and optimization results."""
    id: str
    logistics_company_id: str
    plan_date: date
    status: PlanStatus
    total_requests: int = 0
    total_trucks_used: int = 0
    total_distance_km: Optional[float] = None
    estimated_fuel_liters: Optional[float] = None
    fuel_savings_percent: Optional[float] = None
    created_at: datetime
    approved_at: Optional[datetime] = None
    optimization_log: list[str] = []
    routes: List[RouteOut] = []


class TransportationPlanSummary(BaseModel):
    """Lightweight plan listing without nested routes."""
    id: str
    logistics_company_id: str
    plan_date: date
    status: PlanStatus
    total_requests: int = 0
    total_trucks_used: int = 0
    total_distance_km: Optional[float] = None
    estimated_fuel_liters: Optional[float] = None
    fuel_savings_percent: Optional[float] = None
    created_at: datetime
    approved_at: Optional[datetime] = None
