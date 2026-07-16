from pydantic import BaseModel


class LogisticsCompanyOut(BaseModel):
    id: str
    user_id: str
    name: str
