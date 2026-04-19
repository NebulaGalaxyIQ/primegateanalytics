from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.database import Base, engine

# Import models so SQLAlchemy registers all tables before create_all()
from app.models import *  # noqa: F401,F403

# Import route modules
from app.routes import (
    audit,
    auth,
    breakeven_report,
    byproducts,
    inventory,
    orders,
    reports,
    saas,
    users,
)

# Create tables on startup (fine for local/dev; later move to Alembic)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="UMG Production and BD Management",
    version="1.0.0",
)

allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "https://primegateanalytics-1.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure storage folders exist and expose them publicly
storage_dir = Path("storage")
storage_dir.mkdir(parents=True, exist_ok=True)
(storage_dir / "byproducts" / "generated").mkdir(parents=True, exist_ok=True)
(storage_dir / "byproducts" / "templates").mkdir(parents=True, exist_ok=True)

app.mount("/storage", StaticFiles(directory=str(storage_dir)), name="storage")

# Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(orders.router)
app.include_router(reports.router)
app.include_router(saas.router)
app.include_router(breakeven_report.router)
app.include_router(inventory.router)
app.include_router(audit.router)
app.include_router(byproducts.router)


@app.get("/", tags=["Health"])
def root():
    return {"message": "UMG Production and BD Management API is running"}


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}