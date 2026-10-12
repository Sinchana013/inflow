"""
Automated Chart Selection Evaluation Test Suite for InsightFlow AI.

Eval Cases Required:
1. Monthly revenue question must produce a line chart.
2. "share of sales by category" with 4 categories must produce a pie or donut.
3. "share of sales by category" with 12 categories must produce a sorted bar or treemap.
4. "price vs units sold" must produce a scatter.
5. "product by month sales" must produce a heatmap.
6. A single-number question must produce no chart.
7. Negative values must disallow pie/donut and fallback to sorted bar.
8. Unordered categories must disallow line chart and fallback to bar.
9. Time series exceeding 4 series groups excess series into "Other".
10. Period-over-period variance drivers produce waterfall chart.
11. Two measures with different units ($ and %) over time produce combo chart.
12. Ranking query produces horizontal bar chart.

Also computes and reports the Chart-Type Accuracy Metric.
"""

import pytest
from app.agent.chart_selector import ChartType, select_chart, analyze_data_shape, compute_allowed_chart_types


def test_eval_case_1_monthly_revenue_produces_line():
    """Eval Case 1: A monthly revenue question must produce a line chart."""
    query = "What is the monthly revenue trend over the past 6 months?"
    data = [
        {"period": "2024-01", "revenue": 14200.0, "order_count": 32},
        {"period": "2024-02", "revenue": 15800.0, "order_count": 36},
        {"period": "2024-03", "revenue": 16900.0, "order_count": 40},
        {"period": "2024-04", "revenue": 13500.0, "order_count": 28},
        {"period": "2024-05", "revenue": 18200.0, "order_count": 44},
        {"period": "2024-06", "revenue": 19400.0, "order_count": 48},
    ]
    res = select_chart(query=query, data=data)
    assert res.selected_chart_type in [ChartType.LINE, ChartType.AREA]
    assert res.selected_chart_type == ChartType.LINE
    assert "time series" in res.rationale.lower() or "trend" in res.rationale.lower()
    # Negative rule: Never use pie or donut for time series
    assert ChartType.DONUT not in res.allowed_chart_types
    assert ChartType.PIE not in res.allowed_chart_types


def test_eval_case_2_share_of_sales_4_categories_produces_pie_or_donut():
    """Eval Case 2: 'share of sales by category' with 4 categories must produce a pie or donut."""
    query = "What is the share of sales by category?"
    data = [
        {"category": "Electronics", "revenue": 45000.0, "share_pct": 45.0},
        {"category": "Furniture", "revenue": 25000.0, "share_pct": 25.0},
        {"category": "Accessories", "revenue": 20000.0, "share_pct": 20.0},
        {"category": "Office", "revenue": 10000.0, "share_pct": 10.0},
    ]
    res = select_chart(query=query, data=data)
    assert res.selected_chart_type in [ChartType.DONUT, ChartType.PIE]
    assert ChartType.DONUT in res.allowed_chart_types or ChartType.PIE in res.allowed_chart_types
    assert "part-to-whole" in res.rationale.lower() or "4 categories" in res.rationale.lower()


def test_eval_case_3_share_of_sales_12_categories_produces_sorted_bar_or_treemap():
    """Eval Case 3: 'share of sales by category' with 12 categories must produce a sorted bar or treemap (NEVER pie/donut)."""
    query = "What is the share of sales by category?"
    data = [
        {"category": f"Category {i+1}", "revenue": 1000.0 * (15 - i), "share_pct": round(100.0 / 12, 1)}
        for i in range(12)
    ]
    res = select_chart(query=query, data=data)
    # Strict rule: Pie or donut is NEVER allowed for more than 5 slices!
    assert ChartType.DONUT not in res.allowed_chart_types
    assert ChartType.PIE not in res.allowed_chart_types
    assert res.selected_chart_type in [ChartType.BAR, ChartType.HORIZONTAL_BAR, ChartType.TREEMAP]
    assert "12 categories" in res.rationale.lower() or ">5" in res.rationale.lower() or "sorted bar" in res.rationale.lower()


def test_eval_case_4_price_vs_units_sold_produces_scatter():
    """Eval Case 4: 'price vs units sold' must produce a scatter plot."""
    query = "What is the correlation between price vs units sold?"
    data = [
        {"product_name": f"Product {i+1}", "price": 20.0 + i * 15.0, "units_sold": 200 - i * 12}
        for i in range(10)
    ]
    res = select_chart(query=query, data=data)
    assert res.selected_chart_type == ChartType.SCATTER
    assert ChartType.SCATTER in res.allowed_chart_types
    assert "scatter" in res.rationale.lower() or "two numeric measures" in res.rationale.lower()


def test_eval_case_5_product_by_month_sales_produces_heatmap():
    """Eval Case 5: 'product by month sales' must produce a heatmap."""
    query = "Show product by month sales performance matrix"
    data = [
        {"product": "Keyboard", "month": "Jan", "sales": 4000},
        {"product": "Keyboard", "month": "Feb", "sales": 4200},
        {"product": "Earbuds", "month": "Jan", "sales": 8000},
        {"product": "Earbuds", "month": "Feb", "sales": 8500},
    ]
    res = select_chart(query=query, data=data)
    assert res.selected_chart_type in [ChartType.HEATMAP, ChartType.STACKED_BAR]
    assert ChartType.HEATMAP in res.allowed_chart_types


def test_eval_case_6_single_number_question_produces_no_chart():
    """Eval Case 6: A single-number question (< 3 data points) must produce no chart (KPI card / table)."""
    query = "What is the total inventory valuation?"
    data = [
        {"metric": "total_inventory_valuation", "value": 154200.0}
    ]
    res = select_chart(query=query, data=data)
    assert res.selected_chart_type == ChartType.NO_CHART
    assert res.allowed_chart_types == [ChartType.NO_CHART]
    assert "no chart" in res.rationale.lower() or "fewer than 3" in res.rationale.lower()


def test_eval_case_7_negative_values_disallow_pie_and_donut():
    """Rule Check: Pie/donut is NEVER allowed for negative values; model proposal is rejected."""
    query = "What is the profit share by category?"
    data = [
        {"category": "Electronics", "profit": 5000.0},
        {"category": "Furniture", "profit": -1200.0},  # Negative value
        {"category": "Office", "profit": 3500.0},
    ]
    # Model mistakenly proposes a donut chart
    res = select_chart(query=query, data=data, proposed_type="donut_chart")
    assert ChartType.DONUT not in res.allowed_chart_types
    assert ChartType.PIE not in res.allowed_chart_types
    assert res.mismatch_logged is True
    assert res.selected_chart_type in [ChartType.BAR, ChartType.HORIZONTAL_BAR]


def test_eval_case_8_unordered_categories_disallow_line_chart():
    """Rule Check: Line chart is NEVER allowed for unordered categories; model proposal is rejected."""
    query = "Compare sales across geographical territories"
    data = [
        {"region": "North America", "revenue": 50000.0},
        {"region": "Europe", "revenue": 38000.0},
        {"region": "Asia Pacific", "revenue": 62000.0},
        {"region": "Latin America", "revenue": 14000.0},
    ]
    # Model mistakenly proposes line chart for unordered categorical data
    res = select_chart(query=query, data=data, proposed_type="line_chart")
    assert ChartType.LINE not in res.allowed_chart_types
    assert res.mismatch_logged is True
    assert res.selected_chart_type in [ChartType.BAR, ChartType.HORIZONTAL_BAR, ChartType.DONUT]


def test_eval_case_9_series_limiting_and_other_grouping():
    """Rule Check: Time series limits to 4 series and groups excess into 'Other'."""
    query = "Show monthly revenue trends across product lines"
    data = [
        {
            "period": f"2024-0{i+1}",
            "series_a": 100,
            "series_b": 200,
            "series_c": 300,
            "series_d": 400,
            "series_e": 500,  # 5th series
            "series_f": 600,  # 6th series
        }
        for i in range(5)
    ]
    res = select_chart(query=query, data=data)
    assert len(res.series_keys) <= 4
    assert "Other" in res.series_keys
    assert res.processed_data[0]["Other"] == 1500  # 400 + 500 + 600


def test_eval_case_10_waterfall_revenue_bridge():
    """Rule Check: What drove change between periods produces waterfall chart."""
    query = "What drove the revenue change between last month and this month?"
    data = [
        {"driver": "Starting Revenue", "amount": 100000},
        {"driver": "Electronics Growth", "amount": 15000},
        {"driver": "Furniture Drop", "amount": -8000},
        {"driver": "Ending Revenue", "amount": 107000},
    ]
    res = select_chart(query=query, data=data)
    assert res.selected_chart_type == ChartType.WATERFALL
    assert ChartType.WATERFALL in res.allowed_chart_types


def test_eval_case_11_combo_chart_for_different_units():
    """Rule Check: Two measures with different units ($ and %) over time produce combo chart."""
    query = "Show monthly revenue and gross margin percent over time"
    data = [
        {"period": "2024-01", "revenue": 50000, "margin_percent": 35.2},
        {"period": "2024-02", "revenue": 54000, "margin_percent": 36.1},
        {"period": "2024-03", "revenue": 58000, "margin_percent": 34.8},
        {"period": "2024-04", "revenue": 62000, "margin_percent": 38.0},
    ]
    res = select_chart(query=query, data=data)
    assert res.selected_chart_type == ChartType.COMBO
    assert ChartType.COMBO in res.allowed_chart_types


def test_eval_case_12_ranking_produces_horizontal_bar():
    """Rule Check: Ranking query produces sorted horizontal bar."""
    query = "Rank the top products by revenue"
    data = [
        {"product": "Wireless Earbuds", "revenue": 48000},
        {"product": "Ergonomic Chair", "revenue": 32000},
        {"product": "Mechanical Keyboard", "revenue": 29000},
        {"product": "USB Hub", "revenue": 14000},
    ]
    res = select_chart(query=query, data=data)
    assert res.selected_chart_type in [ChartType.HORIZONTAL_BAR, ChartType.BAR]
    assert res.is_horizontal is True or res.selected_chart_type == ChartType.HORIZONTAL_BAR


def test_chart_type_accuracy_metric():
    """
    Computes and reports the Chart-Type Accuracy Metric across all standard eval cases.
    Verifies that the accuracy metric achieves 100.0%.
    """
    cases = [
        # (id, description, query, data, expected_types)
        (
            1,
            "monthly revenue question",
            "What is the monthly revenue trend?",
            [{"period": f"2024-0{i}", "revenue": 10000 * i} for i in range(1, 6)],
            [ChartType.LINE]
        ),
        (
            2,
            "share of sales by category (4 categories)",
            "What is the share of sales by category?",
            [{"category": f"Cat {i}", "sales": 100 * i} for i in range(1, 5)],
            [ChartType.DONUT, ChartType.PIE]
        ),
        (
            3,
            "share of sales by category (12 categories)",
            "What is the share of sales by category?",
            [{"category": f"Cat {i}", "sales": 100 * i} for i in range(1, 13)],
            [ChartType.BAR, ChartType.HORIZONTAL_BAR, ChartType.TREEMAP]
        ),
        (
            4,
            "price vs units sold",
            "Price vs units sold analysis",
            [{"product": f"P{i}", "price": 10 * i, "units_sold": 100 - i} for i in range(1, 6)],
            [ChartType.SCATTER]
        ),
        (
            5,
            "product by month sales",
            "Show product by month sales matrix",
            [{"product": f"P{i}", "month": "Jan", "sales": 100 * i} for i in range(1, 5)],
            [ChartType.HEATMAP, ChartType.STACKED_BAR]
        ),
        (
            6,
            "single-number question",
            "What is our total revenue?",
            [{"metric": "total_revenue", "value": 500000}],
            [ChartType.NO_CHART]
        ),
        (
            7,
            "cumulative totals over time",
            "Show cumulative revenue over time",
            [{"period": f"2024-0{i}", "cumulative_revenue": 15000 * i} for i in range(1, 6)],
            [ChartType.AREA, ChartType.LINE]
        ),
        (
            8,
            "what drove change (revenue bridge)",
            "What drove the revenue change between periods?",
            [{"driver": f"D{i}", "amount": 100 * i} for i in range(1, 5)],
            [ChartType.WATERFALL]
        ),
        (
            9,
            "different units over time ($ and %)",
            "Monthly revenue and margin percent over time",
            [{"period": f"2024-0{i}", "revenue": 10000 * i, "margin_percent": 30 + i} for i in range(1, 6)],
            [ChartType.COMBO]
        ),
        (
            10,
            "ranking top products",
            "Rank the top sales items",
            [{"product": f"P{i}", "revenue": 1000 * (10 - i)} for i in range(1, 6)],
            [ChartType.HORIZONTAL_BAR, ChartType.BAR]
        )
    ]

    total_cases = len(cases)
    passed_cases = 0
    results_breakdown = []

    for case_id, desc, q, d, expected in cases:
        res = select_chart(query=q, data=d)
        is_correct = res.selected_chart_type in expected
        if is_correct:
            passed_cases += 1
            status = "PASS"
        else:
            status = f"FAIL (Got {res.selected_chart_type.value}, Expected {[e.value for e in expected]})"

        results_breakdown.append(f"  Case {case_id:2d}: [{status:4s}] {desc} -> {res.selected_chart_type.value}")

    accuracy_percent = (passed_cases / total_cases) * 100.0

    report = (
        "\n"
        "============================================================\n"
        "CHART-TYPE SELECTION ACCURACY EVALUATION METRIC\n"
        "============================================================\n"
        f"Total Evaluation Cases Tested : {total_cases}\n"
        f"Compliant Chart Selections    : {passed_cases}\n"
        f"Chart-Type Accuracy Metric    : {accuracy_percent:.1f}%\n"
        "Detailed Results:\n" +
        "\n".join(results_breakdown) + "\n"
        "============================================================\n"
    )

    print(report)
    assert accuracy_percent == 100.0, f"Chart-Type accuracy metric was {accuracy_percent:.1f}%, expected 100.0%!"
