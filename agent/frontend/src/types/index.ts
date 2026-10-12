export interface KPICardData {
  title: string;
  value: number | string;
  formatted_value: string;
  previous_value?: number | string | null;
  change_percentage?: number | null;
  trend: 'up' | 'down' | 'neutral';
  period_label: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  category: string;
  quantity: number;
  unit_price: number;
  unit_cost_at_sale: number;
  total_price: number;
}

export interface Order {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  order_date: string;
  region: string;
  sales_channel: string;
  status: 'Completed' | 'Processing' | 'Cancelled' | 'Returned';
  created_at: string;
  total_amount: number;
  total_items: number;
  items_summary: string;
  items?: OrderItem[];
}

export interface Product {
  id: number;
  name: string;
  category: string;
  selling_price: number;
  unit_cost: number;
  stock_quantity: number;
  reorder_threshold: number;
  sku?: string;
  barcode?: string;
  description?: string;
  supplier?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  units_sold: number;
  revenue: number;
  gross_profit: number;
  gross_margin_percent: number;
  stock_status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  inventory_value: number;
}

export interface ProductCreateInput {
  name: string;
  category: string;
  selling_price: number;
  unit_cost: number;
  stock_quantity: number;
  reorder_threshold: number;
  sku?: string;
  barcode?: string;
  description?: string;
  supplier?: string;
  image_url?: string;
}

export interface ExtractedProductItem {
  id?: string;
  name: string;
  sku?: string;
  barcode?: string;
  description?: string;
  category?: string;
  price?: number;
  cost?: number;
  quantity?: number;
  supplier?: string;
  image_url?: string;
  uncertain_fields?: string[];
  confidence?: number;
}

export interface DuplicateCheckResult {
  status: 'already_exists' | 'new_product' | 'possible_duplicate' | 'insufficient_info';
  matched_product?: Product | null;
  match_reason?: string;
  similarity_score?: number;
  item: ExtractedProductItem;
}

export interface ProductDuplicateCheckResponse {
  results: DuplicateCheckResult[];
}

export interface DocumentExtractResponse {
  success: boolean;
  document_type: string;
  extracted_items: ExtractedProductItem[];
  unrelated_data_detected?: Record<string, any>;
  notes?: string;
  error?: string;
}

export interface ProductDetail extends Product {
  sales_history: {
    order_id: number;
    order_date: string;
    customer_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    status: string;
  }[];
  inventory_movements: {
    id: number;
    quantity_change: number;
    movement_type: string;
    reason: string;
    created_at: string;
  }[];
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  region: string;
  registration_date: string;
  created_at: string;
  total_orders: number;
  total_revenue: number;
  last_order_date?: string | null;
  segment: 'High Value' | 'Repeat' | 'New' | 'Inactive' | 'Standard';
}

export interface CustomerDetail extends Customer {
  recent_orders: {
    order_id: number;
    order_date: string;
    status: string;
    channel: string;
    amount: number;
    items_count: number;
  }[];
  category_preferences: {
    category: string;
    spend: number;
  }[];
  monthly_spend: {
    period: string;
    spend: number;
  }[];
}

export interface InventoryAlert {
  product_id: number;
  product_name: string;
  category: string;
  current_stock: number;
  reorder_threshold: number;
  stock_status: string;
  urgency: 'Critical' | 'Warning';
}

export interface BusinessActivity {
  id: number;
  activity_type: string;
  entity_type: string;
  entity_id?: number | null;
  description: string;
  created_at: string;
}

export interface DashboardSummary {
  total_sales: KPICardData;
  revenue_growth: KPICardData;
  units_sold: KPICardData;
  low_stock_products: KPICardData;
  top_selling_products: {
    product_id: number;
    product_name: string;
    category: string;
    stock_quantity: number;
    units_sold: number;
    revenue: number;
    formatted_revenue: string;
  }[];
  recent_sales: Order[];
  low_stock_alerts: InventoryAlert[];
  recent_activities: BusinessActivity[];
}

export interface RevenueTrendPoint {
  period: string;
  revenue: number;
  order_count: number;
  units_sold: number;
}

export interface SalesAnalytics {
  total_revenue: number;
  total_orders: number;
  average_order_value: number;
  revenue_trend: RevenueTrendPoint[];
  by_category: {
    category: string;
    revenue: number;
    percentage: number;
    orders_count: number;
  }[];
  by_region: {
    region: string;
    orders: number;
    revenue: number;
  }[];
  by_channel: {
    channel: string;
    orders: number;
    revenue: number;
  }[];
}

export interface CrossModuleInsight {
  id: string;
  title: string;
  type: string;
  severity: 'info' | 'warning' | 'high' | 'positive';
  description: string;
  metrics: Record<string, any>;
  target_route: string;
  target_id?: string | number | null;
}

export interface ReportSummary {
  id: string;
  title: string;
  description: string;
  kpis: KPICardData[];
  data: Record<string, any>[];
  definitions: Record<string, string>;
}

export interface CanvasComponent {
  id: string;
  type:
    | 'kpi_card'
    | 'line_chart'
    | 'bar_chart'
    | 'horizontal_bar_chart'
    | 'donut_chart'
    | 'pie_chart'
    | 'area_chart'
    | 'scatter_chart'
    | 'heatmap'
    | 'combo_chart'
    | 'waterfall_chart'
    | 'data_table'
    | 'insight_card'
    | 'detail_link'
    | 'action_button'
    | string;
  title?: string;
  description?: string;
  layout?: {
    colSpan?: number;
    order?: number;
  };
  props: Record<string, any>;
}

export interface CanvasSpecification {
  version: string;
  layout: string;
  title: string;
  subtitle?: string;
  components: CanvasComponent[];
}

export interface AnalysisRunResponse {
  query: string;
  is_rule_based: boolean;
  explanation: string;
  insights: CrossModuleInsight[];
  canvas: CanvasSpecification;
  conversation_id?: string;
  tool_traces?: ToolTraceItem[];
  action_executed?: Record<string, any> | null;
  citations?: CitationSource[];
}

// ----------------- Citations & Evidence Types -----------------
export interface CitationSource {
  id: string;
  source_id?: string;
  index: number;
  source_type: 'application_data' | 'external_web' | 'uploaded_context' | 'ai_inference';
  title: string;
  url?: string | null;
  source_url?: string | null;
  route?: string | null;
  internal_route?: string | null;
  route_parameters?: Record<string, any> | null;
  entity_type?: string | null;
  entity_id?: string | number | null;
  record_id?: string | number | null;
  section_id?: string | null;
  subpage?: string | null;
  element_id?: string | null;
  excerpt: string;
  evidence_start?: number | null;
  evidence_end?: number | null;
  retrieval_timestamp?: string | null;
  timestamp?: string | null;
  claim_id?: string | null;
  claim_text?: string | null;
  verified?: boolean;
  disagreement_notes?: string | null;
}

// ----------------- Selected Object Context Types -----------------
export interface SelectedObjectContext {
  type: 'product' | 'order' | 'inventory' | 'customer' | 'kpi' | 'chart' | 'text' | 'report' | 'inventory_record' | string;
  id?: string | number;
  title: string;
  fields?: Record<string, any>;
  data?: any;
  underlying_data?: any;
  route?: string;
  selected_text?: string;
  surrounding_context?: string;
}

// ----------------- Export Request Types -----------------
export interface ExportRequest {
  format: 'pptx' | 'docx' | 'xlsx' | 'pdf' | 'png';
  title?: string;
  subtitle?: string;
  summary?: string;
  kpis?: Record<string, any>[];
  insights?: Record<string, any>[];
  tables?: { title: string; columns: { key: string; label: string }[]; rows: any[] }[];
  recommendations?: string[];
  sources?: CitationSource[];
  canvas?: CanvasSpecification | null;
  chart_config?: {
    type?: string;
    data?: any[];
    x_key?: string;
    y_keys?: string[];
  };
}

// ----------------- Agent Intelligence Layer Types -----------------
export interface ToolTraceItem {
  tool_name: string;
  args: Record<string, any>;
  duration_ms: number;
  status: string;
  result_summary?: string | null;
  error?: string | null;
}

export interface AgentChatResponse {
  conversation_id: string;
  message_id: string;
  query: string;
  answer: string;
  is_llm_powered: boolean;
  model_used: string;
  current_route_context?: string | null;
  tool_traces: ToolTraceItem[];
  canvas?: CanvasSpecification | null;
  action_executed?: Record<string, any> | null;
  citations?: CitationSource[];
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_traces?: ToolTraceItem[];
  canvas?: CanvasSpecification | null;
  action_executed?: Record<string, any> | null;
  citations?: CitationSource[];
  selected_context?: SelectedObjectContext;
  is_llm_powered?: boolean;
  model_used?: string;
  created_at: string;
}

// ----------------- Universal Contextual AI Dialog Types -----------------
export type ContextualElementType =
  | 'chart'
  | 'paragraph'
  | 'table_row'
  | 'table'
  | 'metric'
  | 'code'
  | 'recommendation'
  | 'list_item'
  | 'heading'
  | 'image'
  | 'diagram'
  | 'citation'
  | 'canvas_component'
  | 'text';

export interface ContextualElementSelection {
  id?: string;
  type: ContextualElementType;
  title: string;
  subtitle?: string;
  selectedText?: string;
  surroundingContext?: string;
  data?: any;
  props?: Record<string, any>;
  route?: string;
  elementId?: string;
  sourceCitations?: CitationSource[];
  parentAnswerId?: string;
  metadata?: Record<string, any>;
}

export interface ContextualDialogMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: CitationSource[];
  loading?: boolean;
}

export interface ContextualDialogTurn {
  role: string;
  content: string;
}

export interface ContextualExplainRequest {
  element_id?: string;
  element_type: string;
  element_title: string;
  selected_text?: string;
  surrounding_context?: string;
  data?: any;
  query?: string;
  current_route?: string;
  parent_message_id?: string;
  dialog_history?: ContextualDialogTurn[];
}

export interface ContextualExplainResponse {
  explanation: string;
  citations: CitationSource[];
  element_id?: string;
  element_type: string;
  element_title: string;
}

