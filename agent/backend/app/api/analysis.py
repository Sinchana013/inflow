from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.schemas import (
    AnalysisRunRequest,
    AnalysisRunResponse,
    AgentChatRequest,
    AgentChatResponse,
    ConversationSessionResponse,
    CanvasSpecification,
    ContextualExplainRequest,
    ContextualExplainResponse
)
from app.agent.agent_service import process_agent_query, process_contextual_explanation
from app.agent.session_store import session_store
from app.agent.tools import registry
from app.analytics.engine import get_cross_module_insights
from app.analytics.canvas_generator import generate_analysis_canvas

router = APIRouter(tags=["AI Analyst & Intelligence Agent"])

@router.post("/agent/contextual-explain", response_model=ContextualExplainResponse)
async def contextual_explain(request: ContextualExplainRequest, db: Session = Depends(get_db)):
    """
    Dedicated endpoint for the Universal Contextual AI Dialog.
    Generates isolated, concise, evidence-grounded explanations and follow-ups
    for ANY selected answer element (charts, tables, rows, metrics, paragraphs,
    code snippets, insights, images, citations, etc.) without altering main chat history.
    """
    return await process_contextual_explanation(request=request, db=db)

@router.post("/analysis/run", response_model=AnalysisRunResponse)
async def run_analysis(request: AnalysisRunRequest, db: Session = Depends(get_db)):
    """
    Existing analysis endpoint, powered by the deterministic cross-application canvas engine.
    """
    return generate_analysis_canvas(db=db, request=request)


@router.post("/agent/chat", response_model=AgentChatResponse)
async def agent_chat(request: AgentChatRequest, db: Session = Depends(get_db)):
    """
    Primary endpoint for the Global Right-Side AI Assistant.
    Executes multi-step tool investigation across all modules.
    """
    res = await process_agent_query(
        query=request.query,
        conversation_id=request.conversation_id,
        current_route=request.current_route,
        selected_context=request.selected_context,
        db=db
    )

    canvas_spec = CanvasSpecification.model_validate(res["canvas"]) if res.get("canvas") else None

    return AgentChatResponse(
        conversation_id=res["conversation_id"],
        message_id=res["message_id"],
        query=res["query"],
        answer=res["answer"],
        is_llm_powered=res["is_llm_powered"],
        model_used=res["model_used"],
        current_route_context=res.get("current_route_context"),
        tool_traces=res.get("tool_traces", []),
        canvas=canvas_spec,
        action_executed=res.get("action_executed"),
        citations=res.get("citations", []),
        intent=res.get("intent")
    )


@router.get("/agent/conversations/{conversation_id}", response_model=ConversationSessionResponse)
def get_conversation_history(conversation_id: str):
    """
    Retrieve stored multi-turn conversation messages for a conversation session.
    """
    session = session_store.get(conversation_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Conversation '{conversation_id}' not found.")
    return session.to_dict()


@router.get("/agent/tools", response_model=List[Dict[str, Any]])
def list_available_tools():
    """
    Returns all registered, approved backend tools and parameter schemas.
    """
    return registry.get_all_declarations()
