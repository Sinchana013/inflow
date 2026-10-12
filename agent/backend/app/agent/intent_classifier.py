import re
from enum import Enum
from typing import Dict, Any, List, Optional
from pydantic import BaseModel


class QuestionIntent(str, Enum):
    GENERAL_KNOWLEDGE = "general_knowledge"
    WEBSITE_SPECIFIC = "website_specific"
    APPLICATION_DATA = "application_data"
    SELECTED_ELEMENT = "selected_element"
    COMPARISON_ANALYSIS = "comparison_analysis"
    ACTION_REQUEST = "action_request"
    FOLLOW_UP = "follow_up"


class IntentClassificationResult(BaseModel):
    intent: QuestionIntent
    confidence: float
    target_route: Optional[str] = None
    target_entity: Optional[str] = None
    requires_tools: bool = True
    requires_citations: bool = True
    requires_canvas: bool = False
    reasoning: str
    definition_text: Optional[str] = None
    page_metadata: Optional[Dict[str, Any]] = None


# Pre-defined repository of core conceptual definitions for enterprise supply-chain, finance, and operations
GENERAL_KNOWLEDGE_DEFINITIONS: Dict[str, str] = {
    "warehouse": "A warehouse is a commercial building used for the storage and management of goods and merchandise throughout the supply chain.",
    "supply chain": (
        "A supply chain is the end-to-end network of organizations, people, activities, information, and resources involved in transforming raw materials into finished products and delivering them to end customers."
    ),
    "supply chain management": (
        "Supply Chain Management (SCM) is the centralized management of the flow of goods, services, and data from raw material sourcing through manufacturing to final delivery, aiming to maximize customer value and achieve competitive advantage."
    ),
    "safety stock": (
        "Safety stock is an extra quantity of inventory held as a buffer against supply chain risks, forecast inaccuracies, supplier delivery delays, or unexpected surges in customer demand."
    ),
    "buffer stock": (
        "Buffer stock refers to reserve inventory maintained to absorb unforeseen disruptions in supply or sudden spikes in consumer demand, preventing costly stockouts."
    ),
    "reorder point": (
        "The reorder point is the minimum inventory threshold that triggers a replenishment order, typically calculated as: (Lead Time Demand) + Safety Stock."
    ),
    "fifo": (
        "First-In, First-Out (FIFO) is an inventory valuation and management method where the oldest stock acquired is assumed to be sold or used first, aligning product age with physical flow to minimize spoilage or obsolescence."
    ),
    "lifo": (
        "Last-In, First-Out (LIFO) is an inventory accounting method where the most recently produced or purchased items are recorded as sold first, often used during inflationary periods to reduce reported taxable income."
    ),
    "gross margin": (
        "Gross margin is the percentage of revenue retained after deducting the Direct Cost of Goods Sold (COGS), calculated as: ((Revenue - COGS) / Revenue) * 100."
    ),
    "cogs": (
        "Cost of Goods Sold (COGS) represents the direct costs attributable to the production or acquisition of the goods sold by a business, including raw materials and direct labor."
    ),
    "inventory turnover": (
        "Inventory turnover is an operational efficiency ratio measuring how frequently a business sells and replaces its stock over a defined period, calculated as: COGS divided by Average Inventory."
    ),
    "sku": (
        "A Stock Keeping Unit (SKU) is a unique alphanumeric code assigned to an individual product variant to track inventory levels, characteristics, and sales across retail and warehouse systems."
    ),
    "lead time": (
        "Lead time is the latency interval between initiating a replenishment purchase order and receiving the goods ready for fulfillment in the warehouse."
    ),
    "stockout": (
        "A stockout occurs when inventory for a specific product is entirely depleted, preventing customer order fulfillment and risking lost revenue and customer dissatisfaction."
    ),
    "erp": (
        "Enterprise Resource Planning (ERP) is integrated software used by organizations to manage core business processes across supply chain, manufacturing, financials, sales, and human resources in a unified database."
    ),
    "order lifecycle": (
        "The order lifecycle encompasses the progression of stages a purchase order undergoes from creation, through authorization, payment processing, picking, packing, shipping, and delivery completion or return."
    ),
    "working capital": (
        "Working capital is the difference between a business's current assets (cash, inventory, accounts receivable) and current liabilities, measuring operational liquidity and short-term financial health."
    )
}


def find_definition(term: str) -> Optional[str]:
    term_clean = term.lower().strip()
    term_clean = re.sub(r'^(?:what(?:\'s|\s+is|\s+are)\s+(?:a|an|the\s+concept\s+of)?|define|explain)\s+', '', term_clean)
    term_clean = term_clean.replace("?", "").strip()
    if term_clean in GENERAL_KNOWLEDGE_DEFINITIONS:
        return GENERAL_KNOWLEDGE_DEFINITIONS[term_clean]
    for k, v in GENERAL_KNOWLEDGE_DEFINITIONS.items():
        if k in term_clean or term_clean in k:
            return v
    for w in term_clean.split():
        if w in GENERAL_KNOWLEDGE_DEFINITIONS:
            return GENERAL_KNOWLEDGE_DEFINITIONS[w]
    return None


# Recognized application routes and their official UI descriptions
APPLICATION_PAGES: Dict[str, Dict[str, Any]] = {
    "/inventory": {
        "name": "Warehouse Inventory",
        "route": "/inventory",
        "subpage": "Stock Levels & Warehouse Overview",
        "element_id": "inventory-page-container",
        "description": (
            "The Warehouse Inventory page (/inventory) displays live stock levels on hand, total inventory valuation, "
            "safety reorder thresholds, and low-stock replenishment alerts across all catalog SKUs. "
            "It also features an audit log of recent inventory movements (restocks, adjustments, and order fulfillments) with direct stock adjustment controls."
        )
    },
    "/sales": {
        "name": "Sales Orders",
        "route": "/sales",
        "subpage": "Sales Orders & Transactions",
        "element_id": "sales-orders-table",
        "description": (
            "The Sales Orders page (/sales) presents completed and pending customer orders, transaction dates, customer IDs, "
            "order totals, fulfillment statuses (Pending, Processing, Completed, Cancelled), and regional/channel distribution."
        )
    },
    "/dashboard": {
        "name": "Executive Dashboard",
        "route": "/dashboard",
        "subpage": "Executive Overview",
        "element_id": "dashboard-overview",
        "description": (
            "The Executive Dashboard (/dashboard) consolidates high-level enterprise KPIs: 30-day completed revenue, "
            "order volumes, total catalog inventory valuation, active customer counts, revenue trends over time, and a live feed of recent business activities."
        )
    },
    "/customers": {
        "name": "Customers CRM",
        "route": "/customers",
        "subpage": "Customer CRM & Segmentation",
        "element_id": "customers-page-container",
        "description": (
            "The Customers page (/customers) provides customer account listings, geographic region tracking, "
            "cohort segmentation (High Value, Repeat, New, Inactive, Standard), repeat purchase rates, and customer lifetime value (CLV) analytics."
        )
    },
    "/products": {
        "name": "Product Catalog",
        "route": "/products",
        "subpage": "Catalog Performance & Margins",
        "element_id": "products-page-container",
        "description": (
            "The Product Catalog page (/products) details all company SKUs, unit selling prices, unit costs, "
            "gross profit margins, category classifications, and 60-day accelerating versus declining product velocity."
        )
    },
    "/reports": {
        "name": "Executive Reports",
        "route": "/reports",
        "subpage": "Business Intelligence & Exports",
        "element_id": "reports-page-container",
        "description": (
            "The Reports page (/reports) provides cross-module intelligence reports, category performance breakdowns, "
            "regional growth diagnostics, supply vs. demand alignment, and multi-format report exports (PDF, Excel, Word, PowerPoint)."
        )
    },
    "/ai-analyst": {
        "name": "AI Analyst Studio",
        "route": "/ai-analyst",
        "subpage": "Dynamic Intelligence Canvas",
        "element_id": "ai-analyst-container",
        "description": (
            "The AI Analyst page (/ai-analyst) delivers an interactive analytics workspace featuring automated diagnostic hypotheses, "
            "product intelligence reports, dynamic interactive visualization canvases, and cross-module correlations."
        )
    }
}


def classify_question_intent(
    query: str,
    current_route: Optional[str] = None,
    selected_context: Optional[Any] = None,
    history: Optional[List[Any]] = None
) -> IntentClassificationResult:
    """
    Intelligently classifies user query intent across 7 distinct categories.
    Determines whether to answer with general knowledge, inspect a webpage,
    retrieve specific application records, resolve a selected UI element,
    conduct diagnostic analysis, execute an action, or resolve a follow-up question.
    """
    q_clean = query.strip()
    q_lower = q_clean.lower()

    # Normalize current_route
    route = (current_route or "").split("?")[0].strip()

    # --------------------------------------------------------------------------
    # 1. FOLLOW-UP INTENT
    # --------------------------------------------------------------------------
    # Must have non-empty preceding conversation history to qualify as follow-up
    has_history = bool(history and len(history) > 0)
    followup_patterns = [
        r"^(?:why|how)\s+(?:did\s+you\s+say\s+that|is\s+that|so|come)\b",
        r"^(?:why\s+did\s+you\s+state\s+that|why\s+that\s+claim)\b",
        r"^(?:tell\s+me\s+more\s+about\s+(?:that|them|it|this))\b",
        r"^(?:what\s+about\s+(?:that|them|it))\b",
        r"^(?:can\s+you\s+elaborate|elaborate\s+on\s+that|explain\s+further)\b",
        r"^(?:what\s+was\s+the\s+previous|repeat\s+that|what\s+did\s+you\s+mean)\b",
        r"^why\?*$"
    ]
    if has_history and any(re.search(pat, q_lower) for pat in followup_patterns):
        return IntentClassificationResult(
            intent=QuestionIntent.FOLLOW_UP,
            confidence=0.95,
            target_route=route or "/dashboard",
            requires_tools=False,
            requires_citations=True,
            requires_canvas=False,
            reasoning="Query directly references claims or conclusions made in the preceding conversation turn."
        )

    # --------------------------------------------------------------------------
    # 2. SELECTED-ELEMENT INTENT
    # --------------------------------------------------------------------------
    # Check if query specifically targets an actively selected UI element
    selected_target_patterns = [
        r"\b(?:this|the\s+selected)\s+(?:chart|graph|plot|visualization|curve)\b",
        r"\b(?:this|the\s+selected)\s+(?:metric|number|kpi|figure|value|stat|statistic)\b",
        r"\b(?:this|the\s+selected)\s+(?:row|record|entry|table\s+row)\b",
        r"\b(?:this|the\s+selected)\s+(?:code|snippet|formula|script)\b",
        r"\b(?:this|the\s+selected)\s+(?:paragraph|sentence|claim|quote|excerpt|text)\b",
        r"\b(?:this|the\s+selected)\s+(?:recommendation|finding|insight|item)\b",
        r"^(?:explain|describe|analyze|what\s+does)\s+(?:this|it)\s*(?:mean|show|represent)?\??$",
        r"^why\s+is\s+this\s+(?:chart|number|metric)\s+"
    ]
    is_referring_to_selected = any(re.search(pat, q_lower) for pat in selected_target_patterns)

    # If selected_context is present and user specifically asks about "this" or "explain this"
    if selected_context and is_referring_to_selected:
        return IntentClassificationResult(
            intent=QuestionIntent.SELECTED_ELEMENT,
            confidence=0.98,
            target_route=getattr(selected_context, "route", None) or route,
            target_entity=getattr(selected_context, "type", None),
            requires_tools=False,
            requires_citations=True,
            requires_canvas=False,
            reasoning="Query specifically interrogates the actively selected UI element (chart, metric, row, or text)."
        )

    # --------------------------------------------------------------------------
    # 3. ACTION REQUESTS (Database Mutations)
    # --------------------------------------------------------------------------
    action_patterns = [
        r"\b(?:restock|add\s+stock|deduct\s+stock|reduce\s+stock|increase\s+stock|decrease\s+stock|adjust\s+inventory|adjust\s+stock)\b",
        r"\b(?:cancel\s+order|complete\s+order|mark\s+order|update\s+order\s+status)\b",
        r"\b(?:update\s+(?:reorder\s+)?threshold|set\s+(?:reorder\s+)?threshold|change\s+(?:reorder\s+)?threshold)\b"
    ]
    if any(re.search(pat, q_lower) for pat in action_patterns):
        return IntentClassificationResult(
            intent=QuestionIntent.ACTION_REQUEST,
            confidence=0.98,
            target_route=route or "/inventory",
            requires_tools=True,
            requires_citations=True,
            requires_canvas=True,
            reasoning="Query issues an operational mutation command modifying application records."
        )

    # --------------------------------------------------------------------------
    # 4. WEBSITE-SPECIFIC QUESTIONS (Inquiring about UI pages and application views)
    # --------------------------------------------------------------------------
    website_page_patterns = [
        r"what\s+does\s+(?:this|the)\s+(?:warehouse|inventory|sales|dashboard|customer|customers|product|products|reports?|analytics?|ai-analyst)\s+(?:page|screen|view|dashboard|tab)\s+show",
        r"what\s+(?:is\s+on|does)\s+this\s+(?:page|screen|view|tab)\b",
        r"what\s+can\s+i\s+do\s+on\s+this\s+(?:page|screen|view)\b",
        r"how\s+does\s+this\s+(?:page|screen|view)\s+work\b",
        r"explain\s+this\s+(?:page|screen|view)\b",
        r"what\s+is\s+the\s+purpose\s+of\s+this\s+(?:page|screen|view)\b",
        r"describe\s+(?:this|the)\s+(?:page|screen|view)\b"
    ]
    if any(re.search(pat, q_lower) for pat in website_page_patterns):
        # Determine target page from query or fall back to current_route
        matched_route = None
        if "warehouse" in q_lower or "inventory" in q_lower:
            matched_route = "/inventory"
        elif "sales" in q_lower or "order" in q_lower:
            matched_route = "/sales"
        elif "dashboard" in q_lower:
            matched_route = "/dashboard"
        elif "customer" in q_lower:
            matched_route = "/customers"
        elif "product" in q_lower:
            matched_route = "/products"
        elif "report" in q_lower:
            matched_route = "/reports"
        elif "analyst" in q_lower or "studio" in q_lower:
            matched_route = "/ai-analyst"
        else:
            matched_route = route or "/dashboard"

        page_info = APPLICATION_PAGES.get(matched_route, APPLICATION_PAGES["/inventory"])
        return IntentClassificationResult(
            intent=QuestionIntent.WEBSITE_SPECIFIC,
            confidence=0.96,
            target_route=matched_route,
            requires_tools=False,
            requires_citations=True,
            requires_canvas=False,
            page_metadata=page_info,
            reasoning=f"Query asks about the UI structure, contents, and purpose of application webpage '{matched_route}'."
        )

    # --------------------------------------------------------------------------
    # 5. GENERAL KNOWLEDGE INTENT (Definitions, Concepts, Industry Standards)
    # --------------------------------------------------------------------------
    has_app_ownership = bool(re.search(r"\b(?:our|my|this\s+company|we|insightflow|in\s+this\s+system|in\s+our\s+system)\b", q_lower))
    has_specific_record_ref = bool(re.search(r"\b(?:sku|order|customer|id|product)\s*#?\d+\b", q_lower))
    has_app_aggregation = bool(re.search(r"\b(?:total\s+valuation|inventory\s+valuation|running\s+low|in\s+stock|on\s+hand|units\s+left|units\s+remaining)\b", q_lower))

    general_concept_patterns = [
        r"^what(?:'s|\s+is|\s+are)\s+(?:a|an|the\s+concept\s+of|the\s+definition\s+of)?\s*([a-zA-Z\s\-]+?)\??$",
        r"^define\s+([a-zA-Z\s\-]+?)\??$",
        r"^explain\s+(?:what\s+(?:a|an)\s+)?([a-zA-Z\s\-]+?)(?:\s+is)?\??$",
        r"^what\s+does\s+([a-zA-Z\s\-]+?)\s+(?:mean|stand\s+for)\??$",
        r"^how\s+does\s+([a-zA-Z\s\-]+?)\s+work\??$",
        r"^what\s+is\s+the\s+purpose\s+of\s+(?:a|an)\s+([a-zA-Z\s\-]+?)\??$"
    ]

    is_general_structure = False
    extracted_concept = ""
    for pat in general_concept_patterns:
        m = re.match(pat, q_lower)
        if m:
            extracted_concept = m.group(1).strip() if m.groups() else ""
            is_general_structure = True
            break

    # If it matches general concept structure without application ownership or specific database references
    if is_general_structure and not has_app_ownership and not has_specific_record_ref and not has_app_aggregation:
        known_concepts = list(GENERAL_KNOWLEDGE_DEFINITIONS.keys())
        is_known_concept = any(c in extracted_concept or extracted_concept in c for c in known_concepts)
        conceptual_words = [
            "warehouse", "warehouses", "supply chain", "logistics", "safety stock", "buffer stock",
            "reorder point", "reorder threshold", "fifo", "lifo", "gross margin", "profit margin",
            "cogs", "inventory turnover", "sku", "lead time", "stockout", "erp", "order lifecycle",
            "working capital"
        ]

        if is_known_concept or any(w in extracted_concept for w in conceptual_words) or (extracted_concept in GENERAL_KNOWLEDGE_DEFINITIONS):
            def_text = find_definition(extracted_concept) or f"{extracted_concept.capitalize()} is a standard commercial and supply chain operational concept."
            return IntentClassificationResult(
                intent=QuestionIntent.GENERAL_KNOWLEDGE,
                confidence=0.97,
                target_entity=extracted_concept,
                requires_tools=False,
                requires_citations=False,
                requires_canvas=False,
                definition_text=def_text,
                reasoning=f"Query seeks general conceptual definition/explanation of '{extracted_concept}' without referencing internal application data."
            )

    # --------------------------------------------------------------------------
    # 6. COMPARISON AND ANALYSIS INTENT
    # --------------------------------------------------------------------------
    analytical_patterns = [
        r"\b(?:why\s+did\s+sales\s+decline|why\s+are\s+sales\s+dropping|why\s+did\s+revenue\s+drop)\b",
        r"\b(?:why\s+is\s+(?:the\s+)?inventory\s+value\s+declining|why\s+is\s+inventory\s+declining)\b",
        r"\b(?:compare\s+revenue\s+periods|compare\s+customer\s+purchases|compare\s+categories)\b",
        r"\b(?:root\s+cause|causation|correlation|contributing\s+factors|drivers\s+of\s+decline)\b",
        r"\b(?:sales\s+inventory\s+alignment|supply\s+vs\s+demand|capital\s+lockup)\b",
        r"\b(?:which\s+regions\s+have\s+the\s+strongest\s+revenue\s+growth)\b",
        r"\b(?:why\s+(?:did|is|are)\s+.*?\s+(?:decline|drop|fall|shrink|slow))\b",
        r"\b(?:category\s+contributed|which\s+category\s+contributed)\b",
        r"\b(?:declining\s+sales\s+and\s+high\s+inventory|dead\s+stock|slow\s+moving)\b"
    ]
    if any(re.search(pat, q_lower) for pat in analytical_patterns):
        return IntentClassificationResult(
            intent=QuestionIntent.COMPARISON_ANALYSIS,
            confidence=0.95,
            target_route=route or "/reports",
            requires_tools=True,
            requires_citations=True,
            requires_canvas=True,
            reasoning="Query requests diagnostic comparison, causal evaluation, or cross-period trend analysis."
        )

    # --------------------------------------------------------------------------
    # 7. APPLICATION-DATA INTENT (Metrics, Records, Stock Counts, Orders, Customers)
    # --------------------------------------------------------------------------
    app_data_patterns = [
        r"\b(?:total\s+inventory\s+valuation|inventory\s+valuation|stock\s+valuation)\b",
        r"\b(?:which\s+stock\s+items\s+are\s+running\s+low|low\s+stock\s+products|items\s+running\s+low|low\s+on\s+stock)\b",
        r"\b(?:how\s+many\s+units|how\s+much\s+stock|stock\s+of|units\s+in\s+stock|units\s+left|units\s+remaining)\b",
        r"\b(?:status\s+of\s+order|order\s+#?\d+|details\s+of\s+order)\b",
        r"\b(?:who\s+is\s+our\s+top\s+customer|top\s+customer|biggest\s+customer|highest\s+spending\s+customer)\b",
        r"\b(?:30-day\s+revenue|total\s+revenue|total\s+sales|company\s+revenue|sales\s+summary)\b",
        r"\b(?:current\s+business\s+activity|recent\s+business\s+activity|activity\s+log)\b",
        r"\b(?:product\s+intelligence|analyze\s+product|sku\s+intelligence)\b",
        r"\b(?:average\s+price|calculate|discrepanc(?:y|ies)|conflicting\s+records)\b",
        r"\b(?:sku|product|order|customer)\s*#?\d+\b",
        r"\b(?:stock\s+risk|revenue\s+trend|low\s+stock\s+alert|alerts?)\b"
    ]
    if any(re.search(pat, q_lower) for pat in app_data_patterns) or has_app_ownership or has_specific_record_ref or selected_context is not None:
        return IntentClassificationResult(
            intent=QuestionIntent.APPLICATION_DATA,
            confidence=0.94,
            target_route=route or "/dashboard",
            requires_tools=True,
            requires_citations=True,
            requires_canvas=False,
            reasoning="Query requests retrieval, calculation, or status verification of specific application records."
        )

    # --------------------------------------------------------------------------
    # 8. AMBIGUOUS / CONTEXT-ASSISTED FALLBACK
    # --------------------------------------------------------------------------
    if "this warehouse" in q_lower or "the warehouse" in q_lower:
        if route == "/inventory":
            return IntentClassificationResult(
                intent=QuestionIntent.APPLICATION_DATA,
                confidence=0.85,
                target_route="/inventory",
                requires_tools=True,
                requires_citations=True,
                requires_canvas=False,
                reasoning="Ambiguous reference 'this warehouse' resolved to active Inventory Page context (/inventory)."
            )
        else:
            def_text = find_definition("warehouse")
            return IntentClassificationResult(
                intent=QuestionIntent.GENERAL_KNOWLEDGE,
                confidence=0.80,
                target_entity="warehouse",
                requires_tools=False,
                requires_citations=False,
                requires_canvas=False,
                definition_text=def_text,
                reasoning="Ambiguous query 'this warehouse' without inventory route context resolved to general warehouse concept."
            )

    return IntentClassificationResult(
        intent=QuestionIntent.APPLICATION_DATA,
        confidence=0.85,
        target_route=route or "/dashboard",
        requires_tools=True,
        requires_citations=True,
        requires_canvas=False,
        reasoning="Defaulting to application data retrieval for operational inquiry."
    )
