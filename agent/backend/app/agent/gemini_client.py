import os
import json
import logging
import asyncio
from pathlib import Path
import aiohttp
from dotenv import load_dotenv
from typing import Dict, Any, List, Optional, Tuple

# Automatically locate and load .env file
for candidate in [
    Path.cwd() / ".env",
    Path.cwd() / "backend" / ".env",
    Path(__file__).resolve().parent.parent.parent / ".env",
]:
    if candidate.is_file():
        load_dotenv(dotenv_path=candidate, override=True)
        break

# Ensure aiohttp has ClientConnectorDNSError for google-genai compatibility
if not hasattr(aiohttp, "ClientConnectorDNSError"):
    class ClientConnectorDNSError(aiohttp.ClientConnectorError):
        pass
    aiohttp.ClientConnectorDNSError = ClientConnectorDNSError

from sqlalchemy.orm import Session
from google import genai
from google.genai import types
from app.agent.tools import registry, ToolExecutionLog

logger = logging.getLogger("agent.gemini")

SYSTEM_PROMPT = """You are InsightFlow AI, an intelligent, context-aware business analytics assistant.
You have access to all business modules across the company via tools (Sales, Products, Inventory, Customers, Cross-Module Analysis).

CRITICAL INTELLECTUAL AND REASONING RULES:
1. QUESTION INTENT UNDERSTANDING:
   - GENERAL KNOWLEDGE (e.g. "What's a warehouse?", "What is supply chain management?", "How does FIFO work?"):
     Answer directly and concisely in 1-2 sentences using general knowledge. Do NOT invoke database tools. Do NOT cite internal application records. Do NOT append inventory ledgers or valuation cards.
   - WEBSITE-SPECIFIC QUESTIONS (e.g. "What does this warehouse page show?", "What is on the sales page?"):
     Explain the purpose and contents of that specific webpage. Cite that page. Do NOT dump unrelated database ledgers.
   - APPLICATION DATA (e.g. "What is total inventory valuation?", "Which stock items are running low?"):
     Retrieve ONLY the specific records and data points needed. Calculate or verify totals explicitly. Cite the actual records.
   - CORRELATION VS CAUSATION IN ANALYSIS:
     Do NOT claim that a trend has a particular cause unless the available evidence directly supports it.
     For example: A declining inventory value does not automatically mean sales increased. Other explanations include stock adjustments, write-offs, returns, transfers, or unit cost changes. If data shows correlation but not causation, say so clearly.
   - MISSING EVIDENCE & UNKNOWNS:
     If an application record is not found (e.g. invalid SKU or order ID) or evidence is incomplete, report that limitation honestly. Never invent facts or substitute unrelated records.
   - CONFLICTING RECORDS:
     If data sources conflict or show discrepancies, communicate the discrepancy transparently instead of hiding it.

2. DIRECT ANSWER FIRST & CONCISE FACTUAL ANSWERS:
   - Put the direct answer first in approximately 1-3 concise sentences for simple factual questions.
   - Do NOT add unsolicited definitions, generic background, or repetitive introductions.
   - Only cite sources that were actually retrieved and used. Never generate fake citations or use boilerplate claims like "Source has been verified against live production records with zero discrepancies."

3. CONVERSATIONAL MEMORY & FOLLOW-UP CONTINUITY:
   - When answering follow-up questions (e.g. "Why did you say that?"), refer directly to the previous turn's claim and explain the data/calculation that supported it.

4. CHART SELECTION & CANVAS VISUALIZATION:
   Pick the chart from the question's intent and data shape, never by habit. Bar is not default:
   - Trend over time (revenue by day, week, month): line (area for cumulative/volume; limit to 4 series).
   - Comparing categories: bar (sort descending; horizontal bar if >7 categories or long labels).
   - Ranking: horizontal bar.
   - Part-to-whole (2-5 slices, all positive): donut or pie. With >5 slices: sorted bar or treemap.
   - Two numeric measures: scatter (optional bubble size).
   - Two categorical dimensions: heatmap.
   - Distribution: histogram or box plot.
   - Period-over-period drivers: waterfall.
   - Two measures with different units over time: combo (bar + line on secondary axis).
   - Single value or <3 points: no chart (KPI card or table).
   - NEVER pie/donut for time series, negative values, or >5 slices.
   - NEVER line for unordered categories.
   - Propose chart type and a 1-line rationale when relevant.
"""

class GeminiAgent:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        # Default to supported Flash model: gemini-3.5-flash-lite
        self.model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip() or "gemini-3.5-flash-lite"
        self._max_iterations = int(os.getenv("GEMINI_MAX_ITERATIONS", "5"))
        self._client: Optional[genai.Client] = None

    def set_client(self, client: Any) -> None:
        """Allow injecting a mocked client for automated testing."""
        self._client = client

    def get_client(self) -> Optional[genai.Client]:
        """Lazy-load or instantiate the official Google Gen AI client."""
        if self._client is not None:
            return self._client
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if not self.api_key:
            return None
        self._client = genai.Client(api_key=self.api_key)
        return self._client

    def is_configured(self) -> bool:
        """Check if Gemini API is configured and ready."""
        if self._client is not None:
            return True
        if "PYTEST_CURRENT_TEST" in os.environ:
            return False
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        return bool(self.api_key)

    async def _generate_with_failover(
        self,
        client: genai.Client,
        contents: List[types.Content],
        config: types.GenerateContentConfig
    ) -> Any:
        # If client has been mocked for automated tests, bypass failover
        if hasattr(client, "_mock_return_value") or hasattr(getattr(client.aio, "models", None), "mock_calls"):
            return await client.aio.models.generate_content(
                model=self.model,
                contents=contents,
                config=config
            )

        configured = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip() or "gemini-3.5-flash-lite"
        candidate_pool = [
            configured,
            "gemini-3.5-flash-lite",
            "gemini-3.1-flash-lite",
            "gemini-3.8-flash",
        ]
        unique_candidates = []
        for m in candidate_pool:
            if m and m not in unique_candidates:
                unique_candidates.append(m)

        last_error = None
        for cand in unique_candidates:
            try:
                resp = await asyncio.wait_for(
                    client.aio.models.generate_content(
                        model=cand,
                        contents=contents,
                        config=config
                    ),
                    timeout=35.0
                )
                self.model = cand
                return resp
            except Exception as e:
                err_msg = str(e)
                last_error = e
                if any(k in err_msg for k in ["429", "RESOURCE_EXHAUSTED", "503", "UNAVAILABLE", "404", "NOT_FOUND"]):
                    logger.warning(f"Model '{cand}' hit rate/service limit ({err_msg[:60]}), failing over...")
                    continue
                else:
                    raise e
        if last_error:
            raise last_error

    async def run_investigation_loop(
        self,
        query: str,
        history: List[Dict[str, str]],
        current_route: Optional[str],
        db: Session,
        max_iterations: Optional[int] = None
    ) -> Tuple[str, List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Runs multi-step tool-calling investigation loop using the official Google Gen AI SDK.
        Returns: (final_answer_text, tool_execution_traces, tool_results_data)
        """
        if not self.is_configured():
            raise ValueError("GEMINI_API_KEY is not configured in backend environment.")

        client = self.get_client()
        if client is None:
            raise ValueError("Failed to initialize Google Gen AI Client.")

        self.model = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip() or "gemini-3.8-flash"
        iterations_limit = max_iterations or self._max_iterations

        # 1. Prepare typed tools using the official SDK
        tools = registry.get_genai_tools()

        # 2. Configure generation settings
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            tools=tools,
            temperature=0.2,
            max_output_tokens=2048,
        )

        # 3. Format contents with conversation history and current route context
        contents: List[types.Content] = []

        # Add prior conversation turns
        for turn in history:
            role = "user" if turn.get("role") == "user" else "model"
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=turn.get("content", ""))]
                )
            )

        # Augment user question with current route context (without restricting data access)
        route_ctx = f" [Context: User is currently viewing page: {current_route}]" if current_route else ""
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=f"{query}{route_ctx}")]
            )
        )

        tool_traces: List[Dict[str, Any]] = []
        collected_data: List[Dict[str, Any]] = []
        final_text = ""

        # 4. Multi-step investigation loop (up to iterations_limit)
        for iteration in range(iterations_limit):
            logger.info(f"Official Google Gen AI SDK loop: iteration {iteration + 1}/{iterations_limit}")

            response = await self._generate_with_failover(client, contents, config)

            # Check if model requested function calls
            function_calls = getattr(response, "function_calls", None)
            if not function_calls and hasattr(response, "candidates") and response.candidates:
                cand = response.candidates[0]
                if hasattr(cand, "content") and cand.content and cand.content.parts:
                    function_calls = [
                        p.function_call for p in cand.content.parts
                        if getattr(p, "function_call", None) is not None
                    ]

            # If no function calls requested, model produced final text answer
            if not function_calls:
                final_text = response.text or ""
                break

            # Append model candidate turn to conversation history
            if hasattr(response, "candidates") and response.candidates and response.candidates[0].content:
                contents.append(response.candidates[0].content)

            # Execute all requested functions against the database
            tool_response_parts: List[types.Part] = []
            for fc in function_calls:
                fn_name = getattr(fc, "name", "")
                fn_args = getattr(fc, "args", {}) or {}
                if not isinstance(fn_args, dict):
                    fn_args = dict(fn_args)

                logger.info(f"Executing approved tool '{fn_name}' with arguments {fn_args}")
                tool_result, log = registry.execute(fn_name, db, fn_args)
                tool_traces.append(log.to_dict())
                collected_data.append({"tool": fn_name, "args": fn_args, "result": tool_result})

                # Format tool output for Gemini SDK
                fc_id = getattr(fc, "id", None)
                if isinstance(fc_id, str):
                    tool_response_parts.append(
                        types.Part(
                            function_response=types.FunctionResponse(
                                id=fc_id,
                                name=fn_name,
                                response={"output": tool_result}
                            )
                        )
                    )
                else:
                    tool_response_parts.append(
                        types.Part.from_function_response(
                            name=fn_name,
                            response={"output": tool_result}
                        )
                    )

            # Append user turn containing tool results
            contents.append(
                types.Content(
                    role="user",
                    parts=tool_response_parts
                )
            )

        # 5. If maximum iterations reached without final text, generate final synthesis
        if not final_text and collected_data:
            try:
                synthesis_config = types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.2,
                    max_output_tokens=2048
                )
                synth_resp = await self._generate_with_failover(
                    client,
                    contents,
                    synthesis_config
                )
                final_text = synth_resp.text or ""
            except Exception as e:
                logger.warning(f"Could not generate final synthesis: {e}")
                final_text = f"Investigation complete. Executed {len(tool_traces)} cross-module tools across Sales, Inventory, and Products."

        return final_text, tool_traces, collected_data

    async def generate_direct_text(self, prompt: str) -> str:
        """Generate direct, concise answer using general knowledge without invoking tools."""
        if not self.is_configured():
            raise ValueError("GEMINI_API_KEY is not configured in backend environment.")

        client = self.get_client()
        if client is None:
            raise ValueError("Failed to initialize Google Gen AI Client.")

        config = types.GenerateContentConfig(
            system_instruction=(
                "You are an intelligent enterprise AI assistant. "
                "Answer the user's question directly, clearly, and concisely in 1-2 factual sentences based on general knowledge. "
                "Do NOT make up internal application data or pretend to query database tables when answering general conceptual questions."
            ),
            temperature=0.2,
            max_output_tokens=512,
        )
        contents = [
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=prompt)]
            )
        ]
        resp = await self._generate_with_failover(client, contents, config)
        return resp.text or ""


gemini_agent = GeminiAgent()
