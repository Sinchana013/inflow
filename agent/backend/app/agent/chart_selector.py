"""
Deterministic Chart Selection Engine for InsightFlow AI.

Rules & Guidelines:
1. Trend over time (revenue by day, week, month): line.
   Cumulative totals or volume: area.
   Limit to 4 series; beyond that, show top series and group rest as "Other".
2. Comparing categories (sales by product, region, rep): bar.
   Sort descending, switch to horizontal bars when labels are long (>15 chars) or >7 categories.
   Show top N plus "Other".
3. Ranking: horizontal bar, sorted, with value labelled on each bar.
4. Part-to-whole: pie or donut ONLY when 2-5 slices, all positive, adds to meaningful total.
   With >5 slices or comparing exact sizes: sorted bar or treemap.
5. Composition over time: stacked area or stacked bar (100% stacked for share).
6. Two numeric measures against each other: scatter (optional bubble size).
7. Two categorical dimensions: heatmap.
8. Distribution: histogram or box plot.
9. What drove change between periods: waterfall (revenue bridge).
10. Conversion / pipeline stages: funnel.
11. Actual vs target: bullet chart or gauge (KPI-style).
12. Two measures with different units over time: combo chart (bar + line with secondary axis).
13. Geographic breakdown (state/city): map or choropleth.
14. Single value or <3 data points: NO chart (use KPI card or table).

Negative Rules:
- NEVER pie/donut for time series, negative values, or >5 slices.
- NEVER line for unordered categories.
- NEVER dual axes unless measures have different units.
- Maximum 2 charts per answer, each answering a different part of the question.
- Every chart needs a descriptive title, labelled axes with units, sorted data, accessible palette.
- If a chart adds nothing beyond a table or KPI, leave it out.
"""

from enum import Enum
from typing import List, Dict, Any, Optional, Set, Tuple
from dataclasses import dataclass, field
import re
import logging

logger = logging.getLogger("agent.chart_selector")


class ChartType(str, Enum):
    LINE = "line_chart"
    AREA = "area_chart"
    BAR = "bar_chart"
    HORIZONTAL_BAR = "horizontal_bar_chart"
    PIE = "pie_chart"
    DONUT = "donut_chart"
    TREEMAP = "treemap"
    STACKED_BAR = "stacked_bar_chart"
    STACKED_AREA = "stacked_area_chart"
    SCATTER = "scatter_chart"
    HEATMAP = "heatmap"
    HISTOGRAM = "histogram"
    BOX_PLOT = "box_plot"
    WATERFALL = "waterfall_chart"
    FUNNEL = "funnel_chart"
    BULLET = "bullet_chart"
    COMBO = "combo_chart"
    MAP = "map"
    NO_CHART = "no_chart"


CHART_TYPE_ALIASES: Dict[str, ChartType] = {
    "line": ChartType.LINE,
    "line_chart": ChartType.LINE,
    "area": ChartType.AREA,
    "area_chart": ChartType.AREA,
    "bar": ChartType.BAR,
    "bar_chart": ChartType.BAR,
    "sorted_bar": ChartType.BAR,
    "horizontal_bar": ChartType.HORIZONTAL_BAR,
    "horizontal_bar_chart": ChartType.HORIZONTAL_BAR,
    "ranking": ChartType.HORIZONTAL_BAR,
    "pie": ChartType.PIE,
    "pie_chart": ChartType.PIE,
    "donut": ChartType.DONUT,
    "donut_chart": ChartType.DONUT,
    "treemap": ChartType.TREEMAP,
    "stacked_bar": ChartType.STACKED_BAR,
    "stacked_bar_chart": ChartType.STACKED_BAR,
    "stacked_area": ChartType.STACKED_AREA,
    "stacked_area_chart": ChartType.STACKED_AREA,
    "scatter": ChartType.SCATTER,
    "scatter_chart": ChartType.SCATTER,
    "scatterplot": ChartType.SCATTER,
    "heatmap": ChartType.HEATMAP,
    "histogram": ChartType.HISTOGRAM,
    "box_plot": ChartType.BOX_PLOT,
    "boxplot": ChartType.BOX_PLOT,
    "waterfall": ChartType.WATERFALL,
    "waterfall_chart": ChartType.WATERFALL,
    "funnel": ChartType.FUNNEL,
    "funnel_chart": ChartType.FUNNEL,
    "bullet": ChartType.BULLET,
    "bullet_chart": ChartType.BULLET,
    "gauge": ChartType.BULLET,
    "combo": ChartType.COMBO,
    "combo_chart": ChartType.COMBO,
    "map": ChartType.MAP,
    "choropleth": ChartType.MAP,
    "none": ChartType.NO_CHART,
    "no_chart": ChartType.NO_CHART,
    "kpi": ChartType.NO_CHART,
    "table": ChartType.NO_CHART,
}


@dataclass
class DataShape:
    row_count: int
    time_columns: List[str]
    categorical_columns: List[str]
    numeric_columns: List[str]
    has_negative_values: bool
    num_categories: int
    max_label_length: int
    numeric_min: float
    numeric_max: float
    has_location_columns: bool
    unique_time_points: int


@dataclass
class ChartSelectionResult:
    selected_chart_type: ChartType
    allowed_chart_types: List[ChartType]
    rationale: str
    mismatch_logged: bool = False
    original_proposal: Optional[str] = None
    processed_data: List[Dict[str, Any]] = field(default_factory=list)
    series_keys: List[str] = field(default_factory=list)
    category_key: Optional[str] = None
    is_horizontal: bool = False
    title: str = ""
    x_axis_label: Optional[str] = None
    y_axis_label: Optional[str] = None
    secondary_y_axis_label: Optional[str] = None


TIME_KEY_PATTERNS = re.compile(r"(date|month|day|week|year|period|time|timestamp|quarter)", re.IGNORECASE)
LOCATION_KEY_PATTERNS = re.compile(r"(state|city|country|region|location|zip|postal|province)", re.IGNORECASE)


def normalize_chart_type(t: Optional[str]) -> Optional[ChartType]:
    if not t:
        return None
    key = str(t).strip().lower().replace("-", "_").replace(" ", "_")
    return CHART_TYPE_ALIASES.get(key)


def analyze_data_shape(data: List[Dict[str, Any]]) -> DataShape:
    if not data or not isinstance(data, list):
        return DataShape(
            row_count=0,
            time_columns=[],
            categorical_columns=[],
            numeric_columns=[],
            has_negative_values=False,
            num_categories=0,
            max_label_length=0,
            numeric_min=0.0,
            numeric_max=0.0,
            has_location_columns=False,
            unique_time_points=0,
        )

    row_count = len(data)
    first_row = data[0] if row_count > 0 and isinstance(data[0], dict) else {}
    keys = list(first_row.keys())

    time_cols: List[str] = []
    cat_cols: List[str] = []
    num_cols: List[str] = []
    loc_cols: List[str] = []

    has_neg = False
    num_min = float("inf")
    num_max = float("-inf")
    max_label_len = 0

    for k in keys:
        if TIME_KEY_PATTERNS.search(k):
            time_cols.append(k)
        elif LOCATION_KEY_PATTERNS.search(k):
            loc_cols.append(k)

        # Inspect values
        sample_vals = [r.get(k) for r in data if isinstance(r, dict)]
        is_num = all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in sample_vals if v is not None)
        if is_num and any(v is not None for v in sample_vals):
            num_cols.append(k)
            for v in sample_vals:
                if isinstance(v, (int, float)) and not isinstance(v, bool):
                    if v < 0:
                        has_neg = True
                    num_min = min(num_min, float(v))
                    num_max = max(num_max, float(v))
        else:
            cat_cols.append(k)
            for v in sample_vals:
                if v is not None:
                    max_label_len = max(max_label_len, len(str(v)))

    # Unique categories count
    primary_cat = cat_cols[0] if cat_cols else (time_cols[0] if time_cols else None)
    if primary_cat:
        unique_cats = len(set(str(r.get(primary_cat)) for r in data if isinstance(r, dict)))
    else:
        unique_cats = row_count

    time_pts = 0
    if time_cols:
        time_pts = len(set(str(r.get(time_cols[0])) for r in data if isinstance(r, dict)))

    return DataShape(
        row_count=row_count,
        time_columns=time_cols,
        categorical_columns=cat_cols,
        numeric_columns=num_cols,
        has_negative_values=has_neg,
        num_categories=unique_cats,
        max_label_length=max_label_len,
        numeric_min=num_min if num_min != float("inf") else 0.0,
        numeric_max=num_max if num_max != float("-inf") else 0.0,
        has_location_columns=len(loc_cols) > 0,
        unique_time_points=time_pts,
    )


def compute_allowed_chart_types(
    query: str,
    shape: DataShape,
) -> Tuple[List[ChartType], ChartType, str]:
    """
    Deterministically computes allowed chart types and primary recommended chart based on
    strict intent and data shape rules.
    """
    q = query.lower()

    # Rule 14: Single value or fewer than 3 data points -> NO CHART
    if shape.row_count < 3 or (shape.row_count == 1 and len(shape.numeric_columns) <= 1):
        return (
            [ChartType.NO_CHART],
            ChartType.NO_CHART,
            "Single value or fewer than 3 data points, so no chart is shown (use KPI card or table).",
        )

    # Check query intent patterns
    is_part_to_whole = any(w in q for w in ["share of", "share", "percentage of", "proportion", "breakdown of", "part to whole", "composition of"])
    is_cumulative = any(w in q for w in ["cumulative", "accumulated", "running total", "running volume"])
    is_scatter = any(w in q for w in ["price vs units", "vs", "versus", "scatter", "discount vs margin", "correlation between"])
    is_heatmap = any(w in q for w in ["by month sales", "product by month", "matrix", "heatmap", "cross-tab", "region by category"])
    is_waterfall = any(w in q for w in ["what drove", "revenue bridge", "bridge", "variance driver", "period over period change", "waterfall"])
    is_distribution = any(w in q for w in ["distribution", "histogram", "box plot", "spread", "days of cover"])
    is_ranking = any(w in q for w in ["rank", "ranking", "top products", "top categories", "top sales", "leaderboard", "highest to lowest"])
    is_funnel = any(w in q for w in ["funnel", "pipeline", "stage", "conversion"])
    is_actual_vs_target = any(w in q for w in ["vs target", "target", "budget vs actual", "quota", "gauge", "bullet"])
    is_time_trend = (
        bool(shape.time_columns) or
        any(w in q for w in ["monthly", "daily", "weekly", "trend", "over time", "by month", "by day", "by week", "trajectory", "momentum", "history"])
    ) and not is_part_to_whole and not is_scatter and not is_heatmap

    # Check for dual units over time (e.g. revenue ($) and margin (%))
    has_different_units = (
        ("revenue" in q or "sales" in q or "$" in q) and
        ("margin" in q or "percent" in q or "%" in q or "rate" in q) and
        len(shape.numeric_columns) >= 2
    )

    allowed: List[ChartType] = []
    best_choice: ChartType
    rationale: str

    # 1. Waterfall (Revenue Bridge / What drove change)
    if is_waterfall:
        allowed = [ChartType.WATERFALL, ChartType.BAR]
        best_choice = ChartType.WATERFALL
        rationale = "Period-over-period variance bridge, so waterfall chart visualizes positive and negative drivers."
        return allowed, best_choice, rationale

    # 2. Funnel (Conversion / Pipeline)
    if is_funnel:
        allowed = [ChartType.FUNNEL, ChartType.BAR]
        best_choice = ChartType.FUNNEL
        rationale = "Conversion pipeline across sequential stages, so funnel chart visualizes stage drop-offs."
        return allowed, best_choice, rationale

    # 3. Two numeric measures against each other (Scatter)
    if is_scatter and len(shape.numeric_columns) >= 2 and not shape.time_columns:
        allowed = [ChartType.SCATTER]
        best_choice = ChartType.SCATTER
        rationale = "Two numeric measures plotted against each other, so scatter plot visualizes correlation without false category ordering."
        return allowed, best_choice, rationale

    # 4. Two categorical dimensions (Heatmap)
    if is_heatmap or (len(shape.categorical_columns) >= 2 and not shape.time_columns and shape.row_count >= 4):
        allowed = [ChartType.HEATMAP, ChartType.STACKED_BAR]
        best_choice = ChartType.HEATMAP
        rationale = "Two categorical dimensions evaluated simultaneously, so heatmap matrix displays density across both dimensions."
        return allowed, best_choice, rationale

    # 5. Distribution (Histogram / Box Plot)
    if is_distribution and not shape.time_columns:
        allowed = [ChartType.HISTOGRAM, ChartType.BOX_PLOT, ChartType.BAR]
        best_choice = ChartType.HISTOGRAM
        rationale = "Distribution of numerical values, so histogram displays frequency distribution across intervals."
        return allowed, best_choice, rationale

    # 6. Actual vs Target (Bullet / Gauge)
    if is_actual_vs_target and any(w in shape.numeric_columns for w in ["target", "actual", "goal", "budget"]):
        allowed = [ChartType.BULLET, ChartType.BAR]
        best_choice = ChartType.BULLET
        rationale = "Actual performance against target benchmark, so bullet chart displays progress against goal."
        return allowed, best_choice, rationale

    # 7. Two measures with different units over time (Combo)
    if is_time_trend and has_different_units:
        allowed = [ChartType.COMBO]
        best_choice = ChartType.COMBO
        rationale = "Two measures with different units ($ and %) over time, so combo chart with dual axis is required."
        return allowed, best_choice, rationale

    # 8. Time series trends
    if is_time_trend and shape.time_columns:
        if is_cumulative:
            allowed = [ChartType.AREA, ChartType.LINE]
            best_choice = ChartType.AREA
            rationale = "Cumulative totals over time, so area chart visualizes volume accumulation."
        else:
            allowed = [ChartType.LINE, ChartType.AREA]
            best_choice = ChartType.LINE
            rationale = "Time series with trend over time, so line chart displays chronological progression."
        # NEGATIVE RULE: Never use pie or donut for time series!
        return allowed, best_choice, rationale

    # 9. Part-to-whole
    if is_part_to_whole:
        # Strict Rule: Pie or donut only when 2-5 slices, all values positive
        if 2 <= shape.num_categories <= 5 and not shape.has_negative_values and not shape.time_columns:
            allowed = [ChartType.DONUT, ChartType.PIE, ChartType.BAR]
            best_choice = ChartType.DONUT
            rationale = f"Part-to-whole composition with {shape.num_categories} categories and all positive values, so donut chart is appropriate."
        else:
            # More slices (>5) or negative values or exact size comparison -> Sorted Bar or Treemap
            allowed = [ChartType.BAR, ChartType.HORIZONTAL_BAR, ChartType.TREEMAP]
            if shape.has_negative_values:
                best_choice = ChartType.BAR
                rationale = "Part-to-whole query contains negative values, which cannot be represented in a pie/donut; sorted bar chart is used."
            else:
                best_choice = ChartType.BAR
                rationale = f"Part-to-whole breakdown has {shape.num_categories} categories (>5 slices), so sorted bar/treemap is required instead of pie/donut."
        return allowed, best_choice, rationale

    # 10. Ranking
    if is_ranking:
        allowed = [ChartType.HORIZONTAL_BAR, ChartType.BAR]
        best_choice = ChartType.HORIZONTAL_BAR
        rationale = "Ranked comparison of entities, so sorted horizontal bar chart provides immediate top-to-bottom hierarchy."
        return allowed, best_choice, rationale

    # 11. Category comparisons
    if shape.categorical_columns or shape.row_count >= 3:
        # Determine whether horizontal bar is better (long labels >15 chars or >7 categories)
        if shape.max_label_length > 15 or shape.num_categories > 7:
            allowed = [ChartType.HORIZONTAL_BAR, ChartType.BAR]
            best_choice = ChartType.HORIZONTAL_BAR
            rationale = f"Category comparison with {shape.num_categories} categories/long labels, so horizontal bar chart prevents label truncation."
        else:
            # If 2-5 categories, positive, might also allow donut
            if 2 <= shape.num_categories <= 5 and not shape.has_negative_values and not shape.time_columns:
                allowed = [ChartType.BAR, ChartType.HORIZONTAL_BAR, ChartType.DONUT]
            else:
                allowed = [ChartType.BAR, ChartType.HORIZONTAL_BAR]
            best_choice = ChartType.BAR
            rationale = "Comparing discrete categories, so sorted bar chart displays categorical differences cleanly."

        # NEGATIVE RULE: Never use line chart for unordered categories!
        return allowed, best_choice, rationale

    # Default fallback if data is numeric series
    if shape.row_count >= 3:
        allowed = [ChartType.BAR, ChartType.LINE]
        best_choice = ChartType.BAR
        rationale = "Categorical metric comparison, so bar chart displays variance across records."
        return allowed, best_choice, rationale

    return (
        [ChartType.NO_CHART],
        ChartType.NO_CHART,
        "Data does not require a graphical chart; presented as KPI metric or structured table.",
    )


def select_chart(
    query: str,
    data: List[Dict[str, Any]],
    proposed_type: Optional[str] = None,
    proposed_rationale: Optional[str] = None,
    preferred_title: Optional[str] = None,
) -> ChartSelectionResult:
    """
    Main entry point: Analyzes data shape, checks rules, validates model proposal,
    and returns guaranteed compliant chart selection result.
    """
    shape = analyze_data_shape(data)
    allowed, best_choice, default_rationale = compute_allowed_chart_types(query, shape)

    normalized_proposed = normalize_chart_type(proposed_type)
    mismatch_logged = False
    chosen_type: ChartType
    chosen_rationale: str

    if normalized_proposed is not None:
        if normalized_proposed in allowed:
            chosen_type = normalized_proposed
            chosen_rationale = proposed_rationale or default_rationale
        else:
            # Model proposal rejected by code selector rules!
            mismatch_logged = True
            chosen_type = best_choice
            logger.warning(
                f"Chart selection mismatch: Model proposed '{proposed_type}' ({normalized_proposed.value}), "
                f"but allowed chart types for this shape and intent are {[t.value for t in allowed]}. "
                f"Selecting rule-compliant chart '{best_choice.value}'."
            )
            chosen_rationale = (
                f"{default_rationale} (Selector adjusted from proposed '{proposed_type}')"
            )
    else:
        chosen_type = best_choice
        chosen_rationale = default_rationale

    # Prepare data according to chart type rules
    processed = [dict(r) for r in data]
    is_horizontal = (chosen_type == ChartType.HORIZONTAL_BAR)

    # 1. Limit time series to 4 series; beyond that group as "Other"
    series_keys = list(shape.numeric_columns)
    if chosen_type in [ChartType.LINE, ChartType.AREA] and len(series_keys) > 4:
        top_keys = series_keys[:3]
        other_keys = series_keys[3:]
        for r in processed:
            r["Other"] = sum(float(r.get(k, 0)) for k in other_keys)
        series_keys = top_keys + ["Other"]

    # 2. Sort descending where order matters (Bar, Horizontal Bar, Waterfall)
    category_key = (
        shape.categorical_columns[0]
        if shape.categorical_columns
        else (shape.time_columns[0] if shape.time_columns else "category")
    )
    metric_key = series_keys[0] if series_keys else "value"

    if chosen_type in [ChartType.BAR, ChartType.HORIZONTAL_BAR, ChartType.TREEMAP]:
        try:
            processed = sorted(
                processed,
                key=lambda x: float(x.get(metric_key, 0) or 0),
                reverse=True
            )
        except Exception:
            pass

    # Axis labels
    x_axis = category_key.replace("_", " ").title() if not is_horizontal else metric_key.replace("_", " ").title()
    y_axis = metric_key.replace("_", " ").title() if not is_horizontal else category_key.replace("_", " ").title()

    title = preferred_title or f"{metric_key.replace('_', ' ').title()} by {category_key.replace('_', ' ').title()}"

    return ChartSelectionResult(
        selected_chart_type=chosen_type,
        allowed_chart_types=allowed,
        rationale=chosen_rationale,
        mismatch_logged=mismatch_logged,
        original_proposal=proposed_type,
        processed_data=processed,
        series_keys=series_keys,
        category_key=category_key,
        is_horizontal=is_horizontal,
        title=title,
        x_axis_label=x_axis,
        y_axis_label=y_axis,
    )
