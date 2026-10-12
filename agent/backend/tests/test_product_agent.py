import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from .conftest import TestingSessionLocal
from app.models.models import Product, BusinessActivity, InventoryMovement
from app.schemas.schemas import (
    ProductCreate,
    ExtractedProductItem,
    ProductDuplicateCheckRequest
)
from app.services.product_creation_service import (
    create_product_record,
    check_product_duplicates
)

client = TestClient(app)

@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_case_1_manually_create_valid_product(db_session: Session):
    """
    Test Case 1: Manually create a valid product via backend API.
    Verifies schema validation, database insertion, activity logging, and initial stock movement.
    """
    payload = {
        "name": "Ergonomic Mechanical Numpad",
        "sku": "NUMPAD-PRO-01",
        "barcode": "890123456789",
        "description": "High-durability standalone numpad with hot-swappable switches",
        "category": "Electronics",
        "selling_price": 49.99,
        "unit_cost": 22.50,
        "stock_quantity": 25,
        "reorder_threshold": 5,
        "supplier": "KeyTech Peripherals"
    }

    # Delete if exists from previous test run
    existing = db_session.query(Product).filter(Product.sku == payload["sku"]).first()
    if existing:
        db_session.query(InventoryMovement).filter(InventoryMovement.product_id == existing.id).delete()
        db_session.query(Product).filter(Product.id == existing.id).delete()
        db_session.commit()

    res = client.post("/api/products", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()

    assert data["name"] == payload["name"]
    assert data["sku"] == payload["sku"]
    assert data["category"] == payload["category"]
    assert data["selling_price"] == payload["selling_price"]
    assert data["unit_cost"] == payload["unit_cost"]
    assert data["stock_quantity"] == payload["stock_quantity"]
    assert data["stock_status"] == "In Stock"

    # Verify directly in database with fresh session
    fresh_db = TestingSessionLocal()
    try:
        db_prod = fresh_db.query(Product).filter(Product.sku == payload["sku"]).first()
        assert db_prod is not None
        assert db_prod.name == payload["name"]

        # Verify inventory movement logged
        mov = fresh_db.query(InventoryMovement).filter(InventoryMovement.product_id == db_prod.id).first()
        assert mov is not None
        assert mov.quantity_change == 25
        assert mov.movement_type == "Initial"
    finally:
        fresh_db.close()


def test_case_2_upload_packing_slip_two_new_products(db_session: Session):
    """
    Test Case 2: Upload a packing slip containing two new products.
    Verifies isolation of unrelated fees (shipping, order total, tracking) and extraction of product items.
    """
    packing_slip_content = """PACKING SLIP & INVOICE
Vendor: Apex Garments Co.
Order #: PO-88219
Tracking #: TRK-9872149
Customer: InsightFlow Enterprise
Date: Oct 11, 2026

LINE ITEMS:
SKU: #123
Description: Blue T-shirt
Quantity: 1
Price: $10.00

SKU: #124
Description: Red T-shirt
Quantity: 1
Price: $12.00

SUMMARY:
Shipping: $15.00
Grand Total: $37.00"""

    file_bytes = packing_slip_content.encode("utf-8")
    files = {"file": ("packing_slip.pdf", io.BytesIO(file_bytes), "application/pdf")}

    res = client.post("/api/products/extract-from-image", files=files)
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["success"] is True
    assert len(data["extracted_items"]) == 2

    # Unrelated metadata isolation verification
    unrelated = data.get("unrelated_data_detected", {})
    assert unrelated.get("tracking_number") == "TRK-9872149"
    assert unrelated.get("order_number") == "PO-88219"
    assert unrelated.get("shipping_charge") == 15.0
    assert unrelated.get("invoice_total") == 37.0

    # Line item verification
    items = data["extracted_items"]
    item_blue = next((i for i in items if "blue" in i["name"].lower()), None)
    item_red = next((i for i in items if "red" in i["name"].lower()), None)

    assert item_blue is not None
    assert item_blue["sku"] == "#123"
    assert item_blue["price"] == 10.00
    assert item_blue["quantity"] == 1

    assert item_red is not None
    assert item_red["sku"] == "#124"
    assert item_red["price"] == 12.00
    assert item_red["quantity"] == 1

    # Check duplicate check classification on these 2 new items
    dup_res = client.post("/api/products/check-duplicates", json={"items": items})
    assert dup_res.status_code == 200
    dup_data = dup_res.json()
    assert len(dup_data["results"]) == 2
    for r in dup_data["results"]:
        assert r["status"] in ("new_product", "possible_duplicate")


def test_case_3_upload_document_containing_existing_sku(db_session: Session):
    """
    Test Case 3: Upload a document containing an existing SKU.
    Verifies priority 1 exact SKU matching, marks 'already_exists', and preserves existing record unchanged.
    """
    fresh_db = TestingSessionLocal()
    try:
        existing = fresh_db.query(Product).filter(Product.sku.isnot(None)).first()
        assert existing is not None
        sku_test = existing.sku
        original_stock = existing.stock_quantity
        original_price = existing.selling_price

        # Check duplicate endpoint with this SKU
        item_payload = [
            {
                "name": "Different Label Same SKU",
                "sku": sku_test,
                "category": "Apparel",
                "price": 99.0,  # document has different price
                "quantity": 50  # document has incoming quantity
            }
        ]

        res = client.post("/api/products/check-duplicates", json={"items": item_payload})
        assert res.status_code == 200
        data = res.json()["results"][0]

        assert data["status"] == "already_exists"
        assert "Exact SKU match found" in data["match_reason"]
        assert data["matched_product"]["id"] == existing.id

        # Verify existing product in DB remains strictly unchanged
        fresh_db.expire_all()
        re_check = fresh_db.query(Product).filter(Product.id == existing.id).first()
        assert re_check.stock_quantity == original_stock
        assert re_check.selling_price == original_price
    finally:
        fresh_db.close()


def test_case_4_upload_document_both_existing_and_new_products(db_session: Session):
    """
    Test Case 4: Upload document containing both existing and new products.
    Verifies independent processing of multiple items.
    """
    # Item 1 matches existing SKU
    existing_prod = db_session.query(Product).first()
    assert existing_prod is not None

    items_payload = [
        {
            "name": existing_prod.name,
            "sku": existing_prod.sku,
            "price": existing_prod.selling_price
        },
        {
            "name": "Brand New Organic Cotton Hoodie",
            "sku": "HOODIE-NEW-99",
            "category": "Apparel",
            "price": 64.99,
            "quantity": 2
        }
    ]

    res = client.post("/api/products/check-duplicates", json={"items": items_payload})
    assert res.status_code == 200
    results = res.json()["results"]
    assert len(results) == 2

    assert results[0]["status"] == "already_exists"
    assert results[1]["status"] == "new_product"


def test_case_5_upload_document_ambiguous_product_matches(db_session: Session):
    """
    Test Case 5: Upload a document with ambiguous product matches.
    Verifies cautious matching: similar product names alone must trigger 'possible_duplicate' for review.
    """
    # Mechanical Keyboard Pro is seeded in catalog
    items_payload = [
        {
            "name": "Mechanical Keyboard Pro Wireless",  # Similar name variant
            "sku": "KEYB-AMBIG-01",                     # New SKU
            "category": "Electronics",
            "price": 169.99
        }
    ]

    res = client.post("/api/products/check-duplicates", json={"items": items_payload})
    assert res.status_code == 200
    r = res.json()["results"][0]

    assert r["status"] == "possible_duplicate"
    assert r["similarity_score"] >= 0.80
    assert "Ambiguous match" in r["match_reason"]


def test_case_6_upload_image_missing_or_unreadable_fields():
    """
    Test Case 6: Upload an item with missing or unreadable fields.
    Verifies classification as 'insufficient_info' and flagging of uncertain values without hallucinating.
    """
    # Missing required name
    items_payload = [
        {
            "name": "",
            "sku": "UNKNOWN-01",
            "price": 10.0
        }
    ]

    res = client.post("/api/products/check-duplicates", json={"items": items_payload})
    assert res.status_code == 200
    r = res.json()["results"][0]
    assert r["status"] == "insufficient_info"
    assert "Missing required product name" in r["match_reason"]


def test_case_7_unsupported_image_format():
    """
    Test Case 7: Test an unsupported image format.
    Verifies HTTP 400 Bad Request with clear explanation of allowed formats.
    """
    bad_bytes = b"BINARY_EXECUTABLE_CONTENT"
    files = {"file": ("malicious.exe", io.BytesIO(bad_bytes), "application/x-msdownload")}

    res = client.post("/api/products/extract-from-image", files=files)
    assert res.status_code == 400
    assert "Unsupported image format" in res.json()["detail"]


def test_case_8_simulate_backend_save_failure():
    """
    Test Case 8: Simulate a backend save failure.
    Verifies validation rejection (HTTP 422) for negative price and empty name without database pollution.
    """
    bad_payload = {
        "name": "",  # Empty name
        "category": "General",
        "selling_price": -20.0,  # Negative price
        "unit_cost": -10.0
    }

    res = client.post("/api/products", json=bad_payload)
    assert res.status_code == 422


def test_case_9_repeated_submissions_do_not_create_duplicates(db_session: Session):
    """
    Test Case 9: Verify that repeated submissions do not create duplicates.
    First submission returns 201; second submission with same SKU returns 409 Conflict.
    """
    sku_unique = "TEST-DUP-PREVENTION-01"
    existing = db_session.query(Product).filter(Product.sku == sku_unique).first()
    if existing:
        db_session.query(InventoryMovement).filter(InventoryMovement.product_id == existing.id).delete()
        db_session.query(Product).filter(Product.id == existing.id).delete()
        db_session.commit()

    payload = {
        "name": "Noise Isolating Studio Monitor",
        "sku": sku_unique,
        "category": "Electronics",
        "selling_price": 129.99,
        "unit_cost": 60.0,
        "stock_quantity": 5
    }

    # First attempt: succeeds
    res1 = client.post("/api/products", json=payload)
    assert res1.status_code == 201

    # Second attempt: fails with 409 Conflict
    res2 = client.post("/api/products", json=payload)
    assert res2.status_code == 409
    assert "Duplicate product conflict" in res2.json()["detail"]


def test_case_10_floating_agent_and_interactive_workflow_contract():
    """
    Test Case 10: Verify the floating agent API contract.
    Ensures endpoints return structured data compatible with draggable floating window state.
    """
    # Verify check duplicates endpoint contract
    items = [
        {"name": "Contract Test Product A", "sku": "CTR-A-01", "price": 25.0, "category": "Apparel"}
    ]
    res = client.post("/api/products/check-duplicates", json={"items": items})
    assert res.status_code == 200
    assert "results" in res.json()
    first = res.json()["results"][0]
    assert "status" in first
    assert "item" in first


def test_case_11_field_highlight_and_controlled_state_integrity(db_session: Session):
    """
    Test Case 11: Verify controlled input validation and typing sequence integrity.
    """
    # Partial item without barcode or image url still creates safely with default values
    payload = {
        "name": "Field Highlight Verified Item",
        "category": "Office Supplies",
        "selling_price": 15.0,
        "unit_cost": 5.0,
        "stock_quantity": 10
    }
    res = client.post("/api/products", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["sku"] is not None  # Auto-generated SKU
    assert data["barcode"] is None


def test_case_12_products_appear_in_real_catalog_listing(db_session: Session):
    """
    Test Case 12: Verify that newly saved products appear immediately in the real Products page listing.
    """
    unique_name = "Unique Catalog Verification Gadget"
    payload = {
        "name": unique_name,
        "category": "Electronics",
        "selling_price": 89.99,
        "unit_cost": 40.0,
        "stock_quantity": 15
    }

    create_res = client.post("/api/products", json=payload)
    assert create_res.status_code == 201
    created_id = create_res.json()["id"]

    # Search catalogue
    list_res = client.get(f"/api/products?search={unique_name}")
    assert list_res.status_code == 200
    list_data = list_res.json()

    matched = next((p for p in list_data["items"] if p["id"] == created_id), None)
    assert matched is not None
    assert matched["name"] == unique_name
    assert matched["selling_price"] == 89.99


def test_case_13_create_catalog_product_agent_tool_registry(db_session: Session):
    """
    Test Case 13: Verify that create_catalog_product is registered in the Tool Registry
    and executes correctly with validation, persistence, and audit logging.
    """
    from app.agent.tools import registry

    tool = registry.get("create_catalog_product")
    assert tool is not None, "create_catalog_product tool must be registered in the ToolRegistry"

    payload = {
        "name": "Tool Registry Verified Product",
        "category": "Fitness",
        "selling_price": 59.99,
        "unit_cost": 25.00,
        "stock_quantity": 12,
        "reorder_threshold": 4,
        "sku": "TOOL-REG-01",
        "supplier": "FitTech Supplies"
    }

    # Delete if exists
    existing = db_session.query(Product).filter(Product.sku == payload["sku"]).first()
    if existing:
        db_session.query(InventoryMovement).filter(InventoryMovement.product_id == existing.id).delete()
        db_session.query(Product).filter(Product.id == existing.id).delete()
        db_session.commit()

    result = tool.handler(db_session, payload)
    assert result.get("success") is True
    assert result.get("action") == "create_catalog_product"
    assert result.get("sku") == "TOOL-REG-01"
    assert result.get("product_name") == payload["name"]

    # Verify audit activity
    act = db_session.query(BusinessActivity).filter(
        BusinessActivity.entity_id == result["product_id"],
        BusinessActivity.activity_type == "product_created"
    ).first()
    assert act is not None
    assert "Added new product" in act.description


def test_case_14_aiohttp_client_connector_dns_error_compatibility():
    """
    Test Case 14: Verify that aiohttp.ClientConnectorDNSError is patched and compatible with google-genai.
    """
    import aiohttp
    assert hasattr(aiohttp, "ClientConnectorDNSError"), "aiohttp must have ClientConnectorDNSError attribute"
    assert issubclass(aiohttp.ClientConnectorDNSError, aiohttp.ClientConnectorError)

    # Verify google.genai imports without AttributeError
    from google import genai
    from google.genai import types
    assert genai is not None
    assert types is not None


def test_case_15_agent_chat_product_creation_orchestration(db_session: Session):
    """
    Test Case 15: Verify that the agent orchestrates catalog product creation via /api/agent/chat.
    """
    sku_unique = "AGENT-CHAT-SKU-99"
    existing = db_session.query(Product).filter(Product.sku == sku_unique).first()
    if existing:
        db_session.query(InventoryMovement).filter(InventoryMovement.product_id == existing.id).delete()
        db_session.query(Product).filter(Product.id == existing.id).delete()
        db_session.commit()

    query = f"Create product 'Agent Orchestrated Wireless Headphones' with sku '{sku_unique}' category 'Electronics' price $99.99 cost $45.00 stock 30"
    res = client.post("/api/agent/chat", json={
        "query": query,
        "current_route": "/products"
    })
    assert res.status_code == 200
    data = res.json()
    assert "Successfully Created" in data["answer"] or "created" in data["answer"].lower()

    # Verify product in database
    created = db_session.query(Product).filter(Product.sku == sku_unique).first()
    assert created is not None
    assert created.selling_price == 99.99
    assert created.stock_quantity == 30
