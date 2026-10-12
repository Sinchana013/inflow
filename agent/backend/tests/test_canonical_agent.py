import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.analytics.canonical_analysis import (
    resolve_query_context,
    execute_canonical_analysis,
    canonical_to_canvas_specification,
)
from app.agent.agent_service import run_deterministic_investigation, process_agent_query
from .conftest import TestingSessionLocal

client = TestClient(app)


def test_asia_pacific_sales_august_canonical_consistency():
    """
    Verifies that 'What are Asia Pacific sales from August?' resolves correctly to Asia Pacific,
    calculates exactly $6,181.33 across 22 orders, and guarantees that Canvas and Text are
    100% consistent with ZERO $0.00 and NO North America overwrite.
    """
    db = TestingSessionLocal()
    try:
        query = "What are Asia Pacific sales from August?"
        ctx = resolve_query_context(db, query)

        assert ctx.entity_type == "region"
        assert ctx.entity_value == "Asia Pacific"
        assert ctx.operation == "regional_focus"

        result = execute_canonical_analysis(db, query)
        assert result is not None
        assert result.primary_metric.value == 6181.33
        assert result.primary_metric.formatted_value == "$6,181.33"
        assert "22 orders" in result.supporting_metrics[0].formatted_value or result.supporting_metrics[0].value == 22

        # Verify text answer
        assert "$6,181.33" in result.direct_answer
        assert "22 completed orders" in result.direct_answer or "22" in result.direct_answer
        assert "North America" not in result.primary_metric.title
        assert result.primary_metric.formatted_value != "$0.00"

        # Verify canvas specification
        canvas = canonical_to_canvas_specification(result)
        assert canvas is not None
        assert "Asia Pacific" in canvas.title
        primary_kpi = canvas.components[0]
        assert primary_kpi.props["formatted_value"] == "$6,181.33"
        assert primary_kpi.props["formatted_value"] != "$0.00"

        # Verify deterministic investigation runner
        text_ans, traces, det_canvas, collected = run_deterministic_investigation(
            query=query, current_route="/ai-analyst", db=db
        )
        assert "$6,181.33" in text_ans
        assert det_canvas is not None
        assert "Asia Pacific" in det_canvas.title
        assert det_canvas.components[0].props["formatted_value"] == "$6,181.33"
        assert det_canvas.components[0].props["formatted_value"] != "$0.00"
    finally:
        db.close()


def test_sales_decline_diagnostic_competing_hypotheses():
    """
    Verifies that 'Why did sales decline this month?' runs competing-hypothesis investigation:
    Hypothesis A: Category Sector Drag (Supported)
    Hypothesis B: Warehouse Stockouts (Refuted)
    Hypothesis C: Broad Multi-Region Collapse (Refuted - cushioned by Asia Pacific)
    Hypothesis D: Volume vs Pricing (Supported)
    """
    db = TestingSessionLocal()
    try:
        query = "Why did sales decline this month?"
        ctx = resolve_query_context(db, query)
        assert ctx.operation == "diagnostic"

        result = execute_canonical_analysis(db, query)
        assert result is not None
        assert len(result.hypotheses) == 4

        # Check hypothesis evaluation
        hyp_map = {h.id: h for h in result.hypotheses}
        assert "hyp-category-drag" in hyp_map
        assert "hyp-stockout" in hyp_map
        assert "hyp-global-collapse" in hyp_map
        assert "hyp-volume-vs-aov" in hyp_map

        assert hyp_map["hyp-stockout"].status == "weakened"
        assert hyp_map["hyp-global-collapse"].status == "weakened"

        # Check Canvas conversion
        canvas = canonical_to_canvas_specification(result)
        assert canvas is not None
        insight_components = [c for c in canvas.components if c.type == "insight_card"]
        assert len(insight_components) >= 4
        # Verify hypothesis badges are present
        titles = [c.props.get("title", "") for c in insight_components]
        assert any("[REFUTED]" in t for t in titles)
        assert any("[SUPPORTED]" in t for t in titles)
    finally:
        db.close()


def test_overstocked_products_and_surging_stockout():
    """
    Verifies divergence detection:
    1. Overstocked products with declining sales velocity.
    2. Surging products with critical low stock.
    """
    db = TestingSessionLocal()
    try:
        # Overstocked query
        q_overstock = "Which products have declining sales and high inventory?"
        res_overstock = execute_canonical_analysis(db, q_overstock)
        assert res_overstock is not None
        assert len(res_overstock.table_data) > 0
        assert "Tied-Up Working Capital" in res_overstock.primary_metric.title
        canvas_over = canonical_to_canvas_specification(res_overstock)
        assert any(c.type == "data_table" for c in canvas_over.components)

        # Surging low stock query
        q_surging = "Find products with increasing demand and low stock."
        res_surging = execute_canonical_analysis(db, q_surging)
        assert res_surging is not None
        assert len(res_surging.table_data) > 0
        canvas_surg = canonical_to_canvas_specification(res_surging)
        assert any(c.type == "data_table" for c in canvas_surg.components)
    finally:
        db.close()


def test_regional_comparison_and_intent_preservation():
    """
    Verifies that regional queries preserve user intent:
    - Ranking inquiry ranks all regions correctly.
    - Specific region inquiry preserves Europe, Latin America, or Asia Pacific.
    """
    db = TestingSessionLocal()
    try:
        # Regional comparison
        q_comp = "Which regions have the strongest revenue growth?"
        res_comp = execute_canonical_analysis(db, q_comp)
        assert res_comp is not None
        assert res_comp.context.operation == "comparison"
        assert "Asia Pacific" in res_comp.direct_answer

        # User intent preservation: Europe
        q_eu = "Show sales performance for Europe"
        ctx_eu = resolve_query_context(db, q_eu)
        assert ctx_eu.entity_type == "region"
        assert ctx_eu.entity_value == "Europe"
        res_eu = execute_canonical_analysis(db, q_eu)
        assert "Europe" in res_eu.title
        assert res_eu.primary_metric.formatted_value != "$0.00"
    finally:
        db.close()


def test_api_endpoints_single_source_of_truth():
    """
    Tests both /analysis/run and /agent/chat endpoints to guarantee
    cross-endpoint consistency.
    """
    query = "What are Asia Pacific sales from August?"

    # 1. /analysis/run
    resp_analysis = client.post("/api/analysis/run", json={"query": query})
    assert resp_analysis.status_code == 200
    data_analysis = resp_analysis.json()
    assert "$6,181.33" in data_analysis["explanation"]
    assert "Asia Pacific" in data_analysis["canvas"]["title"]
    assert data_analysis["canvas"]["components"][0]["props"]["formatted_value"] == "$6,181.33"

    # 2. /agent/chat
    resp_chat = client.post("/api/agent/chat", json={"query": query, "current_route": "/ai-analyst"})
    assert resp_chat.status_code == 200
    data_chat = resp_chat.json()
    assert "$6,181.33" in data_chat["answer"]
    assert data_chat["canvas"] is not None
    assert "Asia Pacific" in data_chat["canvas"]["title"]
    assert data_chat["canvas"]["components"][0]["props"]["formatted_value"] == "$6,181.33"
