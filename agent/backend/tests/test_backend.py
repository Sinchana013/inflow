import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.main import app
from app.seed import seed_database
from app.models.models import Product, Order, Customer, InventoryMovement

from .conftest import TestingSessionLocal

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

def test_dashboard_summary():
    response = client.get("/api/dashboard/summary?days=30")
    assert response.status_code == 200
    data = response.json()
    assert "total_sales" in data
    assert "revenue_growth" in data
    assert "units_sold" in data
    assert "low_stock_products" in data
    assert len(data["recent_sales"]) > 0
    assert len(data["low_stock_alerts"]) > 0
    assert len(data["recent_activities"]) > 0
    # Values should be non-negative
    assert data["total_sales"]["value"] >= 0
    assert data["units_sold"]["value"] >= 0

def test_sales_listing_and_filtering():
    # Test basic sales listing
    res = client.get("/api/sales?page=1&page_size=10")
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == 10
    assert data["total"] > 100

    # Test filtering by status
    res_completed = client.get("/api/sales?status=Completed")
    assert res_completed.status_code == 200
    completed_items = res_completed.json()["items"]
    for item in completed_items:
        assert item["status"] == "Completed"

    # Test order detail
    sample_id = completed_items[0]["id"]
    res_detail = client.get(f"/api/sales/{sample_id}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["id"] == sample_id
    assert len(detail["items"]) > 0

    # Test CSV export
    res_csv = client.get("/api/sales?export_csv=true")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    assert "Order ID,Date,Customer ID" in res_csv.text

def test_inventory_monitoring_and_adjustment():
    # List inventory
    res = client.get("/api/inventory")
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert data["summary"]["total_products"] == 30
    assert data["summary"]["inventory_valuation"] > 0

    # Test stock adjustment valid
    p1_before = client.get("/api/products/1").json()
    init_stock = p1_before["stock_quantity"]

    adj_res = client.patch("/api/inventory/1", json={
        "quantity_change": 5,
        "movement_type": "Adjustment",
        "reason": "Audit inventory recount"
    })
    assert adj_res.status_code == 200
    assert adj_res.json()["stock_quantity"] == init_stock + 5

    # Check movement history recorded
    mov_res = client.get("/api/inventory/1/movements")
    assert mov_res.status_code == 200
    movements = mov_res.json()
    assert any(m["reason"] == "Audit inventory recount" for m in movements)

    # Test stock adjustment invalid (negative stock)
    bad_res = client.patch("/api/inventory/1", json={
        "quantity_change": -99999,
        "movement_type": "Adjustment",
        "reason": "Illegal negative test"
    })
    assert bad_res.status_code == 400
    assert "cannot reduce stock below zero" in bad_res.json()["detail"]

def test_customers_segmentation():
    res = client.get("/api/customers")
    assert res.status_code == 200
    data = res.json()
    assert data["summary"]["total_customers"] == 100
    assert data["summary"]["repeat_percentage"] > 0

    # Check Sarah Jenkins (Customer 10) is High Value
    res_sarah = client.get("/api/customers/10")
    assert res_sarah.status_code == 200
    sarah = res_sarah.json()
    assert sarah["name"] == "Sarah Jenkins"
    assert sarah["segment"] == "High Value"
    assert sarah["total_revenue"] >= 1500.0
    assert len(sarah["recent_orders"]) >= 5

def test_products_profit_and_margin():
    res = client.get("/api/products")
    assert res.status_code == 200
    data = res.json()
    assert data["summary"]["total_products"] == 30
    assert data["summary"]["average_margin"] > 0

    # Check single product
    res_p2 = client.get("/api/products/2")
    assert res_p2.status_code == 200
    p2 = res_p2.json()
    assert p2["name"] == "Wireless Noise-Canceling Earbuds"
    assert p2["units_sold"] > 0
    assert p2["revenue"] > 0
    assert p2["gross_profit"] > 0
    assert p2["gross_margin_percent"] > 0

def test_reports_and_cross_module_insights():
    # Reports
    assert client.get("/api/reports/revenue").status_code == 200
    assert client.get("/api/reports/category-performance").status_code == 200
    assert client.get("/api/reports/product-performance").status_code == 200
    assert client.get("/api/reports/sales-inventory").status_code == 200

    # Insights
    res_insights = client.get("/api/reports/insights")
    assert res_insights.status_code == 200
    insights = res_insights.json()
    assert len(insights) >= 3
    # Check that overstocked declining product or surging demand insight exists
    insight_ids = [i["id"] for i in insights]
    assert "declining_sales_high_stock" in insight_ids or "high_demand_low_stock" in insight_ids

def test_ai_analysis_canvas():
    # Analysis query 1
    req1 = {"query": "Which products have declining sales and high inventory?"}
    res1 = client.post("/api/analysis/run", json=req1)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["is_rule_based"] is True
    assert "canvas" in data1
    assert len(data1["canvas"]["components"]) > 0

    # Analysis query 2
    req2 = {"query": "Which regions have the strongest revenue growth?"}
    res2 = client.post("/api/analysis/run", json=req2)
    assert res2.status_code == 200
    data2 = res2.json()
    assert any(c["type"] == "bar_chart" for c in data2["canvas"]["components"])

def test_error_handling():
    # Not found order
    assert client.get("/api/sales/999999").status_code == 404
    # Not found product
    assert client.get("/api/products/999999").status_code == 404
    # Not found customer
    assert client.get("/api/customers/999999").status_code == 404
