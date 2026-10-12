import io
import csv
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import desc, asc, or_
from app.database import get_db
from app.models.models import Order, OrderItem, Customer, Product
from app.schemas.schemas import OrderResponse, OrderDetailResponse, OrderItemResponse, SalesAnalyticsResponse
from app.services.analytics_service import get_sales_analytics

router = APIRouter(prefix="/sales", tags=["Sales"])

@router.get("", response_model=None)
def list_sales(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    search: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    product_id: Optional[int] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    sort_by: str = Query("order_date"),
    sort_order: str = Query("desc"),
    export_csv: bool = Query(False),
    db: Session = Depends(get_db)
):
    query = db.query(Order).join(Customer, Order.customer_id == Customer.id)

    if search:
        s_term = f"%{search.strip()}%"
        try:
            order_id_search = int(search.strip().replace("#", ""))
            query = query.filter(or_(
                Order.id == order_id_search,
                Customer.name.ilike(s_term),
                Customer.email.ilike(s_term)
            ))
        except ValueError:
            query = query.filter(or_(
                Customer.name.ilike(s_term),
                Customer.email.ilike(s_term)
            ))

    if region:
        query = query.filter(Order.region == region)
    if channel:
        query = query.filter(Order.sales_channel == channel)
    if status:
        query = query.filter(Order.status == status)
    if customer_id:
        query = query.filter(Order.customer_id == customer_id)
    if product_id:
        query = query.join(OrderItem, Order.id == OrderItem.order_id).filter(OrderItem.product_id == product_id)

    if start_date:
        try:
            dt_start = datetime.fromisoformat(start_date)
            query = query.filter(Order.order_date >= dt_start)
        except Exception:
            pass

    if end_date:
        try:
            dt_end = datetime.fromisoformat(end_date)
            query = query.filter(Order.order_date <= dt_end)
        except Exception:
            pass

    # Sorting
    sort_col = Order.order_date
    if sort_by == "id":
        sort_col = Order.id

    if sort_order.lower() == "asc":
        query = query.order_by(asc(sort_col))
    else:
        query = query.order_by(desc(sort_col))

    # CSV Export support
    if export_csv:
        orders = query.options(
            joinedload(Order.customer),
            selectinload(Order.items).joinedload(OrderItem.product)
        ).all()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Order ID", "Date", "Customer ID", "Customer Name", "Customer Email", "Region", "Sales Channel", "Status", "Total Items", "Total Amount"])

        for o in orders:
            tot = sum(i.quantity * i.unit_price for i in o.items)
            tot_qty = sum(i.quantity for i in o.items)
            writer.writerow([
                o.id,
                o.order_date.strftime("%Y-%m-%d %H:%M:%S"),
                o.customer_id,
                o.customer.name if o.customer else "",
                o.customer.email if o.customer else "",
                o.region,
                o.sales_channel,
                o.status,
                tot_qty,
                f"{tot:.2f}"
            ])

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=insightflow_sales_export.csv"}
        )

    total_count = query.count()
    offset = (page - 1) * page_size
    orders = query.options(
        joinedload(Order.customer),
        selectinload(Order.items).joinedload(OrderItem.product)
    ).offset(offset).limit(page_size).all()

    items = []
    for o in orders:
        tot = sum(i.quantity * i.unit_price for i in o.items)
        tot_qty = sum(i.quantity for i in o.items)
        summary = ", ".join([f"{i.product.name} (x{i.quantity})" for i in o.items[:2]])
        if len(o.items) > 2:
            summary += f" +{len(o.items)-2} more"

        items.append(OrderResponse(
            id=o.id,
            customer_id=o.customer_id,
            customer_name=o.customer.name if o.customer else "Unknown",
            customer_email=o.customer.email if o.customer else "",
            order_date=o.order_date,
            region=o.region,
            sales_channel=o.sales_channel,
            status=o.status,
            created_at=o.created_at,
            total_amount=round(tot, 2),
            total_items=tot_qty,
            items_summary=summary
        ))

    total_pages = max(1, (total_count + page_size - 1) // page_size)

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

@router.get("/analytics", response_model=SalesAnalyticsResponse)
def sales_analytics(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    dt_start = datetime.fromisoformat(start_date) if start_date else None
    dt_end = datetime.fromisoformat(end_date) if end_date else None
    return get_sales_analytics(db, dt_start, dt_end, region, channel, status)

@router.get("/{order_id}", response_model=OrderDetailResponse)
def get_order_detail(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")

    items_res = []
    tot = 0.0
    tot_qty = 0
    for i in order.items:
        t_price = i.quantity * i.unit_price
        tot += t_price
        tot_qty += i.quantity
        items_res.append(OrderItemResponse(
            id=i.id,
            order_id=i.order_id,
            product_id=i.product_id,
            product_name=i.product.name if i.product else "",
            category=i.product.category if i.product else "",
            quantity=i.quantity,
            unit_price=i.unit_price,
            unit_cost_at_sale=i.unit_cost_at_sale,
            total_price=round(t_price, 2)
        ))

    summary = ", ".join([f"{i.product.name} (x{i.quantity})" for i in order.items[:2]])
    if len(order.items) > 2:
        summary += f" +{len(order.items)-2} more"

    return OrderDetailResponse(
        id=order.id,
        customer_id=order.customer_id,
        customer_name=order.customer.name if order.customer else "Unknown",
        customer_email=order.customer.email if order.customer else "",
        order_date=order.order_date,
        region=order.region,
        sales_channel=order.sales_channel,
        status=order.status,
        created_at=order.created_at,
        total_amount=round(tot, 2),
        total_items=tot_qty,
        items_summary=summary,
        items=items_res
    )
