import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  ContextualElementSelection,
  ContextualDialogMessage,
  ContextualExplainRequest,
  ContextualDialogTurn
} from '../types';
import { apiClient } from '../api/client';

interface ContextualAIDialogContextType {
  isOpen: boolean;
  activeSelection: ContextualElementSelection | null;
  messages: ContextualDialogMessage[];
  loading: boolean;
  error: string | null;
  openDialog: (selection: ContextualElementSelection, initialQuestion?: string) => Promise<void>;
  closeDialog: () => void;
  sendFollowUp: (question: string) => Promise<void>;
}

const ContextualAIDialogContext = createContext<ContextualAIDialogContextType | undefined>(undefined);

export const ContextualAIDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeSelection, setActiveSelection] = useState<ContextualElementSelection | null>(null);
  const [messages, setMessages] = useState<ContextualDialogMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeSelectionRef = useRef<ContextualElementSelection | null>(null);
  activeSelectionRef.current = activeSelection;

  const messagesRef = useRef<ContextualDialogMessage[]>([]);
  messagesRef.current = messages;

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setError(null);
  }, []);

  const openDialog = useCallback(async (selection: ContextualElementSelection, initialQuestion?: string) => {
    setActiveSelection(selection);
    setIsOpen(true);
    setError(null);
    setLoading(true);
    setMessages([]);

    try {
      const payload: ContextualExplainRequest = {
        element_id: selection.id || selection.elementId,
        element_type: selection.type,
        element_title: selection.title,
        selected_text: selection.selectedText,
        surrounding_context: selection.surroundingContext,
        data: selection.data,
        query: initialQuestion || undefined,
        current_route: selection.route || window.location.pathname,
        parent_message_id: selection.parentAnswerId,
        dialog_history: []
      };

      const res = await apiClient.explainContextualElement(payload);

      const asstMsg: ContextualDialogMessage = {
        id: `ctx-asst-${Date.now()}`,
        role: 'assistant',
        content: res.explanation,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: res.citations || []
      };

      setMessages([asstMsg]);
    } catch (err: any) {
      console.error('Failed to generate contextual explanation', err);
      setError(err?.message || 'Could not generate explanation for this element.');
      setMessages([
        {
          id: `ctx-err-${Date.now()}`,
          role: 'assistant',
          content: `Unable to retrieve live AI explanation for "${selection.title}". You can ask a specific follow-up below.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          citations: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const sendFollowUp = useCallback(async (question: string) => {
    if (!question.trim() || loading || !activeSelectionRef.current) return;

    const userText = question.trim();
    const userMsg: ContextualDialogMessage = {
      id: `ctx-user-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const currentHistory = messagesRef.current;
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setError(null);

    try {
      const dialogHistory: ContextualDialogTurn[] = currentHistory.map((m) => ({
        role: m.role,
        content: m.content
      }));

      const selection = activeSelectionRef.current;
      const payload: ContextualExplainRequest = {
        element_id: selection.id || selection.elementId,
        element_type: selection.type,
        element_title: selection.title,
        selected_text: selection.selectedText,
        surrounding_context: selection.surroundingContext,
        data: selection.data,
        query: userText,
        current_route: selection.route || window.location.pathname,
        parent_message_id: selection.parentAnswerId,
        dialog_history: dialogHistory
      };

      const res = await apiClient.explainContextualElement(payload);

      const asstMsg: ContextualDialogMessage = {
        id: `ctx-asst-${Date.now()}`,
        role: 'assistant',
        content: res.explanation,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: res.citations || []
      };

      setMessages((prev) => [...prev, asstMsg]);
    } catch (err: any) {
      console.error('Failed to answer contextual follow-up', err);
      setError(err?.message || 'Failed to process follow-up question.');
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return (
    <ContextualAIDialogContext.Provider
      value={{
        isOpen,
        activeSelection,
        messages,
        loading,
        error,
        openDialog,
        closeDialog,
        sendFollowUp
      }}
    >
      {children}
    </ContextualAIDialogContext.Provider>
  );
};

export const useContextualAIDialog = (): ContextualAIDialogContextType => {
  const context = useContext(ContextualAIDialogContext);
  if (!context) {
    throw new Error('useContextualAIDialog must be used within a ContextualAIDialogProvider');
  }
  return context;
};
