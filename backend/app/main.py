from pathlib import Path
import os

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


# =========================================================
# Database
# =========================================================
# Fine for local/dev. For production, later move this to Alembic migrations.
Base.metadata.create_all(bind=engine)


# =========================================================
# App
# =========================================================
app = FastAPI(
    title="UMG Production and BD Management",
    version="1.0.0",
)


# =========================================================
# CORS
# =========================================================
def parse_cors_origins():
    """
    Supports both hardcoded defaults and Render environment variables.

    In Render, you can set:
    CORS_ORIGINS=https://www.tihidyprojects.org,https://tihidyprojects.org,http://localhost:3000
    """

    default_origins = [
        # Local frontend
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",

        # Live custom domain
        "https://tihidyprojects.org",
        "https://www.tihidyprojects.org",

        # Render frontend/backend URLs for testing
        "https://primegateanalytics-1.onrender.com",
        "https://primegateanalytics-2.onrender.com",
    ]

    env_origins = os.getenv("CORS_ORIGINS", "")
    parsed_env_origins = [
        origin.strip().rstrip("/")
        for origin in env_origins.split(",")
        if origin.strip()
    ]

    all_origins = default_origins + parsed_env_origins

    # Remove duplicates while preserving order
    unique_origins = []
    seen = set()

    for origin in all_origins:
        clean_origin = origin.strip().rstrip("/")
        if clean_origin and clean_origin not in seen:
            seen.add(clean_origin)
            unique_origins.append(clean_origin)

    return unique_origins


allowed_origins = parse_cors_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# Static storage
# =========================================================
storage_dir = Path("storage")
storage_dir.mkdir(parents=True, exist_ok=True)

(storage_dir / "byproducts" / "generated").mkdir(parents=True, exist_ok=True)
(storage_dir / "byproducts" / "templates").mkdir(parents=True, exist_ok=True)

app.mount(
    "/storage",
    StaticFiles(directory=str(storage_dir)),
    name="storage",
)


# =========================================================
# Routers
# =========================================================
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(orders.router)
app.include_router(reports.router)
app.include_router(saas.router)
app.include_router(breakeven_report.router)
app.include_router(inventory.router)
app.include_router(audit.router)
app.include_router(byproducts.router)


# =========================================================
# Health checks
# =========================================================
@app.get("/", tags=["Health"])
def root():
    return {
        "message": "UMG Production and BD Management API is running",
        "status": "ok",
    }


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}