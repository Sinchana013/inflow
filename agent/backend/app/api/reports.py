from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.schemas import ReportSummary, CrossModuleInsight
from app.analytics.engine import (
    get_report_monthly_revenue,
    get_report_category_region,
    get_report_product_performance,
    get_report_sales_inventory,
    get_cross_module_insights
)

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/revenue", response_model=ReportSummary)
def report_revenue(db: Session = Depends(get_db)):
    return get_report_monthly_revenue(db)

@router.get("/category-performance", response_model=ReportSummary)
def report_category_performance(db: Session = Depends(get_db)):
    return get_report_category_region(db)

@router.get("/product-performance", response_model=ReportSummary)
def report_product_performance(db: Session = Depends(get_db)):
    return get_report_product_performance(db)

@router.get("/sales-inventory", response_model=ReportSummary)
def report_sales_inventory(db: Session = Depends(get_db)):
    return get_report_sales_inventory(db)

@router.get("/insights", response_model=List[CrossModuleInsight])
def report_cross_module_insights(db: Session = Depends(get_db)):
    return get_cross_module_insights(db)
