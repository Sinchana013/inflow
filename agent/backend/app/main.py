import aiohttp
if not hasattr(aiohttp, "ClientConnectorDNSError"):
    class ClientConnectorDNSError(aiohttp.ClientConnectorError):
        pass
    aiohttp.ClientConnectorDNSError = ClientConnectorDNSError

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, SessionLocal
from app.seed import seed_database
from app.api.health import router as health_router
from app.api.dashboard import router as dashboard_router
from app.api.sales import router as sales_router
from app.api.inventory import router as inventory_router
from app.api.customers import router as customers_router
from app.api.products import router as products_router
from app.api.reports import router as reports_router
from app.api.analysis import router as analysis_router
from app.api.export import router as export_router

from app.db_migration import ensure_product_schema
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_product_schema(engine)
    db = SessionLocal()
    try:
        seed_database(db, force=False)
    finally:
        db.close()
    yield

app = FastAPI(
    title="InsightFlow AI — Cross-Application Business Analytics API",
    description="Backend analytics engine and data access layer for InsightFlow AI platform.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers under /api
app.include_router(health_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(sales_router, prefix="/api")
app.include_router(inventory_router, prefix="/api")
app.include_router(customers_router, prefix="/api")
app.include_router(products_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(analysis_router, prefix="/api")
app.include_router(export_router, prefix="/api")

@app.get("/")
def root():
    return {
        "message": "Welcome to InsightFlow AI API",
        "documentation": "/docs",
        "health": "/api/health"
    }
