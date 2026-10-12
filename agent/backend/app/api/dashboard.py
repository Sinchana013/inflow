from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.schemas import DashboardSummaryResponse, RevenueTrendPoint
from app.services.analytics_service import get_dashboard_summary, get_revenue_trend

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary", response_model=DashboardSummaryResponse)
def dashboard_summary(
    days: int = Query(30, ge=1, le=365, description="Number of days for summary metrics"),
    db: Session = Depends(get_db)
):
    return get_dashboard_summary(db, days=days)

@router.get("/revenue-trend", response_model=List[RevenueTrendPoint])
def dashboard_revenue_trend(
    days: int = Query(30, ge=1, le=365, description="Number of days for trend chart"),
    db: Session = Depends(get_db)
):
    return get_revenue_trend(db, days=days)
