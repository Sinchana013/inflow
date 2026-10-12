import time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, desc, and_, or_, case
from app.models.models import Customer, Product, Order, OrderItem, InventoryMovement, BusinessActivity
from app.schemas.schemas import (
    KPICardData, DashboardSummaryResponse, OrderResponse, InventoryAlertResponse,
    BusinessActivityResponse, RevenueTrendPoint, CategoryBreakdownPoint,
    SalesAnalyticsResponse, CustomerResponse, CustomerDetailResponse,
    ProductResponse, ProductDetailResponse
)

# Reference anchor date cache (60s TTL) to prevent repeated network queries
_ref_now_cache = {"timestamp": 0.0, "value": None}

def get_reference_now(db: Session) -> datetime:
    now_ts = time.time()
    if _ref_now_cache["value"] is not None and (now_ts - _ref_now_cache["timestamp"] < 60):
        return _ref_now_cache["value"]

    latest_order = db.query(func.max(Order.order_date)).scalar()
    res = (latest_order + timedelta(days=1)) if latest_order else datetime.utcnow()
    _ref_now_cache["value"] = res
    _ref_now_cache["timestamp"] = now_ts
    return res

def format_currency(val: float) -> str:
    return f"${val:,.2f}"

def format_percentage(val: float) -> str:
    sign = "+" if val > 0 else ""
    return f"{sign}{val:.1f}%"

def calculate_kpi_trend(current: float, previous: float, is_currency: bool = False, is_inverse: bool = False) -> KPICardData:
    change_pct = None
    trend = "neutral"
    if previous and previous > 0:
        change_pct = ((current - previous) / previous) * 100.0
        if change_pct > 0.05:
            trend = "down" if is_inverse else "up"
        elif change_pct < -0.05:
            trend = "up" if is_inverse else "down"

    fmt_val = format_currency(current) if is_currency else f"{current:,.0f}" if isinstance(current, (int, float)) and current.is_integer() else f"{current:,.1f}"
    prev_fmt = format_currency(previous) if (previous is not None and is_currency) else (f"{previous:,.0f}" if previous is not None else None)

    return KPICardData(
        title="",
        value=round(current, 2),
        formatted_value=fmt_val,
        previous_value=round(previous, 2) if previous is not None else None,
        change_percentage=round(change_pct, 1) if change_pct is not None else None,
        trend=trend,
        period_label="vs prev period"
    )

def get_dashboard_summary(db: Session, days: int = 30) -> DashboardSummaryResponse:
    now = get_reference_now(db)
    current_start = now - timedelta(days=days)
    previous_start = current_start - timedelta(days=days)

    # 1. Compute current and previous period sales/units in a SINGLE SQL conditional aggregation query
    totals = db.query(
        func.coalesce(func.sum(case((Order.order_date >= current_start, OrderItem.quantity * OrderItem.unit_price), else_=0.0)), 0.0),
        func.coalesce(func.sum(case((Order.order_date >= current_start, OrderItem.quantity), else_=0)), 0),
        func.coalesce(func.sum(case((Order.order_date < current_start, OrderItem.quantity * OrderItem.unit_price), else_=0.0)), 0.0),
        func.coalesce(func.sum(case((Order.order_date < current_start, OrderItem.quantity), else_=0)), 0)
    ).join(Order, OrderItem.order_id == Order.id).filter(
        Order.order_date >= previous_start,
        Order.order_date < now,
        Order.status == "Completed"
    ).first()

    cur_revenue = float(totals[0]) if totals else 0.0
    cur_units = int(totals[1]) if totals else 0
    prev_revenue = float(totals[2]) if totals else 0.0
    prev_units = int(totals[3]) if totals else 0

    sales_kpi = calculate_kpi_trend(cur_revenue, prev_revenue, is_currency=True)
    sales_kpi.title = "Total Sales"

    # 2. Revenue Growth
    growth_rate = ((cur_revenue - prev_revenue) / prev_revenue * 100.0) if prev_revenue > 0 else 0.0
    growth_kpi = KPICardData(
        title="Revenue Growth",
        value=round(growth_rate, 1),
        formatted_value=format_percentage(growth_rate),
        previous_value=0.0,
        change_percentage=round(growth_rate, 1),
        trend="up" if growth_rate > 0 else ("down" if growth_rate < 0 else "neutral"),
        period_label="period-over-period"
    )

    # 3. Units Sold
    units_kpi = calculate_kpi_trend(cur_units, prev_units, is_currency=False)
    units_kpi.title = "Units Sold"

    # 4. Low-Stock Products
    low_stock_count = db.query(Product).filter(
        Product.stock_quantity <= Product.reorder_threshold
    ).count()
    low_stock_kpi = KPICardData(
        title="Low-Stock Products",
        value=low_stock_count,
        formatted_value=str(low_stock_count),
        previous_value=None,
        change_percentage=None,
        trend="down" if low_stock_count > 5 else "neutral",
        period_label="requires reorder"
    )

    # 5. Top selling products in current period (single efficient join query)
    top_query = db.query(
        OrderItem.product_id,
        Product.name,
        Product.category,
        Product.stock_quantity,
        func.sum(OrderItem.quantity).label("total_units"),
        func.sum(OrderItem.quantity * OrderItem.unit_price).label("total_rev")
    ).join(Product, OrderItem.product_id == Product.id)\
     .join(Order, OrderItem.order_id == Order.id)\
     .filter(
        Order.order_date >= current_start,
        Order.order_date < now,
        Order.status == "Completed"
     )\
     .group_by(OrderItem.product_id, Product.name, Product.category, Product.stock_quantity)\
     .order_by(desc("total_rev"))\
     .limit(5).all()

    top_selling = [{
        "product_id": r.product_id,
        "product_name": r.name,
        "category": r.category,
        "stock_quantity": r.stock_quantity,
        "units_sold": int(r.total_units),
        "revenue": round(float(r.total_rev), 2),
        "formatted_revenue": format_currency(float(r.total_rev))
    } for r in top_query]

    # 6. Recent sales (preloaded with joinedload/selectinload to eliminate N+1 round trips)
    recent_orders = db.query(Order).options(
        joinedload(Order.customer),
        selectinload(Order.items).joinedload(OrderItem.product)
    ).order_by(desc(Order.order_date)).limit(10).all()

    recent_sales_list = []
    for o in recent_orders:
        items = o.items
        tot = sum(i.quantity * i.unit_price for i in items)
        tot_qty = sum(i.quantity for i in items)
        summary = ", ".join([f"{i.product.name} (x{i.quantity})" for i in items[:2]])
        if len(items) > 2:
            summary += f" +{len(items)-2} more"

        recent_sales_list.append(OrderResponse(
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

    # 7. Low-stock alerts
    low_stock_prods = db.query(Product).filter(
        Product.stock_quantity <= Product.reorder_threshold
    ).order_by(Product.stock_quantity.asc()).limit(8).all()

    alerts_list = []
    for p in low_stock_prods:
        st = "Out of Stock" if p.stock_quantity <= 0 else "Low Stock"
        urgency = "Critical" if p.stock_quantity <= 0 else ("Critical" if p.stock_quantity <= p.reorder_threshold / 2 else "Warning")
        alerts_list.append(InventoryAlertResponse(
            product_id=p.id,
            product_name=p.name,
            category=p.category,
            current_stock=p.stock_quantity,
            reorder_threshold=p.reorder_threshold,
            stock_status=st,
            urgency=urgency
        ))

    # 8. Recent activities
    activities = db.query(BusinessActivity).order_by(desc(BusinessActivity.created_at)).limit(8).all()
    act_list = [BusinessActivityResponse.model_validate(a) for a in activities]

    return DashboardSummaryResponse(
        total_sales=sales_kpi,
        revenue_growth=growth_kpi,
        units_sold=units_kpi,
        low_stock_products=low_stock_kpi,
        top_selling_products=top_selling,
        recent_sales=recent_sales_list,
        low_stock_alerts=alerts_list,
        recent_activities=act_list
    )

def get_revenue_trend(db: Session, days: int = 30) -> List[RevenueTrendPoint]:
    now = get_reference_now(db)
    start_date = now - timedelta(days=days)

    # Preload order items in a single query to eliminate ~200 N+1 round trips
    orders = db.query(Order).options(
        selectinload(Order.items)
    ).filter(
        Order.order_date >= start_date,
        Order.order_date < now,
        Order.status == "Completed"
    ).all()

    # Aggregate by period string
    date_map = {}
    if days <= 35:
        # Day by day
        for i in range(days + 1):
            d = (start_date + timedelta(days=i)).strftime("%b %d")
            date_map[d] = {"revenue": 0.0, "order_count": 0, "units_sold": 0}
        for o in orders:
            d_str = o.order_date.strftime("%b %d")
            if d_str in date_map:
                rev = sum(i.quantity * i.unit_price for i in o.items)
                qty = sum(i.quantity for i in o.items)
                date_map[d_str]["revenue"] += rev
                date_map[d_str]["order_count"] += 1
                date_map[d_str]["units_sold"] += qty
    else:
        # Weekly or Monthly
        num_weeks = max(1, days // 7)
        for i in range(num_weeks + 1):
            w_start = start_date + timedelta(days=i * 7)
            d_str = w_start.strftime("%b %d")
            date_map[d_str] = {"revenue": 0.0, "order_count": 0, "units_sold": 0}

        keys = list(date_map.keys())
        for o in orders:
            # find closest week key
            idx = min(len(keys) - 1, max(0, (o.order_date - start_date).days // 7))
            d_str = keys[idx]
            rev = sum(i.quantity * i.unit_price for i in o.items)
            qty = sum(i.quantity for i in o.items)
            date_map[d_str]["revenue"] += rev
            date_map[d_str]["order_count"] += 1
            date_map[d_str]["units_sold"] += qty

    points = []
    for k, v in date_map.items():
        points.append(RevenueTrendPoint(
            period=k,
            revenue=round(v["revenue"], 2),
            order_count=v["order_count"],
            units_sold=v["units_sold"]
        ))
    return points

def get_sales_analytics(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    region: Optional[str] = None,
    channel: Optional[str] = None,
    status: Optional[str] = None
) -> SalesAnalyticsResponse:
    now = get_reference_now(db)
    if not end_date:
        end_date = now
    if not start_date:
        start_date = end_date - timedelta(days=90)

    query = db.query(Order).options(
        selectinload(Order.items).joinedload(OrderItem.product)
    ).filter(Order.order_date >= start_date, Order.order_date <= end_date)
    if region:
        query = query.filter(Order.region == region)
    if channel:
        query = query.filter(Order.sales_channel == channel)
    if status:
        query = query.filter(Order.status == status)

    orders = query.all()

    # Completed orders metrics for revenue
    completed_orders = [o for o in orders if o.status == "Completed"]
    total_revenue = 0.0
    for o in completed_orders:
        total_revenue += sum(i.quantity * i.unit_price for i in o.items)

    total_orders = len(orders)
    avg_order_value = (total_revenue / len(completed_orders)) if completed_orders else 0.0

    # Trend points
    days = (end_date - start_date).days
    revenue_trend = get_revenue_trend(db, days=max(14, days))

    # Category breakdown (from completed orders)
    cat_revenue = {}
    for o in completed_orders:
        for i in o.items:
            cat = i.product.category
            rev = i.quantity * i.unit_price
            if cat not in cat_revenue:
                cat_revenue[cat] = {"revenue": 0.0, "orders": set()}
            cat_revenue[cat]["revenue"] += rev
            cat_revenue[cat]["orders"].add(o.id)

    by_category = []
    for cat, data in cat_revenue.items():
        pct = (data["revenue"] / total_revenue * 100.0) if total_revenue > 0 else 0.0
        by_category.append(CategoryBreakdownPoint(
            category=cat,
            revenue=round(data["revenue"], 2),
            percentage=round(pct, 1),
            orders_count=len(data["orders"])
        ))
    by_category.sort(key=lambda x: x.revenue, reverse=True)

    # Region breakdown
    reg_data = {}
    for o in orders:
        reg = o.region
        if reg not in reg_data:
            reg_data[reg] = {"orders": 0, "revenue": 0.0}
        reg_data[reg]["orders"] += 1
        if o.status == "Completed":
            reg_data[reg]["revenue"] += sum(i.quantity * i.unit_price for i in o.items)

    by_region = [
        {"region": r, "orders": d["orders"], "revenue": round(d["revenue"], 2)}
        for r, d in reg_data.items()
    ]
    by_region.sort(key=lambda x: x["revenue"], reverse=True)

    # Channel breakdown
    ch_data = {}
    for o in orders:
        ch = o.sales_channel
        if ch not in ch_data:
            ch_data[ch] = {"orders": 0, "revenue": 0.0}
        ch_data[ch]["orders"] += 1
        if o.status == "Completed":
            ch_data[ch]["revenue"] += sum(i.quantity * i.unit_price for i in o.items)

    by_channel = [
        {"channel": c, "orders": d["orders"], "revenue": round(d["revenue"], 2)}
        for c, d in ch_data.items()
    ]
    by_channel.sort(key=lambda x: x["revenue"], reverse=True)

    return SalesAnalyticsResponse(
        total_revenue=round(total_revenue, 2),
        total_orders=total_orders,
        average_order_value=round(avg_order_value, 2),
        revenue_trend=revenue_trend,
        by_category=by_category,
        by_region=by_region,
        by_channel=by_channel
    )

def determine_customer_segment(total_revenue: float, completed_orders_count: int, reg_date: datetime, last_order_date: Optional[datetime], now: datetime) -> str:
    """
    Transparent, deterministic segmentation rules:
    - High value: Lifetime completed revenue >= $1,500
    - Repeat: >= 2 completed orders (and not high value)
    - Inactive: Has orders, but most recent order > 60 days ago
    - New: Registered within last 45 days and <= 1 order
    """
    if total_revenue >= 1500.0:
        return "High Value"
    if completed_orders_count >= 2:
        if last_order_date and (now - last_order_date).days > 75:
            return "Inactive"
        return "Repeat"
    if (now - reg_date).days <= 45:
        return "New"
    return "Standard"

def get_customer_response(c: Customer, now: datetime) -> CustomerResponse:
    completed_orders = [o for o in c.orders if o.status == "Completed"]
    tot_rev = sum(sum(i.quantity * i.unit_price for i in o.items) for o in completed_orders)
    last_order = max([o.order_date for o in c.orders], default=None)
    segment = determine_customer_segment(tot_rev, len(completed_orders), c.registration_date, last_order, now)

    return CustomerResponse(
        id=c.id,
        name=c.name,
        email=c.email,
        region=c.region,
        registration_date=c.registration_date,
        created_at=c.created_at,
        total_orders=len(c.orders),
        total_revenue=round(tot_rev, 2),
        last_order_date=last_order,
        segment=segment
    )

def get_product_response(p: Product, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None) -> ProductResponse:
    # Filter completed sales items
    items_query = [i for i in p.order_items if i.order.status == "Completed"]
    if start_date:
        items_query = [i for i in items_query if i.order.order_date >= start_date]
    if end_date:
        items_query = [i for i in items_query if i.order.order_date <= end_date]

    units_sold = sum(i.quantity for i in items_query)
    rev = sum(i.quantity * i.unit_price for i in items_query)
    cogs = sum(i.quantity * i.unit_cost_at_sale for i in items_query)
    gross_profit = rev - cogs
    gross_margin_pct = (gross_profit / rev * 100.0) if rev > 0 else 0.0

    st_status = "Out of Stock" if p.stock_quantity <= 0 else ("Low Stock" if p.stock_quantity <= p.reorder_threshold else "In Stock")
    inv_val = max(0, p.stock_quantity) * p.unit_cost

    return ProductResponse(
        id=p.id,
        name=p.name,
        category=p.category,
        selling_price=p.selling_price,
        unit_cost=p.unit_cost,
        stock_quantity=p.stock_quantity,
        reorder_threshold=p.reorder_threshold,
        sku=getattr(p, "sku", None),
        barcode=getattr(p, "barcode", None),
        description=getattr(p, "description", None),
        supplier=getattr(p, "supplier", None),
        image_url=getattr(p, "image_url", None),
        created_at=p.created_at,
        updated_at=p.updated_at,
        units_sold=units_sold,
        revenue=round(rev, 2),
        gross_profit=round(gross_profit, 2),
        gross_margin_percent=round(gross_margin_pct, 1),
        stock_status=st_status,
        inventory_value=round(inv_val, 2)
    )
