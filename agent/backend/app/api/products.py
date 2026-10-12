from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, selectinload
from app.database import get_db
from app.models.models import Product, OrderItem, Order
from app.schemas.schemas import (
    ProductResponse,
    ProductDetailResponse,
    ProductCreate,
    ProductDuplicateCheckRequest,
    ProductDuplicateCheckResponse,
    DocumentExtractResponse
)
from app.services.analytics_service import get_product_response
from app.services.product_creation_service import create_product_record, check_product_duplicates
from app.agent.document_extractor import extract_product_information

router = APIRouter(prefix="/products", tags=["Products"])

@router.get("", response_model=None)
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    stock_status: Optional[str] = Query(None),
    sort_by: str = Query("revenue"),
    sort_order: str = Query("desc"),
    db: Session = Depends(get_db)
):
    query = db.query(Product).options(
        selectinload(Product.order_items).selectinload(OrderItem.order)
    )

    is_filtered = bool(search or category)
    if search:
        s_term = f"%{search.strip()}%"
        query = query.filter(Product.name.ilike(s_term))

    if category:
        query = query.filter(Product.category == category)

    products = query.all()
    product_objs = [get_product_response(p) for p in products]

    if stock_status:
        product_objs = [p for p in product_objs if p.stock_status.lower() == stock_status.lower()]

    # Summary metrics across all products in DB (reuse if unfiltered)
    if not is_filtered:
        all_objs = product_objs
        total_prods_count = len(products)
    else:
        all_all = db.query(Product).options(
            selectinload(Product.order_items).selectinload(OrderItem.order)
        ).all()
        all_objs = [get_product_response(p) for p in all_all]
        total_prods_count = len(all_all)

    tot_catalog_revenue = sum(p.revenue for p in all_objs)
    tot_profit = sum(p.gross_profit for p in all_objs)
    avg_margin = round((tot_profit / tot_catalog_revenue * 100.0), 1) if tot_catalog_revenue > 0 else 0.0

    # Sort
    reverse = (sort_order.lower() == "desc")
    if sort_by == "name":
        product_objs.sort(key=lambda x: x.name.lower(), reverse=reverse)
    elif sort_by == "revenue":
        product_objs.sort(key=lambda x: x.revenue, reverse=reverse)
    elif sort_by == "units_sold":
        product_objs.sort(key=lambda x: x.units_sold, reverse=reverse)
    elif sort_by == "gross_profit":
        product_objs.sort(key=lambda x: x.gross_profit, reverse=reverse)
    elif sort_by == "stock_quantity":
        product_objs.sort(key=lambda x: x.stock_quantity, reverse=reverse)
    elif sort_by == "gross_margin_percent":
        product_objs.sort(key=lambda x: x.gross_margin_percent, reverse=reverse)

    total_filtered = len(product_objs)
    offset = (page - 1) * page_size
    paged = product_objs[offset : offset + page_size]
    total_pages = max(1, (total_filtered + page_size - 1) // page_size)

    return {
        "summary": {
            "total_products": total_prods_count,
            "total_revenue": round(tot_catalog_revenue, 2),
            "average_margin": avg_margin,
            "total_units_sold": sum(p.units_sold for p in all_objs)
        },
        "items": paged,
        "total": total_filtered,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

@router.get("/{product_id}", response_model=ProductDetailResponse)
def get_product_detail(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    base = get_product_response(product)

    # Sales history
    sales_history = []
    for item in sorted(product.order_items, key=lambda x: x.order.order_date, reverse=True)[:30]:
        sales_history.append({
            "order_id": item.order_id,
            "order_date": item.order.order_date.strftime("%Y-%m-%d"),
            "customer_name": item.order.customer.name if item.order.customer else "Unknown",
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "total_price": round(item.quantity * item.unit_price, 2),
            "status": item.order.status
        })

    # Movement history
    movements = []
    for m in sorted(product.movements, key=lambda x: x.created_at, reverse=True)[:30]:
        movements.append({
            "id": m.id,
            "quantity_change": m.quantity_change,
            "movement_type": m.movement_type,
            "reason": m.reason,
            "created_at": m.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })

    return ProductDetailResponse(
        id=base.id,
        name=base.name,
        category=base.category,
        selling_price=base.selling_price,
        unit_cost=base.unit_cost,
        stock_quantity=base.stock_quantity,
        reorder_threshold=base.reorder_threshold,
        sku=base.sku,
        barcode=base.barcode,
        description=base.description,
        supplier=base.supplier,
        image_url=base.image_url,
        created_at=base.created_at,
        updated_at=base.updated_at,
        units_sold=base.units_sold,
        revenue=base.revenue,
        gross_profit=base.gross_profit,
        gross_margin_percent=base.gross_margin_percent,
        stock_status=base.stock_status,
        inventory_value=base.inventory_value,
        sales_history=sales_history,
        inventory_movements=movements
    )

@router.get("/{product_id}/sales", response_model=List[Dict[str, Any]])
def get_product_sales_orders(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    items = db.query(OrderItem).filter(OrderItem.product_id == product_id).all()
    results = []
    for item in sorted(items, key=lambda x: x.order.order_date, reverse=True):
        results.append({
            "order_id": item.order_id,
            "order_date": item.order.order_date.strftime("%Y-%m-%d"),
            "customer_id": item.order.customer_id,
            "customer_name": item.order.customer.name if item.order.customer else "Unknown",
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "total_price": round(item.quantity * item.unit_price, 2),
            "status": item.order.status,
            "region": item.order.region,
            "sales_channel": item.order.sales_channel
        })
    return results

@router.post("", response_model=ProductResponse, status_code=201)
def create_product(product_data: ProductCreate, db: Session = Depends(get_db)):
    """
    Create a new product in the catalog with full schema validation and duplicate checks.
    """
    return create_product_record(db=db, product_data=product_data)

@router.post("/check-duplicates", response_model=ProductDuplicateCheckResponse)
def check_duplicates(request: ProductDuplicateCheckRequest, db: Session = Depends(get_db)):
    """
    Pre-check extracted line items against the catalog before insertion.
    Classifies items as already_exists, new_product, possible_duplicate, or insufficient_info.
    """
    results = check_product_duplicates(db=db, items=request.items)
    return ProductDuplicateCheckResponse(results=results)

@router.post("/extract-from-image", response_model=DocumentExtractResponse)
async def extract_from_image(file: UploadFile = File(...)):
    """
    Extract product line items from an uploaded image or document using AI vision.
    Filters out unrelated metadata (tracking numbers, orders, shipping fees, totals).
    """
    content = await file.read()
    return await extract_product_information(
        file_bytes=content,
        filename=file.filename or "uploaded_document",
        content_type=file.content_type or "application/octet-stream"
    )

