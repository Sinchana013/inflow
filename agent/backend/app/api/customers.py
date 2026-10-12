from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, selectinload
from app.database import get_db
from app.models.models import Customer, Order
from app.schemas.schemas import CustomerResponse, CustomerDetailResponse, OrderResponse
from app.services.analytics_service import get_reference_now, get_customer_response

router = APIRouter(prefix="/customers", tags=["Customers"])

@router.get("", response_model=None)
def list_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    segment: Optional[str] = Query(None),
    sort_by: str = Query("total_revenue"),
    sort_order: str = Query("desc"),
    db: Session = Depends(get_db)
):
    now = get_reference_now(db)
    query = db.query(Customer).options(
        selectinload(Customer.orders).selectinload(Order.items)
    )

    is_filtered = bool(search or region)
    if search:
        s_term = f"%{search.strip()}%"
        query = query.filter((Customer.name.ilike(s_term)) | (Customer.email.ilike(s_term)))

    if region:
        query = query.filter(Customer.region == region)

    customers = query.all()

    # Convert to response objects with deterministic segments
    customer_objs = [get_customer_response(c, now) for c in customers]

    # Summary metrics across all customers in DB (reuse if unfiltered)
    if not is_filtered:
        all_responses = customer_objs
    else:
        all_customers = db.query(Customer).options(
            selectinload(Customer.orders).selectinload(Order.items)
        ).all()
        all_responses = [get_customer_response(c, now) for c in all_customers]
    total_customers = len(all_responses)
    new_customers_period = sum(1 for c in all_responses if (now - c.registration_date).days <= 45)
    repeat_customers = sum(1 for c in all_responses if c.total_orders >= 2)
    repeat_pct = round((repeat_customers / total_customers * 100.0), 1) if total_customers > 0 else 0.0
    tot_sys_rev = sum(c.total_revenue for c in all_responses)
    avg_lifetime_revenue = round((tot_sys_rev / total_customers), 2) if total_customers > 0 else 0.0

    # Sort
    reverse = (sort_order.lower() == "desc")
    if sort_by == "name":
        customer_objs.sort(key=lambda x: x.name.lower(), reverse=reverse)
    elif sort_by == "total_revenue":
        customer_objs.sort(key=lambda x: x.total_revenue, reverse=reverse)
    elif sort_by == "total_orders":
        customer_objs.sort(key=lambda x: x.total_orders, reverse=reverse)
    elif sort_by == "registration_date":
        customer_objs.sort(key=lambda x: x.registration_date, reverse=reverse)

    total_filtered = len(customer_objs)
    offset = (page - 1) * page_size
    paged = customer_objs[offset : offset + page_size]
    total_pages = max(1, (total_filtered + page_size - 1) // page_size)

    return {
        "summary": {
            "total_customers": total_customers,
            "new_customers": new_customers_period,
            "repeat_percentage": repeat_pct,
            "avg_lifetime_revenue": avg_lifetime_revenue
        },
        "items": paged,
        "total": total_filtered,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

@router.get("/{customer_id}", response_model=CustomerDetailResponse)
def get_customer_detail(customer_id: int, db: Session = Depends(get_db)):
    now = get_reference_now(db)
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    base_resp = get_customer_response(customer, now)

    # Calculate recent orders, category preferences, and monthly spend
    recent_orders_list = []
    category_counts: Dict[str, float] = {}
    monthly_data: Dict[str, float] = {}

    for o in sorted(customer.orders, key=lambda x: x.order_date, reverse=True):
        tot = sum(i.quantity * i.unit_price for i in o.items)
        recent_orders_list.append({
            "order_id": o.id,
            "order_date": o.order_date.strftime("%Y-%m-%d"),
            "status": o.status,
            "channel": o.sales_channel,
            "amount": round(tot, 2),
            "items_count": sum(i.quantity for i in o.items)
        })

        if o.status == "Completed":
            m_key = o.order_date.strftime("%b %Y")
            monthly_data[m_key] = monthly_data.get(m_key, 0.0) + tot

            for i in o.items:
                cat = i.product.category
                category_counts[cat] = category_counts.get(cat, 0.0) + (i.quantity * i.unit_price)

    category_prefs = [
        {"category": cat, "spend": round(spd, 2)}
        for cat, spd in sorted(category_counts.items(), key=lambda x: x[1], reverse=True)
    ]

    monthly_spend = [
        {"period": m, "spend": round(spd, 2)}
        for m, spd in monthly_data.items()
    ]

    return CustomerDetailResponse(
        id=base_resp.id,
        name=base_resp.name,
        email=base_resp.email,
        region=base_resp.region,
        registration_date=base_resp.registration_date,
        created_at=base_resp.created_at,
        total_orders=base_resp.total_orders,
        total_revenue=base_resp.total_revenue,
        last_order_date=base_resp.last_order_date,
        segment=base_resp.segment,
        recent_orders=recent_orders_list,
        category_preferences=category_prefs,
        monthly_spend=monthly_spend
    )

@router.get("/{customer_id}/orders", response_model=List[OrderResponse])
def get_customer_orders(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    res = []
    for o in sorted(customer.orders, key=lambda x: x.order_date, reverse=True):
        tot = sum(i.quantity * i.unit_price for i in o.items)
        tot_qty = sum(i.quantity for i in o.items)
        summary = ", ".join([f"{i.product.name} (x{i.quantity})" for i in o.items[:2]])
        if len(o.items) > 2:
            summary += f" +{len(o.items)-2} more"

        res.append(OrderResponse(
            id=o.id,
            customer_id=o.customer_id,
            customer_name=customer.name,
            customer_email=customer.email,
            order_date=o.order_date,
            region=o.region,
            sales_channel=o.sales_channel,
            status=o.status,
            created_at=o.created_at,
            total_amount=round(tot, 2),
            total_items=tot_qty,
            items_summary=summary
        ))
    return res
