import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

class AgentMessage:
    def __init__(
        self,
        role: str,  # 'user' or 'assistant'
        content: str,
        tool_traces: Optional[List[Dict[str, Any]]] = None,
        canvas: Optional[Dict[str, Any]] = None,
        is_llm_powered: bool = False,
        action_executed: Optional[Dict[str, Any]] = None,
        citations: Optional[List[Dict[str, Any]]] = None
    ):
        self.id = str(uuid.uuid4())
        self.role = role
        self.content = content
        self.tool_traces = tool_traces or []
        self.canvas = canvas
        self.is_llm_powered = is_llm_powered
        self.action_executed = action_executed
        self.citations = citations or []
        self.created_at = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "role": self.role,
            "content": self.content,
            "tool_traces": self.tool_traces,
            "canvas": self.canvas,
            "action_executed": self.action_executed,
            "is_llm_powered": self.is_llm_powered,
            "citations": self.citations,
            "created_at": self.created_at
        }


class ConversationSession:
    def __init__(self, conversation_id: str):
        self.conversation_id = conversation_id
        self.messages: List[AgentMessage] = []
        self.created_at = datetime.now(timezone.utc)
        self.updated_at = datetime.now(timezone.utc)

    def add_message(self, message: AgentMessage, max_history: int = 16):
        self.messages.append(message)
        self.updated_at = datetime.now(timezone.utc)
        if len(self.messages) > max_history:
            self.messages = self.messages[-max_history:]

    def get_history_for_llm(self, limit: int = 6) -> List[Dict[str, str]]:
        recent = self.messages[-limit:]
        history = []
        for m in recent:
            if m.role in ["user", "assistant"]:
                history.append({"role": m.role, "content": m.content})
        return history

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conversation_id": self.conversation_id,
            "messages": [m.to_dict() for m in self.messages],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }


class SessionStore:
    def __init__(self):
        self._sessions: Dict[str, ConversationSession] = {}

    def get_or_create(self, conversation_id: Optional[str] = None) -> ConversationSession:
        if not conversation_id or conversation_id.strip() == "":
            conversation_id = f"conv_{uuid.uuid4().hex[:12]}"

        if conversation_id not in self._sessions:
            self._sessions[conversation_id] = ConversationSession(conversation_id)

        return self._sessions[conversation_id]

    def get(self, conversation_id: str) -> Optional[ConversationSession]:
        return self._sessions.get(conversation_id)

    def clear(self, conversation_id: str):
        if conversation_id in self._sessions:
            del self._sessions[conversation_id]


session_store = SessionStore()
