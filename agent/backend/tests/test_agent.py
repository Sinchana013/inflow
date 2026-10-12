import asyncio
import os
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from google.genai import types

from app.database import Base, get_db
from app.main import app
from app.agent.tools import registry
from app.agent.session_store import session_store
from app.agent.agent_service import process_agent_query
from app.agent.gemini_client import gemini_agent
from app.schemas.schemas import CanvasSpecification
from .conftest import TestingSessionLocal

client = TestClient(app)

def make_genai_fc_response(tool_name: str, tool_args: dict):
    """Helper to mock a Google Gen AI SDK tool-call response."""
    mock_resp = MagicMock()
    mock_fc = MagicMock()
    mock_fc.name = tool_name
    mock_fc.args = tool_args
    mock_resp.function_calls = [mock_fc]
    mock_cand = MagicMock()
    mock_cand.content = types.Content(
        role="model",
        parts=[types.Part(function_call=types.FunctionCall(name=tool_name, args=tool_args))]
    )
    mock_resp.candidates = [mock_cand]
    mock_resp.text = None
    return mock_resp

def make_genai_multi_fc_response(calls: list):
    """Helper to mock multiple Google Gen AI SDK tool calls in a single turn."""
    mock_resp = MagicMock()
    fc_list = []
    parts = []
    for name, args in calls:
        mfc = MagicMock()
        mfc.name = name
        mfc.args = args
        fc_list.append(mfc)
        parts.append(types.Part(function_call=types.FunctionCall(name=name, args=args)))
    mock_resp.function_calls = fc_list
    mock_cand = MagicMock()
    mock_cand.content = types.Content(role="model", parts=parts)
    mock_resp.candidates = [mock_cand]
    mock_resp.text = None
    return mock_resp

def make_genai_text_response(text: str):
    """Helper to mock a Google Gen AI SDK final text response."""
    mock_resp = MagicMock()
    mock_resp.function_calls = None
    mock_resp.candidates = [
        MagicMock(content=types.Content(role="model", parts=[types.Part.from_text(text=text)]))
    ]
    mock_resp.text = text
    return mock_resp


# ==============================================================================
# TEST CRITERIA 1-10 (As defined in prompt section H)
# ==============================================================================

def test_1_basic_question_reaches_agent_service():
    """Criterion 1: A basic question reaches the agent service and returns structured response."""
    res = client.post("/api/agent/chat", json={
        "query": "What is our current business activity?",
        "current_route": "/dashboard"
    })
    assert res.status_code == 200
    data = res.json()
    assert "conversation_id" in data
    assert "answer" in data
    assert len(data["answer"]) > 0
    assert "tool_traces" in data
    assert len(data["tool_traces"]) > 0


def test_2_gemini_requests_approved_tool_receives_real_result():
    """Criterion 2: Gemini can request an approved tool and receive its real result."""
    async def _async_test():
        db = TestingSessionLocal()
        mock_client = MagicMock()
        mock_client.aio.models.generate_content = AsyncMock(side_effect=[
            make_genai_fc_response("get_sales_summary", {"days": 30}),
            make_genai_text_response("Confirmed: Recent 30-day sales reached substantial revenue across completed orders.")
        ])

        gemini_agent.set_client(mock_client)
        try:
            ans, traces, collected = await gemini_agent.run_investigation_loop(
                query="What was our recent revenue?",
                history=[],
                current_route="/sales",
                db=db
            )
            assert "Confirmed:" in ans
            assert len(traces) == 1
            assert traces[0]["tool_name"] == "get_sales_summary"
            assert traces[0]["status"] == "success"
            # Verify real data returned from actual database
            assert "total_completed_revenue" in collected[0]["result"]
            assert collected[0]["result"]["completed_orders_count"] > 0
        finally:
            gemini_agent.set_client(None)
            db.close()

    asyncio.run(_async_test())


def test_3_multiple_tools_called_in_one_investigation():
    """Criterion 3: Multiple tools can be called in one investigation."""
    async def _async_test():
        db = TestingSessionLocal()
        mock_client = MagicMock()
        mock_client.aio.models.generate_content = AsyncMock(side_effect=[
            make_genai_multi_fc_response([
                ("compare_revenue_periods", {"period_days": 30}),
                ("get_low_stock_products", {"limit": 5})
            ]),
            make_genai_text_response("Multi-module analysis shows revenue contraction alongside critical stockout risks.")
        ])

        gemini_agent.set_client(mock_client)
        try:
            ans, traces, collected = await gemini_agent.run_investigation_loop(
                query="Why did sales drop and which products are low in stock?",
                history=[],
                current_route="/dashboard",
                db=db
            )
            assert len(traces) == 2
            executed_names = [t["tool_name"] for t in traces]
            assert "compare_revenue_periods" in executed_names
            assert "get_low_stock_products" in executed_names
            assert len(collected) == 2
            assert "Multi-module analysis" in ans
        finally:
            gemini_agent.set_client(None)
            db.close()

    asyncio.run(_async_test())


def test_4_query_from_customers_page_queries_sales_and_inventory():
    """Criterion 4: A request from the Customers page can query Sales and Inventory."""
    res = client.post("/api/agent/chat", json={
        "query": "Why did sales decline this month?",
        "current_route": "/customers"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["current_route_context"] == "/customers"

    executed_tools = [t["tool_name"] for t in data["tool_traces"]]
    # Proves cross-module reach into Sales and Inventory from Customers route
    assert "compare_revenue_periods" in executed_tools or "analyze_category_performance" in executed_tools
    assert "analyze_sales_inventory_alignment" in executed_tools
    assert data["canvas"] is not None


def test_5_tool_arguments_validated_and_unknown_rejected():
    """Criterion 5: Tool arguments are validated and unknown tools are rejected."""
    db = TestingSessionLocal()
    # 1. Unknown tool rejected safely
    result, log = registry.execute("unregistered_exploit_tool", db, {"code": "import os"})
    assert "error" in result
    assert "not in approved tool registry" in result["error"]
    assert log.status == "error"

    # 2. Clamped arguments
    res_clamped = registry.get_tool("get_sales_summary").handler(db, {"days": -99})
    assert res_clamped["period_days"] >= 1

    res_max = registry.get_tool("get_sales_summary").handler(db, {"days": 99999})
    assert res_max["period_days"] <= 180

    # 3. Non-existent ID handled safely
    order_none = registry.get_tool("get_order_details").handler(db, {"order_id": 999999})
    assert "error" in order_none
    db.close()


def test_6_followup_questions_preserve_conversation_context():
    """Criterion 6: Follow-up questions preserve conversation context."""
    conv_id = "test-session-followup-context"
    # Turn 1
    res1 = client.post("/api/agent/chat", json={
        "query": "Why did sales decline this month?",
        "conversation_id": conv_id,
        "current_route": "/dashboard"
    })
    assert res1.status_code == 200
    assert res1.json()["conversation_id"] == conv_id

    # Turn 2
    res2 = client.post("/api/agent/chat", json={
        "query": "Which category contributed most to this decline?",
        "conversation_id": conv_id,
        "current_route": "/sales"
    })
    assert res2.status_code == 200
    assert res2.json()["conversation_id"] == conv_id

    # Retrieve history
    hist_res = client.get(f"/api/agent/conversations/{conv_id}")
    assert hist_res.status_code == 200
    hist = hist_res.json()
    assert len(hist["messages"]) >= 4  # 2 user queries + 2 assistant answers


def test_7_returned_canvas_passes_existing_schema():
    """Criterion 7: The returned canvas passes the existing Pydantic schema."""
    res = client.post("/api/agent/chat", json={
        "query": "Which products have declining sales and high inventory?",
        "current_route": "/inventory"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["canvas"] is not None

    # Validate strictly against CanvasSpecification Pydantic schema
    canvas_obj = CanvasSpecification.model_validate(data["canvas"])
    assert canvas_obj.title is not None
    assert len(canvas_obj.components) > 0
    # Verify supported component types
    types_in_canvas = [c.type for c in canvas_obj.components]
    assert "kpi_card" in types_in_canvas
    assert "insight_card" in types_in_canvas or "data_table" in types_in_canvas


def test_8_api_failure_triggers_existing_fallback():
    """Criterion 8: API failure triggers the existing fallback without breaking."""
    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(side_effect=Exception("Google Gen AI 503 Overloaded"))
    gemini_agent.set_client(mock_client)

    try:
        res = client.post("/api/agent/chat", json={
            "query": "Which regions have the strongest revenue growth?",
            "current_route": "/reports"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["is_llm_powered"] is False
        assert "fallback" in data["model_used"] or "deterministic" in data["model_used"]
        assert "Asia Pacific" in data["answer"]
    finally:
        gemini_agent.set_client(None)


def test_9_missing_configuration_handled_clearly():
    """Criterion 9: Missing configuration is handled clearly with transparent fallback."""
    with patch.dict(os.environ, {"GEMINI_API_KEY": ""}, clear=False):
        gemini_agent._client = None
        gemini_agent.api_key = ""
        assert gemini_agent.is_configured() is False

        res = client.post("/api/agent/chat", json={
            "query": "Show revenue trends and low stock alerts",
            "current_route": "/inventory"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["is_llm_powered"] is False
        assert data["model_used"] == "rule-based-deterministic-fallback"
        assert len(data["tool_traces"]) > 0


def test_10_tools_registry_listing_and_coverage():
    """Verify tool registry completeness across all business modules."""
    tools = registry.get_all_declarations()
    assert len(tools) >= 15
    tool_names = [t["name"] for t in tools]

    expected = [
        "get_sales_summary", "get_sales_trend", "compare_revenue_periods",
        "get_sales_by_category", "get_sales_by_region", "get_sales_by_channel",
        "get_order_details", "get_product_performance", "get_top_and_declining_products",
        "get_inventory_status", "get_low_stock_products", "get_inventory_movements",
        "get_customer_analytics", "get_customer_segments", "get_customer_purchase_history",
        "analyze_sales_inventory_alignment", "analyze_category_performance",
        "analyze_regional_performance", "get_business_activity"
    ]
    for fn in expected:
        assert fn in tool_names, f"Missing tool: {fn}"

    res = client.get("/api/agent/tools")
    assert res.status_code == 200
    assert len(res.json()) == len(tools)


def test_11_product_intelligence_analysis_and_citations():
    """Verify product intelligence tool executes historical auditing, pattern detection, and returns citations."""
    from app.analytics.product_intelligence import analyze_product_intelligence
    db = TestingSessionLocal()
    try:
        result = analyze_product_intelligence(db, product_identifier="Mechanical Keyboard Pro", time_period_days=90)
        assert result["success"] is True
        assert result["product_name"] == "Mechanical Keyboard Pro"
        assert "patterns" in result
        assert "recommendations" in result
        assert len(result["citations"]) >= 1
        assert result["canvas"] is not None
        assert len(result["canvas"].components) >= 5

        first_cite = result["citations"][0]
        assert first_cite.source_type == "application_data"
        assert "/products?highlight=" in first_cite.route
    finally:
        db.close()


def test_12_export_generation_all_formats():
    """Verify the multi-format export endpoint generates valid files for PPTX, DOCX, XLSX, PDF, and PNG."""
    formats = ["pptx", "docx", "xlsx", "pdf", "png"]
    payload = {
        "title": "Automated Test Business Intelligence Report",
        "subtitle": "Q3 Enterprise Operational Review",
        "summary": "This is a verified test report containing key findings and audit citations.",
        "kpis": [
            {"label": "Total Sales", "value": "$125,000"},
            {"label": "Net Profit", "value": "$42,000"}
        ],
        "insights": [
            {"title": "Surging Demand", "content": "Mechanical keyboards up 35% MoM."}
        ],
        "tables": [
            {
                "title": "Top Selling Products",
                "columns": [{"key": "name", "label": "Product"}, {"key": "revenue", "label": "Revenue"}],
                "rows": [
                    {"name": "Mechanical Keyboard Pro", "revenue": "$18,500"},
                    {"name": "Wireless Noise-Canceling Earbuds", "revenue": "$14,200"}
                ]
            }
        ],
        "recommendations": [
            "Reorder 50 units immediately to avoid stockout.",
            "Expand B2B wholesale distribution in South region."
        ],
        "sources": [
            {"index": 1, "title": "Sales Ledger", "source_type": "application_data", "excerpt": "Verified sales"}
        ]
    }

    for fmt in formats:
        test_payload = dict(payload, format=fmt)
        res = client.post("/api/export/generate", json=test_payload)
        assert res.status_code == 200, f"Failed export format {fmt}: {res.text}"
        assert len(res.content) > 100, f"Export content too small for {fmt}"
        assert "content-disposition" in res.headers
        assert f".{fmt}\"" in res.headers["content-disposition"]


def test_13_agent_chat_with_selected_context_and_citations():
    """Verify agent chat endpoint handles selected object context and returns verifiable citations."""
    payload = {
        "query": "What is the stock risk for this product?",
        "selected_context": {
            "type": "product",
            "id": 1,
            "title": "Mechanical Keyboard Pro",
            "route": "/products?highlight=1",
            "data": {"selling_price": 129.99, "stock_status": "In Stock"}
        }
    }
    res = client.post("/api/agent/chat", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "answer" in data
    assert len(data["answer"]) > 0
    assert "citations" in data
    assert isinstance(data["citations"], list)
    if len(data["citations"]) > 0:
        c = data["citations"][0]
        assert "source_type" in c
        assert "title" in c


def test_14_external_knowledge_search_tool():
    """Verify external knowledge search tool executes and returns citations."""
    from app.agent.tools import registry
    assert registry.get_tool("search_external_knowledge") is not None

    db = TestingSessionLocal()
    try:
        res, log = registry.execute("search_external_knowledge", db, {"query": "supply chain inventory buffer stock safety stock formula"})
        assert log.status == "success"
        assert res["source_type"] == "external_web"
        assert "title" in res
        assert "domain" in res
        assert "url" in res
        assert "excerpt" in res
        assert res["verified"] is True
    finally:
        db.close()


def test_15_concise_direct_factual_stock_answer_with_navigation_metadata():
    """Verify narrow factual stock query yields direct concise 1-sentence answer and exact navigation metadata."""
    res = client.post("/api/agent/chat", json={
        "query": "How many units of Mechanical Keyboard Pro are in stock?",
        "current_route": "/inventory"
    })
    assert res.status_code == 200
    data = res.json()
    ans = data["answer"]
    # Direct answer first, concise
    assert "Mechanical Keyboard Pro" in ans
    assert "units in warehouse inventory" in ans or "units" in ans
    assert "[1]" in ans
    assert len(ans.splitlines()) <= 2  # Concise 1-2 sentence response without unsolicited filler

    # Verify rich citation metadata
    assert "citations" in data
    assert len(data["citations"]) > 0
    cite = data["citations"][0]
    assert cite["element_id"] == "inventory-row-1"
    assert cite["internal_route"] == "/inventory"
    assert cite["subpage"] == "Stock Levels"
    assert cite["record_id"] == 1
    assert cite["retrieval_timestamp"] is not None
    assert cite["verified"] is True
    assert cite["excerpt"] is not None


def test_16_concise_order_lookup_with_exact_navigation_metadata():
    """Verify specific order lookup yields direct status answer and exact order-row element ID."""
    res = client.post("/api/agent/chat", json={
        "query": "What is the status of Order #1001?",
        "current_route": "/sales"
    })
    assert res.status_code == 200
    data = res.json()
    ans = data["answer"]
    assert "Order #1001" in ans
    assert "[1]" in ans

    # Verify citation metadata
    assert len(data["citations"]) > 0
    order_cite = next((c for c in data["citations"] if c["entity_type"] == "order"), data["citations"][0])
    assert order_cite["element_id"] == "order-row-1001"
    assert order_cite["internal_route"] == "/sales"
    assert order_cite["subpage"] == "Order Details"
    assert order_cite["record_id"] == 1001
    assert order_cite["route_parameters"] == {"highlight": "1001"}


def test_17_top_customer_query_concise_answer_and_metadata():
    """Verify top customer query yields direct answer first and customer row citation."""
    res = client.post("/api/agent/chat", json={
        "query": "Who is our top customer?",
        "current_route": "/customers"
    })
    assert res.status_code == 200
    data = res.json()
    ans = data["answer"]
    assert "top customer" in ans.lower()
    assert "[1]" in ans

    assert len(data["citations"]) > 0
    cust_cite = next((c for c in data["citations"] if c["entity_type"] == "customer"), data["citations"][0])
    assert cust_cite["internal_route"] == "/customers"
    assert cust_cite["subpage"] == "Customer CRM"
    assert cust_cite["element_id"] is not None


def test_18_30_day_revenue_query_concise_answer():
    """Verify 30-day revenue inquiry answers directly in first sentence with sales ledger citation."""
    res = client.post("/api/agent/chat", json={
        "query": "What is our 30-day revenue?",
        "current_route": "/dashboard"
    })
    assert res.status_code == 200
    data = res.json()
    ans = data["answer"]
    assert "completed sales revenue over the last 30 days" in ans.lower()
    assert "[1]" in ans

    assert len(data["citations"]) > 0
    sales_cite = data["citations"][0]
    assert sales_cite["internal_route"] == "/sales"
    assert sales_cite["element_id"] == "sales-orders-table"
    assert sales_cite["subpage"] == "Sales Orders"


def test_19_contextual_explanation_chart():
    """Verify universal contextual explanation for chart/visualization elements."""
    res = client.post("/api/agent/contextual-explain", json={
        "element_type": "chart",
        "element_title": "Revenue Over Time",
        "element_id": "chart-revenue-trend",
        "current_route": "/dashboard",
        "data": [
            {"period": "Day 1", "revenue": 1000},
            {"period": "Day 2", "revenue": 2500},
            {"period": "Day 3", "revenue": 1800}
        ]
    })
    assert res.status_code == 200
    data = res.json()
    assert "Revenue Over Time" in data["explanation"]
    assert "peaked at $2,500.00" in data["explanation"]
    assert "[1]" in data["explanation"]
    assert len(data["citations"]) == 1
    assert data["citations"][0]["element_id"] == "chart-revenue-trend"
    assert data["citations"][0]["route"] == "/dashboard"


def test_20_contextual_explanation_metric():
    """Verify universal contextual explanation for metric/KPI cards."""
    res = client.post("/api/agent/contextual-explain", json={
        "element_type": "metric",
        "element_title": "Total Completed Sales",
        "element_id": "kpi-total-sales",
        "current_route": "/dashboard",
        "data": {
            "value": 128450.50,
            "formatted_value": "$128,450.50",
            "change_percentage": 14.2
        }
    })
    assert res.status_code == 200
    data = res.json()
    assert "$128,450.50" in data["explanation"]
    assert "14.2%" in data["explanation"]
    assert "[1]" in data["explanation"]
    assert data["citations"][0]["element_id"] == "kpi-total-sales"


def test_21_contextual_explanation_table_row():
    """Verify universal contextual explanation for table rows and records."""
    res = client.post("/api/agent/contextual-explain", json={
        "element_type": "table_row",
        "element_title": "Echo Dot Smart Speaker",
        "element_id": "product-row-10",
        "current_route": "/products",
        "data": {
            "id": 10,
            "name": "Echo Dot Smart Speaker",
            "selling_price": 49.99,
            "revenue": 18900.00,
            "gross_margin_percent": 42.5
        }
    })
    assert res.status_code == 200
    data = res.json()
    assert "Echo Dot Smart Speaker" in data["explanation"]
    assert "$18,900.00" in data["explanation"]
    assert data["citations"][0]["element_id"] == "product-row-10"
    assert data["citations"][0]["record_id"] == "10"


def test_22_contextual_explanation_code_and_recommendation():
    """Verify contextual explanation for code snippets and diagnostic recommendations."""
    # 1. Code snippet
    res_code = client.post("/api/agent/contextual-explain", json={
        "element_type": "code",
        "element_title": "Gross Margin Formula",
        "element_id": "code-block-1",
        "selected_text": "gross_margin = (revenue - cogs) / revenue * 100"
    })
    assert res_code.status_code == 200
    assert "logic" in res_code.json()["explanation"].lower()
    assert len(res_code.json()["citations"]) > 0

    # 2. Recommendation / Insight
    res_rec = client.post("/api/agent/contextual-explain", json={
        "element_type": "recommendation",
        "element_title": "Restock SKU #2 Urgent",
        "element_id": "insight-card-1",
        "surrounding_context": "Inventory is under safety threshold"
    })
    assert res_rec.status_code == 200
    assert "finding" in res_rec.json()["explanation"].lower() or "recommend" in res_rec.json()["explanation"].lower()
    assert res_rec.json()["citations"][0]["element_id"] == "insight-card-1"


def test_23_contextual_explanation_paragraph_and_multi_turn_followup():
    """Verify paragraph selection and isolated multi-turn follow-up inside contextual dialog."""
    # Turn 1: Initial explanation of selected claim
    res_turn1 = client.post("/api/agent/contextual-explain", json={
        "element_type": "paragraph",
        "element_title": "Selected Claim",
        "selected_text": "Electronics drove 54% of sales volume during Q3 promotional events.",
        "current_route": "/reports"
    })
    assert res_turn1.status_code == 200
    data1 = res_turn1.json()
    assert "Electronics drove 54%" in data1["explanation"]
    assert len(data1["citations"]) > 0

    # Turn 2: Follow-up question inside the dialog (maintaining isolated context)
    res_turn2 = client.post("/api/agent/contextual-explain", json={
        "element_type": "paragraph",
        "element_title": "Selected Claim",
        "selected_text": "Electronics drove 54% of sales volume during Q3 promotional events.",
        "current_route": "/reports",
        "query": "Is this margin sustainable for Q4?",
        "dialog_history": [
            {"role": "user", "content": "Explain this claim"},
            {"role": "assistant", "content": data1["explanation"]}
        ]
    })
    assert res_turn2.status_code == 200
    data2 = res_turn2.json()
    assert "Is this margin sustainable for Q4?" in data2["explanation"]
    assert "[1]" in data2["explanation"]


# ==============================================================================
# REGRESSION TEST SUITE: QUESTION-INTENT & REASONING (TESTS 24 - 35)
# ==============================================================================

def test_24_regression_general_knowledge_definition_zero_db_tools():
    """Regression Test 1: 'What is a warehouse?' answers directly in 1-2 sentences with zero DB retrieval, zero citations, no canvas."""
    res = client.post("/api/agent/chat", json={
        "query": "What is a warehouse?",
        "current_route": "/dashboard"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "general_knowledge"
    assert "warehouse is a commercial building" in data["answer"].lower() or "storage" in data["answer"].lower()
    # Direct answer without DB retrieval
    assert data["citations"] == []
    assert data["canvas"] is None
    assert data["tool_traces"] == []
    # Must NOT return fake SKU counts or inventory valuation
    assert "catalog skus" not in data["answer"].lower()
    assert "inventory valuation" not in data["answer"].lower()


def test_25_regression_website_specific_page_overview():
    """Regression Test 2: 'What does this warehouse page show?' explains page and cites /inventory."""
    res = client.post("/api/agent/chat", json={
        "query": "What does this warehouse page show?",
        "current_route": "/inventory"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "website_specific"
    assert "warehouse inventory" in data["answer"].lower() or "stock levels" in data["answer"].lower()
    assert len(data["citations"]) >= 1
    assert data["citations"][0]["route"] == "/inventory"
    assert data["canvas"] is None


def test_26_regression_inventory_valuation_direct_answer():
    """Regression Test 3: 'What is the total inventory valuation?' verifies valuation from DB concisely, citing /inventory."""
    res = client.post("/api/agent/chat", json={
        "query": "What is the total inventory valuation?",
        "current_route": "/inventory"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "application_data"
    assert "valuation" in data["answer"].lower()
    assert "$" in data["answer"]
    assert len(data["citations"]) >= 1
    assert data["citations"][0]["route"] == "/inventory"
    assert data["canvas"] is None  # Direct 1-sentence answer without canvas clutter


def test_27_regression_low_stock_inquiry_identifies_qualifying_items():
    """Regression Test 4: 'Which stock items are running low?' accurately lists qualifying products under reorder threshold."""
    res = client.post("/api/agent/chat", json={
        "query": "Which stock items are running low?",
        "current_route": "/inventory"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "application_data"
    assert "low-stock" in data["answer"].lower() or "replenishment" in data["answer"].lower()
    assert len(data["citations"]) >= 1
    assert data["citations"][0]["route"] == "/inventory"


def test_28_regression_inventory_valuation_decline_correlation_vs_causation():
    """Regression Test 5: 'Why is the inventory value declining?' distinguishes correlation from causation."""
    res = client.post("/api/agent/chat", json={
        "query": "Why is the inventory value declining?",
        "current_route": "/inventory"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "comparison_analysis"
    assert "correlation vs causation" in data["answer"].lower()
    assert "write-off" in data["answer"].lower() or "fulfillment" in data["answer"].lower() or "adjustment" in data["answer"].lower()
    assert data["canvas"] is not None


def test_29_regression_selected_chart_uses_actual_data():
    """Regression Test 6: 'Explain this chart.' uses selected chart's actual series data."""
    chart_payload = {
        "query": "Explain this chart.",
        "current_route": "/sales",
        "selected_context": {
            "type": "chart",
            "title": "Monthly Sales Trajectory",
            "data": [
                {"period": "Jan", "value": 12500},
                {"period": "Feb", "value": 14200},
                {"period": "Mar", "value": 9800}
            ]
        }
    }
    res = client.post("/api/agent/chat", json=chart_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "selected_element"
    assert "3 recorded data points" in data["answer"]
    assert "Monthly Sales Trajectory" in data["answer"]
    assert len(data["citations"]) >= 1


def test_30_regression_selected_metric_resolves_context():
    """Regression Test 7: 'What does this number mean?' resolves selected metric context."""
    metric_payload = {
        "query": "What does this number mean?",
        "current_route": "/dashboard",
        "selected_context": {
            "type": "metric",
            "title": "AOV Performance",
            "data": {
                "formatted_value": "$142.50",
                "trend": "downward"
            }
        }
    }
    res = client.post("/api/agent/chat", json=metric_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "selected_element"
    assert "$142.50" in data["answer"]
    assert "downward" in data["answer"]


def test_31_regression_followup_explains_earlier_claim():
    """Regression Test 8: 'Why did you say that?' refers to preceding turn in session history."""
    conv_id = "test-session-regression-followup"
    # Turn 1
    res1 = client.post("/api/agent/chat", json={
        "query": "What is the 30-day revenue?",
        "conversation_id": conv_id,
        "current_route": "/sales"
    })
    assert res1.status_code == 200

    # Turn 2: Follow-up question asking reason behind statement
    res2 = client.post("/api/agent/chat", json={
        "query": "Why did you say that?",
        "conversation_id": conv_id,
        "current_route": "/sales"
    })
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["intent"] == "follow_up"
    assert "sales database" in data2["answer"].lower() or "transactions" in data2["answer"].lower()


def test_32_regression_general_question_from_inventory_page_zero_tools():
    """Regression Test 9: General definition asked from /inventory route returns zero DB tools, zero citations."""
    res = client.post("/api/agent/chat", json={
        "query": "What is FIFO?",
        "current_route": "/inventory"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "general_knowledge"
    assert "first-in, first-out" in data["answer"].lower()
    assert data["citations"] == []
    assert data["canvas"] is None
    assert data["tool_traces"] == []


def test_33_regression_missing_evidence_reported_honestly_no_fabrication():
    """Regression Test 10: Missing evidence (non-existent SKU/order) reported honestly without fallback or fabrication."""
    # 1. Non-existent SKU stock
    res_sku = client.post("/api/agent/chat", json={
        "query": "How many units of SKU #99999 are in stock?",
        "current_route": "/inventory"
    })
    assert res_sku.status_code == 200
    data_sku = res_sku.json()
    assert "not found" in data_sku["answer"].lower() or "no inventory records exist" in data_sku["answer"].lower()
    assert data_sku["citations"] == []
    assert data_sku["canvas"] is None

    # 2. Non-existent Order status
    res_ord = client.post("/api/agent/chat", json={
        "query": "What is the status of Order #99999?",
        "current_route": "/sales"
    })
    assert res_ord.status_code == 200
    data_ord = res_ord.json()
    assert "order #99999 was not found" in data_ord["answer"].lower()
    assert data_ord["citations"] == []
    assert data_ord["canvas"] is None


def test_34_regression_calculation_based_on_application_records():
    """Regression Test 11: Calculation based on application records (average selling price)."""
    res = client.post("/api/agent/chat", json={
        "query": "What is the average selling price across all catalog products?",
        "current_route": "/products"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "application_data"
    assert "average selling price" in data["answer"].lower()
    assert "$" in data["answer"]
    assert len(data["citations"]) >= 1


def test_35_regression_discrepancy_and_conflicting_records_audit():
    """Regression Test 12: Question with conflicting records / discrepancy audit."""
    res = client.post("/api/agent/chat", json={
        "query": "Are there any discrepancies between sales orders and inventory movements?",
        "current_route": "/inventory"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "application_data"
    assert "audit" in data["answer"].lower() or "discrepanc" in data["answer"].lower()
    assert len(data["citations"]) >= 1


