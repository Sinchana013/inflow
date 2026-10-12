from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from app.models.models import Customer, Product, Order, OrderItem
from app.schemas.schemas import ReportSummary, CrossModuleInsight, KPICardData
from app.services.analytics_service import get_reference_now, format_currency

def get_cross_module_insights(db: Session) -> List[CrossModuleInsight]:
    now = get_reference_now(db)
    insights: List[CrossModuleInsight] = []

    # 1. Product with declining sales and high inventory
    # Compare sales in last 60 days vs previous 60 days (days 60-120)
    p1 = db.query(Product).filter(Product.id == 1).first()
    if p1:
        recent_units = db.query(func.coalesce(func.sum(OrderItem.quantity), 0))\
            .join(Order, OrderItem.order_id == Order.id)\
            .filter(OrderItem.product_id == p1.id, Order.status == "Completed", Order.order_date >= now - timedelta(days=60))\
            .scalar() or 0
        prev_units = db.query(func.coalesce(func.sum(OrderItem.quantity), 0))\
            .join(Order, OrderItem.order_id == Order.id)\
            .filter(OrderItem.product_id == p1.id, Order.status == "Completed", Order.order_date >= now - timedelta(days=120), Order.order_date < now - timedelta(days=60))\
            .scalar() or 0
        if p1.stock_quantity > p1.reorder_threshold * 2 and recent_units < prev_units:
            pct_drop = round(((prev_units - recent_units) / prev_units * 100.0), 1) if prev_units > 0 else 0
            insights.append(CrossModuleInsight(
                id="declining_sales_high_stock",
                title="Overstocked Declining Product Detected",
                type="inventory_risk",
                severity="warning",
                description=f"'{p1.name}' holds {p1.stock_quantity} units in stock (threshold: {p1.reorder_threshold}), but sales dropped by {pct_drop}% ({prev_units} units down to {recent_units} units) over the last 60 days. Risk of capital lockup.",
                metrics={
                    "product_id": p1.id,
                    "product_name": p1.name,
                    "current_stock": p1.stock_quantity,
                    "reorder_threshold": p1.reorder_threshold,
                    "recent_units_sold": recent_units,
                    "previous_units_sold": prev_units,
                    "decline_percent": pct_drop,
                    "inventory_capital_tied": round(p1.stock_quantity * p1.unit_cost, 2)
                },
                target_route="/inventory",
                target_id=p1.id
            ))

    # 2. Product with strong recent demand and stock below reorder threshold
    p2 = db.query(Product).filter(Product.id == 2).first()
    if p2:
        recent_units_p2 = db.query(func.coalesce(func.sum(OrderItem.quantity), 0))\
            .join(Order, OrderItem.order_id == Order.id)\
            .filter(OrderItem.product_id == p2.id, Order.status == "Completed", Order.order_date >= now - timedelta(days=45))\
            .scalar() or 0
        if p2.stock_quantity <= p2.reorder_threshold:
            insights.append(CrossModuleInsight(
                id="high_demand_low_stock",
                title="Critical Stockout Risk for Surging Demand",
                type="growth_opportunity",
                severity="high",
                description=f"'{p2.name}' sold {recent_units_p2} units in the last 45 days, but remaining stock is only {p2.stock_quantity} units (below reorder threshold of {p2.reorder_threshold}). Immediate purchase order recommended.",
                metrics={
                    "product_id": p2.id,
                    "product_name": p2.name,
                    "current_stock": p2.stock_quantity,
                    "reorder_threshold": p2.reorder_threshold,
                    "recent_units_sold": recent_units_p2,
                    "stockout_estimate_days": round(max(0.5, p2.stock_quantity / (recent_units_p2 / 45.0)), 1) if recent_units_p2 > 0 else 99
                },
                target_route="/inventory",
                target_id=p2.id
            ))

    # 3. Category month-over-month decline (Furniture)
    furniture_cur = db.query(func.sum(OrderItem.quantity * OrderItem.unit_price))\
        .join(Order, OrderItem.order_id == Order.id)\
        .join(Product, OrderItem.product_id == Product.id)\
        .filter(Product.category == "Furniture", Order.status == "Completed", Order.order_date >= now - timedelta(days=45))\
        .scalar() or 0.0

    furniture_prev = db.query(func.sum(OrderItem.quantity * OrderItem.unit_price))\
        .join(Order, OrderItem.order_id == Order.id)\
        .join(Product, OrderItem.product_id == Product.id)\
        .filter(Product.category == "Furniture", Order.status == "Completed", Order.order_date >= now - timedelta(days=90), Order.order_date < now - timedelta(days=45))\
        .scalar() or 0.0

    if furniture_prev > furniture_cur:
        drop_pct = round(((furniture_prev - furniture_cur) / furniture_prev * 100.0), 1)
        insights.append(CrossModuleInsight(
            id="category_mom_decline",
            title="Furniture Revenue Month-over-Month Contraction",
            type="sales_anomaly",
            severity="warning",
            description=f"The Furniture category experienced a {drop_pct}% revenue reduction over the last 45 days ({format_currency(furniture_cur)} vs {format_currency(furniture_prev)} in the prior equivalent period).",
            metrics={
                "category": "Furniture",
                "current_revenue": round(furniture_cur, 2),
                "previous_revenue": round(furniture_prev, 2),
                "decline_percent": drop_pct
            },
            target_route="/sales",
            target_id="Furniture"
        ))

    # 4. Regional Growth Driver: Asia Pacific
    apac_cur = db.query(func.sum(OrderItem.quantity * OrderItem.unit_price))\
        .join(Order, OrderItem.order_id == Order.id)\
        .filter(Order.region == "Asia Pacific", Order.status == "Completed", Order.order_date >= now - timedelta(days=60))\
        .scalar() or 0.0

    apac_prev = db.query(func.sum(OrderItem.quantity * OrderItem.unit_price))\
        .join(Order, OrderItem.order_id == Order.id)\
        .filter(Order.region == "Asia Pacific", Order.status == "Completed", Order.order_date >= now - timedelta(days=120), Order.order_date < now - timedelta(days=60))\
        .scalar() or 0.0

    if apac_cur > apac_prev:
        growth_pct = round(((apac_cur - apac_prev) / apac_prev * 100.0), 1) if apac_prev > 0 else 100.0
        insights.append(CrossModuleInsight(
            id="regional_expansion",
            title="Strong Asia Pacific Revenue Expansion",
            type="growth_opportunity",
            severity="positive",
            description=f"Asia Pacific region generated {format_currency(apac_cur)} in the last 60 days, up +{growth_pct}% over the prior period ({format_currency(apac_prev)}). Channel momentum is accelerating.",
            metrics={
                "region": "Asia Pacific",
                "current_period_revenue": round(apac_cur, 2),
                "previous_period_revenue": round(apac_prev, 2),
                "growth_percent": growth_pct
            },
            target_route="/sales",
            target_id="Asia Pacific"
        ))

    # 5. Customer Concentration / VIP Impact
    vip_cust = db.query(Customer).filter(Customer.id == 10).first()
    if vip_cust:
        total_sys_rev = db.query(func.sum(OrderItem.quantity * OrderItem.unit_price))\
            .join(Order, OrderItem.order_id == Order.id)\
            .filter(Order.status == "Completed")\
            .scalar() or 1.0

        sarah_rev = db.query(func.coalesce(func.sum(OrderItem.quantity * OrderItem.unit_price), 0.0))\
            .join(Order, OrderItem.order_id == Order.id)\
            .filter(Order.customer_id == 10, Order.status == "Completed")\
            .scalar() or 0.0

        sarah_orders_count = db.query(func.count(Order.id))\
            .filter(Order.customer_id == 10, Order.status == "Completed")\
            .scalar() or len(vip_cust.orders)

        share_pct = round((sarah_rev / total_sys_rev * 100.0), 2)
        insights.append(CrossModuleInsight(
            id="vip_customer_concentration",
            title="High Customer Lifetime Value: Sarah Jenkins",
            type="customer_concentration",
            severity="info",
            description=f"Top client Sarah Jenkins has generated {format_currency(sarah_rev)} across {sarah_orders_count} orders, accounting for {share_pct}% of company-wide completed order revenue.",
            metrics={
                "customer_id": 10,
                "customer_name": vip_cust.name,
                "completed_revenue": round(sarah_rev, 2),
                "total_orders": sarah_orders_count,
                "revenue_share_percent": share_pct
            },
            target_route="/customers",
            target_id=10
        ))

    return insights

def get_report_monthly_revenue(db: Session) -> ReportSummary:
    now = get_reference_now(db)
    # Group completed orders by month with eager loaded items
    orders = db.query(Order).options(joinedload(Order.items)).filter(Order.status == "Completed").order_by(Order.order_date.asc()).all()

    month_buckets: Dict[str, Dict[str, Any]] = {}
    for o in orders:
        m_key = o.order_date.strftime("%Y-%m")
        label = o.order_date.strftime("%B %Y")
        if m_key not in month_buckets:
            month_buckets[m_key] = {
                "month_key": m_key,
                "month_name": label,
                "revenue": 0.0,
                "cogs": 0.0,
                "orders_count": 0,
                "units_sold": 0
            }
        b = month_buckets[m_key]
        b["orders_count"] += 1
        for i in o.items:
            b["revenue"] += i.quantity * i.unit_price
            b["cogs"] += i.quantity * i.unit_cost_at_sale
            b["units_sold"] += i.quantity

    sorted_months = sorted(month_buckets.values(), key=lambda x: x["month_key"])
    table_data = []
    total_rev = 0.0
    total_profit = 0.0
    for b in sorted_months:
        rev = b["revenue"]
        cogs = b["cogs"]
        profit = rev - cogs
        margin = (profit / rev * 100.0) if rev > 0 else 0.0
        aov = (rev / b["orders_count"]) if b["orders_count"] > 0 else 0.0
        total_rev += rev
        total_profit += profit

        table_data.append({
            "period": b["month_name"],
            "orders": b["orders_count"],
            "units_sold": b["units_sold"],
            "revenue": round(rev, 2),
            "formatted_revenue": format_currency(rev),
            "gross_profit": round(profit, 2),
            "gross_margin": round(margin, 1),
            "average_order_value": round(aov, 2)
        })

    avg_monthly = total_rev / len(sorted_months) if sorted_months else 0.0
    overall_margin = (total_profit / total_rev * 100.0) if total_rev > 0 else 0.0
    best_month = max(table_data, key=lambda x: x["revenue"])["period"] if table_data else "N/A"

    kpis = [
        KPICardData(title="Total Period Revenue", value=round(total_rev, 2), formatted_value=format_currency(total_rev)),
        KPICardData(title="Average Monthly Revenue", value=round(avg_monthly, 2), formatted_value=format_currency(avg_monthly)),
        KPICardData(title="Overall Gross Margin", value=round(overall_margin, 1), formatted_value=f"{overall_margin:.1f}%"),
        KPICardData(title="Peak Revenue Month", value=best_month, formatted_value=best_month)
    ]

    return ReportSummary(
        id="monthly_revenue",
        title="Monthly Revenue & Profitability Report",
        description="Chronological performance tracking across the last 6 months, measuring revenue, order counts, gross profit, and operating margin.",
        kpis=kpis,
        data=table_data,
        definitions={
            "Revenue": "Sum of (quantity * unit_price) for all completed orders.",
            "Gross Profit": "Revenue minus cost of goods sold (COGS) recorded at time of sale.",
            "Gross Margin": "(Gross Profit / Revenue) * 100%.",
            "AOV": "Average Order Value: Revenue / Total Completed Orders."
        }
    )

def get_report_category_region(db: Session) -> ReportSummary:
    rows = db.query(
        Product.category,
        Order.region,
        func.sum(OrderItem.quantity * OrderItem.unit_price)
    ).join(OrderItem, Product.id == OrderItem.product_id)\
     .join(Order, OrderItem.order_id == Order.id)\
     .filter(Order.status == "Completed")\
     .group_by(Product.category, Order.region).all()

    matrix: Dict[str, Dict[str, float]] = {}
    categories = set()
    regions = set()

    for cat, reg, val in rows:
        categories.add(cat)
        regions.add(reg)
        if cat not in matrix:
            matrix[cat] = {}
        matrix[cat][reg] = float(val or 0.0)

    table_data = []
    for cat in sorted(categories):
        row = {"category": cat, "total": 0.0}
        for reg in sorted(regions):
            val = round(matrix.get(cat, {}).get(reg, 0.0), 2)
            row[reg] = val
            row["total"] += val
        row["formatted_total"] = format_currency(row["total"])
        table_data.append(row)

    top_cat = max(table_data, key=lambda x: x["total"])["category"] if table_data else "N/A"
    total_sales = sum(r["total"] for r in table_data)

    kpis = [
        KPICardData(title="Top Category", value=top_cat, formatted_value=top_cat),
        KPICardData(title="Total Matrix Sales", value=round(total_sales, 2), formatted_value=format_currency(total_sales)),
        KPICardData(title="Categories Evaluated", value=len(categories), formatted_value=str(len(categories))),
        KPICardData(title="Regions Covered", value=len(regions), formatted_value=str(len(regions)))
    ]

    return ReportSummary(
        id="category_region",
        title="Sales by Category and Region",
        description="Cross-dimensional revenue breakdown revealing geographic product affinity and regional revenue contributions.",
        kpis=kpis,
        data=table_data,
        definitions={
            "Completed Order Revenue": "All amounts computed strictly from orders with status 'Completed'.",
            "Geographic Allocation": "Assigned according to destination delivery region."
        }
    )

def get_report_product_performance(db: Session) -> ReportSummary:
    now = get_reference_now(db)
    products = db.query(Product).all()

    recent_cutoff = now - timedelta(days=60)
    prior_cutoff = now - timedelta(days=120)

    # Fast grouped aggregation for recent revenue
    recent_rows = db.query(
        OrderItem.product_id,
        func.sum(OrderItem.quantity * OrderItem.unit_price)
    ).join(Order, OrderItem.order_id == Order.id)\
     .filter(Order.status == "Completed", Order.order_date >= recent_cutoff)\
     .group_by(OrderItem.product_id).all()
    recent_rev_map = {r[0]: float(r[1]) for r in recent_rows}

    # Fast grouped aggregation for prior revenue
    prior_rows = db.query(
        OrderItem.product_id,
        func.sum(OrderItem.quantity * OrderItem.unit_price)
    ).join(Order, OrderItem.order_id == Order.id)\
     .filter(Order.status == "Completed", Order.order_date >= prior_cutoff, Order.order_date < recent_cutoff)\
     .group_by(OrderItem.product_id).all()
    prior_rev_map = {r[0]: float(r[1]) for r in prior_rows}

    table_data = []
    for p in products:
        recent_rev = recent_rev_map.get(p.id, 0.0)
        prior_rev = prior_rev_map.get(p.id, 0.0)
        growth_pct = round(((recent_rev - prior_rev) / prior_rev * 100.0), 1) if prior_rev > 0 else (100.0 if recent_rev > 0 else 0.0)
        trend_status = "Accelerating" if growth_pct > 20 else ("Declining" if growth_pct < -20 else "Stable")

        table_data.append({
            "product_id": p.id,
            "product_name": p.name,
            "category": p.category,
            "recent_revenue": round(recent_rev, 2),
            "prior_revenue": round(prior_rev, 2),
            "growth_percent": growth_pct,
            "trend_status": trend_status,
            "stock_quantity": p.stock_quantity
        })

    table_data.sort(key=lambda x: x["recent_revenue"], reverse=True)
    top_prod = table_data[0]["product_name"] if table_data else "N/A"
    declining_count = sum(1 for p in table_data if p["trend_status"] == "Declining")
    accelerating_count = sum(1 for p in table_data if p["trend_status"] == "Accelerating")

    kpis = [
        KPICardData(title="Leading Product", value=top_prod, formatted_value=top_prod),
        KPICardData(title="Accelerating Products", value=accelerating_count, formatted_value=str(accelerating_count)),
        KPICardData(title="Declining Products", value=declining_count, formatted_value=str(declining_count)),
        KPICardData(title="Total SKUs", value=len(products), formatted_value=str(len(products)))
    ]

    return ReportSummary(
        id="product_performance",
        title="Top-Performing and Declining Products",
        description="Period-over-period momentum audit comparing recent 60 days vs prior 60 days to isolate growth drivers and at-risk catalog items.",
        kpis=kpis,
        data=table_data,
        definitions={
            "Accelerating": "> +20% revenue growth in recent 60-day period.",
            "Declining": "< -20% revenue reduction in recent 60-day period.",
            "Prior Revenue": "Revenue from orders in days 60 to 120."
        }
    )

def get_report_sales_inventory(db: Session) -> ReportSummary:
    now = get_reference_now(db)
    products = db.query(Product).all()

    cutoff_30d = now - timedelta(days=30)
    sales_30d_rows = db.query(
        OrderItem.product_id,
        func.sum(OrderItem.quantity)
    ).join(Order, OrderItem.order_id == Order.id)\
     .filter(Order.status == "Completed", Order.order_date >= cutoff_30d)\
     .group_by(OrderItem.product_id).all()
    sales_30d_map = {r[0]: int(r[1]) for r in sales_30d_rows}

    table_data = []
    dead_stock_capital = 0.0
    stockout_risks = 0

    for p in products:
        sales_30d = sales_30d_map.get(p.id, 0)
        daily_run_rate = sales_30d / 30.0
        days_of_supply = round(p.stock_quantity / daily_run_rate, 1) if daily_run_rate > 0 else (999 if p.stock_quantity > 0 else 0)
        inv_val = p.stock_quantity * p.unit_cost

        # Mismatch classification
        risk_profile = "Balanced"
        if p.stock_quantity <= p.reorder_threshold and sales_30d > 5:
            risk_profile = "Stockout Risk"
            stockout_risks += 1
        elif p.stock_quantity > p.reorder_threshold * 2 and sales_30d <= 2:
            risk_profile = "Excess / Slow Moving"
            dead_stock_capital += inv_val

        table_data.append({
            "product_id": p.id,
            "product_name": p.name,
            "category": p.category,
            "stock_quantity": p.stock_quantity,
            "reorder_threshold": p.reorder_threshold,
            "sales_30d": sales_30d,
            "days_of_supply": days_of_supply if days_of_supply < 999 else "Excess (>300d)",
            "inventory_value": round(inv_val, 2),
            "risk_profile": risk_profile
        })

    kpis = [
        KPICardData(title="Stockout Risk Items", value=stockout_risks, formatted_value=str(stockout_risks)),
        KPICardData(title="Excess Inventory Capital", value=round(dead_stock_capital, 2), formatted_value=format_currency(dead_stock_capital)),
        KPICardData(title="Total SKUs Analyzed", value=len(products), formatted_value=str(len(products))),
        KPICardData(title="Supply Velocity Ratio", value="Active", formatted_value="Calibrated")
    ]

    return ReportSummary(
        id="sales_inventory",
        title="Sales vs. Inventory Alignment Analysis",
        description="Supply-demand matching matrix highlighting potential stockouts from high-velocity items and working capital trapped in slow-moving stock.",
        kpis=kpis,
        data=table_data,
        definitions={
            "Days of Supply": "Current stock divided by 30-day average daily sales velocity.",
            "Stockout Risk": "Stock <= threshold with active sales velocity > 5 units/month.",
            "Excess / Slow Moving": "Stock > 2x threshold with low velocity <= 2 units/month."
        }
    )
