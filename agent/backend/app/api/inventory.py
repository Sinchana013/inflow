from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from app.database import get_db
from app.models.models import Product
from app.schemas.schemas import (
    ProductResponse, StockAdjustmentRequest, InventoryMovementResponse, InventoryAlertResponse
)
from app.services.inventory_service import adjust_product_stock, get_product_movements, get_inventory_alerts
from app.services.analytics_service import get_product_response

router = APIRouter(prefix="/inventory", tags=["Inventory"])

@router.get("", response_model=None)
def list_inventory(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    stock_status: Optional[str] = Query(None),
    sort_by: str = Query("stock_quantity"),
    sort_order: str = Query("asc"),
    db: Session = Depends(get_db)
):
    query = db.query(Product)

    if search:
        s_term = f"%{search.strip()}%"
        query = query.filter(Product.name.ilike(s_term))

    if category:
        query = query.filter(Product.category == category)

    all_products = query.all()

    # Compute stats across filtered/unfiltered universe
    all_all = db.query(Product).all()
    total_products = len(all_all)
    total_units = sum(p.stock_quantity for p in all_all)
    low_stock_count = sum(1 for p in all_all if 0 < p.stock_quantity <= p.reorder_threshold)
    out_of_stock_count = sum(1 for p in all_all if p.stock_quantity <= 0)
    inventory_val = sum(p.stock_quantity * p.unit_cost for p in all_all)

    # Convert to ProductResponse
    product_responses = [get_product_response(p) for p in all_products]

    if stock_status:
        product_responses = [p for p in product_responses if p.stock_status.lower() == stock_status.lower()]

    # Sort
    reverse = (sort_order.lower() == "desc")
    if sort_by == "name":
        product_responses.sort(key=lambda x: x.name.lower(), reverse=reverse)
    elif sort_by == "stock_quantity":
        product_responses.sort(key=lambda x: x.stock_quantity, reverse=reverse)
    elif sort_by == "inventory_value":
        product_responses.sort(key=lambda x: x.inventory_value, reverse=reverse)
    elif sort_by == "units_sold":
        product_responses.sort(key=lambda x: x.units_sold, reverse=reverse)

    total_filtered = len(product_responses)
    offset = (page - 1) * page_size
    paged_items = product_responses[offset : offset + page_size]
    total_pages = max(1, (total_filtered + page_size - 1) // page_size)

    return {
        "summary": {
            "total_products": total_products,
            "total_units": total_units,
            "low_stock_count": low_stock_count,
            "out_of_stock_count": out_of_stock_count,
            "inventory_valuation": round(inventory_val, 2)
        },
        "items": paged_items,
        "total": total_filtered,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

@router.get("/alerts", response_model=List[InventoryAlertResponse])
def inventory_alerts(db: Session = Depends(get_db)):
    return get_inventory_alerts(db)

@router.patch("/{product_id}", response_model=ProductResponse)
def update_product_stock(
    product_id: int,
    adjustment: StockAdjustmentRequest,
    db: Session = Depends(get_db)
):
    try:
        updated_prod = adjust_product_stock(db, product_id, adjustment)
        return get_product_response(updated_prod)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/{product_id}/movements", response_model=List[InventoryMovementResponse])
def get_movements(
    product_id: int,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    return get_product_movements(db, product_id, limit=limit)
