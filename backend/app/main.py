from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, pickup_requests, routes, trucks
from app.core.config import settings

app = FastAPI(title="Agri-logistics POC API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(pickup_requests.router)
app.include_router(trucks.router)
app.include_router(routes.router)


@app.get("/health")
def health():
    return {"status": "ok"}
