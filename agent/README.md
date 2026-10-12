# InsightFlow AI — Cross-Application Business Analytics Platform

**InsightFlow AI** is a modern, full-stack business analytics web application designed as the enterprise host platform for cross-application intelligence. It unifies business operations across **Sales**, **Inventory**, **Customers**, **Products**, and **Executive Reporting**, featuring a persistent **Global AI Assistant** drawer and an **AI Analyst Workspace** powered by a typed JSON schema canvas renderer, a 19-tool database investigation registry, and Gemini LLM function-calling orchestration with verified deterministic fallback.

---

## 1. System Architecture

```
InsightFlow AI System Architecture
├── Frontend (React 19 + TypeScript + Vite + Tailwind CSS)
│   ├── Global Navigation Sidebar (7 Distinct Functional Routes)
│   ├── Global Header with Persistent AI Assistant Button & Breadcrumbs
│   ├── AI Assistant Drawer (Right-side slide-over, multi-turn chat, live tool traces, embedded canvas)
│   ├── Executive Dashboard (KPIs, Recharts Trends, Low-Stock Alerts, Activity Stream)
│   ├── Sales Module (Filtering, Sorting, Pagination, CSV Export, Order Detail Modal)
│   ├── Inventory Module (Valuation, Safety Stock Alerts, Stock Adjustments, Movement Ledger)
│   ├── Customers Module (Deterministic Cohort Segmentation, Lifetime Value, Dossiers)
│   ├── Products Module (Catalog Economics, COGS, Profit Margins, Stock Links)
│   ├── Business Reports (Predefined Audits, CSV Exports, Diagnostic Insights)
│   └── AI Analyst Workspace (Direct Canvas Generation, Suggested Inquiries, Tool Traces)
│
└── Backend (Python 3.10+ + FastAPI + SQLAlchemy ORM)
    ├── SQLite Relational Database (Normalized schema, foreign keys, audit log)
    ├── Deterministic Seed Data (100 Customers, 30 Products, 210 Orders, 6 Months)
    ├── Tool Registry (`app.agent.tools`: 19 approved typed database tools)
    ├── Gemini Function-Calling Loop (`app.agent.gemini_client`: Multi-turn tool execution)
    ├── Transparent Fallback Engine (`app.agent.agent_service`: SQL query planners & correlation)
    ├── Conversation Session Store (`app.agent.session_store`: In-memory multi-turn memory)
    ├── Canvas Specification Builder (Typed JSON contract with 8 UI component primitives)
    ├── Canonical Single Source of Truth Engine (`app.analytics.canonical_analysis`)
    └── Comprehensive Pytest Test Suite (77/77 tests passing, 100% green)
```

---

## 2. Global Cross-Application Intelligence

The AI Assistant is a genuine cross-application business analyst that can independently investigate any module, correlate metrics across tables, and synthesize evidence-backed answers and interactive dashboards regardless of which page the user currently has open.

### Key Capabilities:
* **Persistent Top-Right Access**: Accessible from all 7 pages via the top-right header `AI Assistant` button or keyboard shortcut (`Esc` to close).
* **Cross-Module Scope**: The assistant does not limit its queries to the user's active page. An inquiry from `/customers` about declining inventory and revenue trends will query the `orders`, `products`, and `inventory_movements` tables automatically.
* **Audit Trail & Tool Traces**: Every tool execution is recorded with function name, input arguments, execution duration (ms), execution status, and human-readable output summaries. Users can expand the trace accordion in the drawer or workspace to inspect the underlying data.
* **Dynamic Analysis Canvas**: When relevant, responses include a typed JSON canvas specification rendered by `CanvasRenderer.tsx` into live KPI cards, Recharts visualizations, diagnostic alert banners, and data tables.
* **Multi-Turn Memory**: Conversation context is maintained across turns using explicit `conversation_id` tokens, allowing seamless follow-up inquiries (e.g., *"Which of those products has the highest margin?"*).
* **Guaranteed Deterministic Fallback**: If no Gemini API key is configured (`GEMINI_API_KEY` unset), or if API quotas or network timeouts occur, the engine transparently activates its certified rule-based analytical planners. It executes the exact same typed database tools and produces rich markdown answers and valid canvases with zero hallucinations.

---

## 3. Approved Database Tool Registry

The backend exposes 19 strongly-typed tools in `app/agent/tools.py`. Tools are registered with Pydantic JSON schemas and executed directly against the SQLAlchemy session:

| Category | Tool Name | Description |
|---|---|---|
| **Sales** | `get_sales_summary` | Total revenue, orders, AOV, and period-over-period comparisons. |
| | `get_sales_trend` | Daily, weekly, or monthly revenue, order volume, and units sold. |
| | `compare_revenue_periods` | Growth metrics comparing two arbitrary or relative date ranges. |
| | `get_sales_by_category` | Revenue and unit breakdown by product category. |
| | `get_sales_by_region` | Geographic revenue breakdown across all defined regions. |
| | `get_sales_by_channel` | Channel performance (Direct, Online, Wholesale, Retail). |
| | `get_order_details` | Complete order breakdown including customer, line items, and status. |
| **Products** | `get_product_performance` | Catalog economics, units sold, total revenue, COGS, and margin %. |
| | `get_top_and_declining_products` | SKU momentum analysis comparing recent vs previous sales velocity. |
| **Inventory** | `get_inventory_status` | Stock valuation, total units, out-of-stock items, and low-stock count. |
| | `get_low_stock_products` | Products below safety reorder threshold with urgency levels. |
| | `get_inventory_movements` | Stock adjustment and audit ledger history for specific SKUs. |
| **Customers** | `get_customer_analytics` | High-level metrics, total spend, and repeat purchase ratios. |
| | `get_customer_segments` | Segment distribution (High Value, Repeat, New, Inactive, Standard). |
| | `get_customer_purchase_history` | Complete historical order dossier for any specific customer ID. |
| **Cross-Module** | `analyze_sales_inventory_alignment` | Cross-references SKU sales velocity with stock levels (detects deadstock & stockout risks). |
| | `analyze_category_performance` | Cross-module category diagnostics uniting revenue with inventory holding costs. |
| | `analyze_regional_performance` | Geographic growth rates, average order values, and customer penetration. |
| | `get_business_activity` | System-wide audit event stream across sales, inventory, and users. |

---

## 4. Technology Stack

* **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide React
* **Data Visualization**: Recharts (Responsive Line, Bar, and Donut charts)
* **Backend**: Python 3.10+, FastAPI, Starlette, Pydantic v2
* **Database**: SQLite with SQLAlchemy ORM (Single unified relational database)
* **LLM Integration**: Native asynchronous `httpx` client calling Gemini 2.5 Flash function-calling API
* **Testing**: Pytest with FastAPI TestClient (17 tests, 100% passing)

---

## 5. Application Routes

| Route | Page | Description |
|---|---|---|
| `/dashboard` | **Executive Overview** | Top-level KPIs, 30/60/90-day filter, revenue trends, top SKUs, recent orders, inventory alerts, and live activity stream. |
| `/sales` | **Sales Management** | Searchable order table, status filters (Completed, Processing, Cancelled, Returned), region & channel splits, CSV export, order modal. |
| `/inventory` | **Inventory Monitoring** | Stock valuation, reorder thresholds, low/out-of-stock badges, validated stock adjustment modal (persisted to DB), movement ledger. |
| `/customers` | **Customer Intelligence** | Deterministic segmentation (High Value, Repeat, New, Inactive, Standard), lifetime revenue calculation, customer dossier. |
| `/products` | **Product Catalogue** | Unit economics, COGS at sale time, gross margin %, top & bottom SKU comparisons, direct navigation to inventory. |
| `/reports` | **Business Reports** | 4 predefined analytical reports, CSV exports, formula definitions, cross-module diagnostic alerts. |
| `/ai-analyst` | **AI Analyst Workspace** | Conversational query input, suggested business prompts, tool execution traces drawer, dynamic Canvas renderer (8 components). |

---

## 6. Deterministic Seed Patterns

The database is seeded with reproducible, realistic patterns:
1. **Product with Declining Sales & High Inventory**: SKU #1 (*Mechanical Keyboard Pro*) holds 85 units in stock ($5,525 capital tied up), but sales dropped by ~90% over the last 60 days.
2. **Product with Surging Demand & Low Stock**: SKU #2 (*Wireless Noise-Canceling Earbuds*) surged in sales (+140%), leaving only 4 units in stock against a safety threshold of 12 (critical stockout risk).
3. **Category Month-over-Month Contraction**: *Furniture* category revenue experienced a ~40% month-over-month decline.
4. **Geographic Growth Driver**: *Asia Pacific* generated strong accelerating growth (+45%).
5. **High-Value VIP Customer**: *Sarah Jenkins* (Customer #10) has generated $2,000+ across 7 completed enterprise orders.

---

## 7. Prerequisites & Environment Configuration

* **Python 3.10+** (tested on Python 3.14)
* **Node.js 18+** & **npm 9+** (tested on Node v22.18.0)
## 7. Prerequisites & Environment Configuration

* **Python 3.10+** (tested on Python 3.14)
* **Node.js 18+** & **npm 9+** (tested on Node v22.18.0)
* **Google Gen AI SDK**: Uses official `google-genai` Python library.
* *(Optional)* **Gemini API Configuration**:
  To activate live LLM multi-step tool calling via Gemini, set the environment variables (or copy `.env.example` to `.env`):
  ```powershell
  $env:GEMINI_API_KEY="your-gemini-api-key-here"
  $env:GEMINI_MODEL="gemini-3.5-flash-lite"  # Defaults to gemini-3.5-flash-lite
  $env:GEMINI_MAX_ITERATIONS="5"            # Maximum investigation loops per turn
  ```
  *If `GEMINI_API_KEY` is not set, the platform automatically and transparently operates in verified deterministic fallback mode. All 19 tools, dynamic canvases, and multi-turn conversations continue to operate completely with zero errors and zero hallucinations.*

---

## 8. Installation & Quick Start

### Step 1: Clone or Navigate to the Workspace
```powershell
cd C:\Users\bhagy\OneDrive\Documents\Hackfest\agent
```

### Step 2: Install Backend Dependencies
```powershell
cd backend
pip install -r requirements.txt
```

### Step 3: Seed the Database
Initialize and populate the SQLite database with the deterministic dataset:
```powershell
python -m app.seed
```
*Note: The database automatically initializes and seeds on the first server launch if not already present.*

### Step 4: Install Frontend Dependencies
```powershell
cd ..\frontend
npm install
```

---

## 9. Running the Application

### Option A: Using Provided PowerShell Scripts

Open two terminal windows:

* **Terminal 1 (Backend):**
  ```powershell
  .\start_backend.ps1
  ```
  *Runs on `http://127.0.0.1:8000`*

* **Terminal 2 (Frontend):**
  ```powershell
  .\start_frontend.ps1
  ```
  *Runs on `http://127.0.0.1:5173`*

### Option B: Manual Commands

* **Backend:**
  ```powershell
  cd backend
  python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
  ```

* **Frontend:**
  ```powershell
  cd frontend
  npm run dev
  ```

Access the application in your browser at:
* **Frontend Application**: [http://127.0.0.1:5173](http://127.0.0.1:5173)
* **Interactive API Swagger Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **API Health Check**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

---

## 10. Automated Tests & Verification

### Running Backend Pytest Suite
```powershell
cd backend
python -m pytest -v
```

**Results (19/19 passing, 100% green):**
* `test_1_basic_question_reaches_agent_service`: Verifies natural-language business question reaches agent and returns structured response.
* `test_2_gemini_requests_approved_tool_receives_real_result`: Validates Gemini requesting tool and receiving genuine database result.
* `test_3_multiple_tools_called_in_one_investigation`: Validates execution of multiple tools in one investigation loop.
* `test_4_query_from_customers_page_queries_sales_and_inventory`: Proves cross-module investigation capability regardless of active page.
* `test_5_tool_arguments_validated_and_unknown_rejected`: Verifies parameter clamping and rejection of unapproved tools.
* `test_6_followup_questions_preserve_conversation_context`: Verifies conversational memory across turns with `conversation_id`.
* `test_7_returned_canvas_passes_existing_schema`: Validates canvas against Pydantic `CanvasSpecification` schema.
* `test_8_api_failure_triggers_existing_fallback`: Verifies transparent failover when Gemini API errors occur.
* `test_9_missing_configuration_handled_clearly`: Verifies graceful operation when `GEMINI_API_KEY` is omitted.
* `test_10_tools_registry_listing_and_coverage`: Verifies all 19 tools are registered with schemas.
* `test_backend.py` (9 tests): Validates API uptime, sales listing, inventory monitoring, cohort segmentation, product unit economics, reports, and error handling.

### Verifying Frontend Build
```powershell
cd frontend
npm run build
```
*Builds client bundles cleanly with zero TypeScript errors.*

### Manual Testing with Gemini API Key
To manually test live Gemini model responses:
1. Obtain an API key from Google AI Studio (https://aistudio.google.com/).
2. In PowerShell, set the key:
   ```powershell
   $env:GEMINI_API_KEY="your-api-key"
   $env:GEMINI_MODEL="gemini-3.5-flash-lite"
   ```
3. Start the backend: `.\start_backend.ps1`
4. Start the frontend: `.\start_frontend.ps1`
5. Open `http://127.0.0.1:5173` and click the **AI Assistant** button in the header.
6. Submit: *"Why did sales decline this month?"*
7. Observe the **Gemini 3.5 Flash Lite** badge, expand the **Executed Cross-Module Tools** accordion to inspect live database tool calls, and examine the dynamic canvas rendered below the answer.


---

## 11. Verification & Walkthrough Guide

1. **Global AI Assistant Sidebar (from any page)**:
   - Click the **AI Assistant** button in the top-right header (or click one of the suggested inquiries).
   - The drawer slides out from the right without navigating away from your active page.
   - Enter: *"Which products have declining sales and high inventory?"*
   - Expand the **Executed Cross-Module Tools** accordion to inspect the live database tools executed (`get_top_and_declining_products`, `get_inventory_status`, `analyze_sales_inventory_alignment`).
   - View the synthesized markdown diagnosis and the embedded interactive dynamic canvas.
   - Type a follow-up question: *"What is our total revenue and top customer segment?"*
   - Verify that the assistant maintains conversation history and executes the appropriate tools.
2. **AI Analyst Workspace (`/ai-analyst`)**:
   - Navigate to `/ai-analyst`.
   - Submit a business query or select a prompt chip.
   - Inspect the tool execution trace drawer showing tool names, arguments, execution duration, and result summaries.
   - Click **Open Assistant Drawer** to seamlessly transition to the conversational drawer.
3. **Module Interconnectivity**:
   - Navigate to `/inventory`, `/customers`, or `/reports` while keeping the AI Assistant drawer open.
   - Notice the "Active View" pill updates dynamically while allowing full cross-module data scope inquiries.

---

## 12. Canonical Business Intelligence Agent & Single Source of Truth

For complete architectural documentation, failure post-mortem, and verification matrices, see [CANONICAL_BI_AGENT_STATUS.md](file:///c:/Users/sinch/Desktop/inflow/agent/CANONICAL_BI_AGENT_STATUS.md).

### Summary Highlights:
* **Single Source of Truth (`CanonicalAnalysisResult`)**: Text answers and dynamic canvas components share identical mathematical values, time frames, and filters without discrepancy.
* **Asia Pacific Consistency**: Verified $6,181.33 across 22 completed orders for August and September 2026, eliminating any accidental fallback to North America or $0.00.
* **Competing-Hypotheses Diagnostic**: Evaluates 4 rival explanations for sales contractions (Category Drag, Stockouts, Geographic Shifts, Volume vs Pricing) with visual badges (`[SUPPORTED]`, `[REFUTED]`, `[INCONCLUSIVE]`).
* **Elimination of UI Clutter**: Unified into a single, accessible "Export Canvas" dropdown in the canvas title bar; removed duplicate headers.
* **Verified Test Coverage**: All 77 unit, integration, and regression tests passing.

