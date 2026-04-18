from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine

# Import models so SQLAlchemy registers all tables before create_all()
from app.models import *  # noqa: F401,F403

# Import route modules
from app.routes import auth, users, orders, reports, saas, breakeven_report, inventory, audit

# Create tables on startup (fine for local/dev; later we can move to Alembic)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="UMG Production and BD Management",
    version="1.0.0",
)

# Explicit origins are recommended for browser auth flows.
# Your frontend is currently running on localhost:3001.
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(orders.router)
app.include_router(reports.router)
app.include_router(saas.router)
app.include_router(breakeven_report.router)
app.include_router(inventory.router)
app.include_router(audit.router)

# Core production modules


@app.get("/", tags=["Health"])
def root():
    return {"message": "UMG Production and BD Management API is running"}


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}