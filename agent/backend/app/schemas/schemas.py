from typing import List, Optional, Any, Dict, Union
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

# ----------------- Customer Schemas -----------------
class CustomerBase(BaseModel):
    name: str
    email: str
    region: str

class CustomerCreate(CustomerBase):
    pass

class CustomerResponse(CustomerBase):
    id: int
    registration_date: datetime
    created_at: datetime
    total_orders: int = 0
    total_revenue: float = 0.0
    last_order_date: Optional[datetime] = None
    segment: str = "New"

    model_config = ConfigDict(from_attributes=True)

class CustomerDetailResponse(CustomerResponse):
    recent_orders: List[Dict[str, Any]] = []
    category_preferences: List[Dict[str, Any]] = []
    monthly_spend: List[Dict[str, Any]] = []

# ----------------- Product Schemas -----------------
class ProductBase(BaseModel):
    name: str
    category: str
    selling_price: float
    unit_cost: float
    stock_quantity: int = 0
    reorder_threshold: int = 10
    sku: Optional[str] = None
    barcode: Optional[str] = None
    description: Optional[str] = None
    supplier: Optional[str] = None
    image_url: Optional[str] = None

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, description="Product Name")
    category: str = Field(..., min_length=1, description="Category")
    selling_price: float = Field(..., ge=0, description="Selling Price")
    unit_cost: float = Field(..., ge=0, description="Unit Cost")
    stock_quantity: int = Field(0, ge=0, description="Initial Stock Quantity")
    reorder_threshold: int = Field(10, ge=0, description="Reorder Threshold")
    sku: Optional[str] = Field(None, description="Unique SKU identifier")
    barcode: Optional[str] = Field(None, description="Unique Barcode identifier")
    description: Optional[str] = Field(None, description="Product Description")
    supplier: Optional[str] = Field(None, description="Supplier Name")
    image_url: Optional[str] = Field(None, description="Image URL")

class ExtractedProductItem(BaseModel):
    id: Optional[str] = None
    name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    cost: Optional[float] = None
    quantity: Optional[int] = None
    supplier: Optional[str] = None
    image_url: Optional[str] = None
    uncertain_fields: List[str] = []
    confidence: float = 1.0

class ProductDuplicateCheckRequest(BaseModel):
    items: List[ExtractedProductItem]

class DuplicateCheckResult(BaseModel):
    status: str  # "already_exists", "new_product", "possible_duplicate", "insufficient_info"
    matched_product: Optional[Dict[str, Any]] = None
    match_reason: Optional[str] = None
    similarity_score: Optional[float] = None
    item: ExtractedProductItem

class ProductDuplicateCheckResponse(BaseModel):
    results: List[DuplicateCheckResult]

class DocumentExtractResponse(BaseModel):
    success: bool
    document_type: str = "packing_slip"
    extracted_items: List[ExtractedProductItem] = []
    unrelated_data_detected: Dict[str, Any] = {}
    notes: Optional[str] = None
    error: Optional[str] = None

class ProductResponse(ProductBase):
    id: int
    created_at: datetime
    updated_at: datetime
    units_sold: int = 0
    revenue: float = 0.0
    gross_profit: float = 0.0
    gross_margin_percent: float = 0.0
    stock_status: str = "In Stock"  # In Stock, Low Stock, Out of Stock
    inventory_value: float = 0.0

    model_config = ConfigDict(from_attributes=True)

class ProductDetailResponse(ProductResponse):
    sales_history: List[Dict[str, Any]] = []
    inventory_movements: List[Dict[str, Any]] = []

# ----------------- Order Item & Order Schemas -----------------
class OrderItemResponse(BaseModel):
    id: int
    order_id: int
    product_id: int
    product_name: str
    category: str
    quantity: int
    unit_price: float
    unit_cost_at_sale: float
    total_price: float

    model_config = ConfigDict(from_attributes=True)

class OrderResponse(BaseModel):
    id: int
    customer_id: int
    customer_name: str
    customer_email: str
    order_date: datetime
    region: str
    sales_channel: str
    status: str
    created_at: datetime
    total_amount: float
    total_items: int
    items_summary: str

    model_config = ConfigDict(from_attributes=True)

class OrderDetailResponse(OrderResponse):
    items: List[OrderItemResponse] = []

# ----------------- Inventory Schemas -----------------
class StockAdjustmentRequest(BaseModel):
    quantity_change: int = Field(..., description="Positive to add, negative to deduct")
    movement_type: str = Field("Adjustment", description="Restock, Adjustment, Return, etc.")
    reason: Optional[str] = "Manual stock update"

class InventoryMovementResponse(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    quantity_change: int
    movement_type: str
    reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class InventoryAlertResponse(BaseModel):
    product_id: int
    product_name: str
    category: str
    current_stock: int
    reorder_threshold: int
    stock_status: str
    urgency: str  # Critical, Warning

# ----------------- Business Activity -----------------
class BusinessActivityResponse(BaseModel):
    id: int
    activity_type: str
    entity_type: str
    entity_id: Optional[int] = None
    description: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- Dashboard & Analytics Schemas -----------------
class KPICardData(BaseModel):
    title: str
    value: Union[float, int, str]
    formatted_value: str
    previous_value: Optional[Union[float, int, str]] = None
    change_percentage: Optional[float] = None
    trend: str = "neutral"  # up, down, neutral
    period_label: str = "vs previous period"

class DashboardSummaryResponse(BaseModel):
    total_sales: KPICardData
    revenue_growth: KPICardData
    units_sold: KPICardData
    low_stock_products: KPICardData
    top_selling_products: List[Dict[str, Any]] = []
    recent_sales: List[OrderResponse] = []
    low_stock_alerts: List[InventoryAlertResponse] = []
    recent_activities: List[BusinessActivityResponse] = []

class RevenueTrendPoint(BaseModel):
    period: str
    revenue: float
    order_count: int
    units_sold: int

class CategoryBreakdownPoint(BaseModel):
    category: str
    revenue: float
    percentage: float
    orders_count: int

class SalesAnalyticsResponse(BaseModel):
    total_revenue: float
    total_orders: int
    average_order_value: float
    revenue_trend: List[RevenueTrendPoint]
    by_category: List[CategoryBreakdownPoint]
    by_region: List[Dict[str, Any]]
    by_channel: List[Dict[str, Any]]

# ----------------- Reports Schemas -----------------
class ReportSummary(BaseModel):
    id: str
    title: str
    description: str
    kpis: List[KPICardData]
    data: List[Dict[str, Any]]
    definitions: Dict[str, str]

class CrossModuleInsight(BaseModel):
    id: str
    title: str
    type: str  # inventory_risk, growth_opportunity, sales_anomaly, customer_concentration
    severity: str  # info, warning, high, positive
    description: str
    metrics: Dict[str, Any]
    target_route: str
    target_id: Optional[Union[int, str]] = None

# ----------------- Canvas Schemas (Typed JSON Schema) -----------------
class CanvasComponent(BaseModel):
    id: str
    type: str  # kpi_card, line_chart, bar_chart, donut_chart, data_table, insight_card, detail_link, action_button
    title: Optional[str] = None
    description: Optional[str] = None
    layout: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Grid col span, ordering")
    props: Dict[str, Any] = Field(default_factory=dict)

class CanvasSpecification(BaseModel):
    version: str = "1.0"
    layout: str = "responsive_grid"
    title: str
    subtitle: Optional[str] = None
    components: List[CanvasComponent]

# ----------------- Citations and Evidence Schemas -----------------
class CitationSource(BaseModel):
    id: str = Field(..., description="Unique citation identifier e.g. cite-1")
    source_id: Optional[str] = None
    index: int = Field(1, description="Sequential reference number [1], [2]")
    source_type: str = Field("application_data", description="application_data, external_web, uploaded_context, ai_inference")
    title: str
    url: Optional[str] = None
    source_url: Optional[str] = None
    route: Optional[str] = None
    internal_route: Optional[str] = None
    route_parameters: Optional[Dict[str, Any]] = None
    entity_type: Optional[str] = None  # product, order, customer, inventory, report
    entity_id: Optional[Union[int, str]] = None
    record_id: Optional[Union[int, str]] = None
    section_id: Optional[str] = None
    subpage: Optional[str] = None
    element_id: Optional[str] = None
    excerpt: str = ""
    evidence_start: Optional[int] = None
    evidence_end: Optional[int] = None
    retrieval_timestamp: Optional[str] = None
    timestamp: Optional[str] = None
    claim_id: Optional[str] = None
    claim_text: Optional[str] = None
    verified: bool = True
    disagreement_notes: Optional[str] = None

# ----------------- Selected Webpage Object Context Schemas -----------------
class SelectedObjectContext(BaseModel):
    type: str = Field(..., description="product, order, inventory, customer, kpi, chart, text, report, inventory_record")
    id: Optional[Union[int, str]] = None
    title: str
    fields: Optional[Dict[str, Any]] = Field(default_factory=dict)
    data: Optional[Any] = None
    underlying_data: Optional[Any] = None
    route: Optional[str] = None
    selected_text: Optional[str] = None
    surrounding_context: Optional[str] = None

# ----------------- Export Schemas -----------------
class ExportRequest(BaseModel):
    format: str = Field("pdf", description="pptx, docx, xlsx, pdf, png")
    title: str = "InsightFlow AI Analytics Intelligence Report"
    subtitle: Optional[str] = "Cross-Module Enterprise Intelligence & Decision Support"
    summary: Optional[str] = None
    kpis: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    insights: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    tables: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    recommendations: Optional[List[str]] = Field(default_factory=list)
    sources: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    canvas: Optional[Dict[str, Any]] = None
    chart_config: Optional[Dict[str, Any]] = None

class AnalysisRunRequest(BaseModel):
    query: str
    conversation_id: Optional[str] = None
    current_route: Optional[str] = None
    analysis_type: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    selected_context: Optional[SelectedObjectContext] = None

class AnalysisRunResponse(BaseModel):
    query: str
    is_rule_based: bool = True
    explanation: str
    insights: List[CrossModuleInsight] = []
    canvas: CanvasSpecification
    conversation_id: Optional[str] = None
    tool_traces: List[Dict[str, Any]] = []
    action_executed: Optional[Dict[str, Any]] = None
    citations: List[CitationSource] = []

# ----------------- Global Agent Assistant Schemas -----------------
class ToolTraceItem(BaseModel):
    tool_name: str
    args: Dict[str, Any]
    duration_ms: float
    status: str
    result_summary: Optional[str] = None
    error: Optional[str] = None

class AgentChatRequest(BaseModel):
    query: str
    conversation_id: Optional[str] = None
    current_route: Optional[str] = None
    selected_context: Optional[SelectedObjectContext] = None

class AgentChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    query: str
    answer: str
    is_llm_powered: bool
    model_used: str
    current_route_context: Optional[str] = None
    tool_traces: List[ToolTraceItem] = []
    canvas: Optional[CanvasSpecification] = None
    action_executed: Optional[Dict[str, Any]] = None
    citations: List[CitationSource] = []
    intent: Optional[str] = None

class ConversationMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    tool_traces: List[Dict[str, Any]] = []
    canvas: Optional[Dict[str, Any]] = None
    action_executed: Optional[Dict[str, Any]] = None
    is_llm_powered: bool = False
    model_used: Optional[str] = None
    citations: List[Dict[str, Any]] = []
    created_at: str

class ConversationSessionResponse(BaseModel):
    conversation_id: str
    messages: List[ConversationMessageResponse]
    created_at: str
    updated_at: str

# ----------------- Universal Contextual Dialog Schemas -----------------
class ContextualDialogTurn(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ContextualExplainRequest(BaseModel):
    element_id: Optional[str] = None
    element_type: str = Field(..., description="chart, paragraph, table_row, table, metric, code, recommendation, list_item, heading, image, citation, text")
    element_title: str
    selected_text: Optional[str] = None
    surrounding_context: Optional[str] = None
    data: Optional[Any] = None
    query: Optional[str] = None
    current_route: Optional[str] = None
    parent_message_id: Optional[str] = None
    dialog_history: Optional[List[ContextualDialogTurn]] = Field(default_factory=list)

class ContextualExplainResponse(BaseModel):
    explanation: str
    citations: List[CitationSource] = []
    element_id: Optional[str] = None
    element_type: str
    element_title: str

