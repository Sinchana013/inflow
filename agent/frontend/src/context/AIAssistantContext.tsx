import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { apiClient } from '../api/client';
import { ConversationMessage, ToolTraceItem, SelectedObjectContext, CitationSource } from '../types';

export interface ProgressState {
  step: number; // 1 to 5
  totalSteps: number;
  label: string;
  detail: string;
}

interface AIAssistantContextType {
  isOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  messages: ConversationMessage[];
  conversationId: string | null;
  loading: boolean;
  progress: ProgressState;
  activeToolsExecuting: string[];
  selectedContext: SelectedObjectContext | null;
  setSelectedContext: (ctx: SelectedObjectContext | null) => void;
  clearSelectedContext: () => void;
  initialPrompt: string | null;
  setInitialPrompt: (prompt: string | null) => void;
  sendMessage: (query: string, contextOverride?: SelectedObjectContext) => Promise<void>;
  stopGeneration: () => void;
  clearConversation: () => void;
}

const AIAssistantContext = createContext<AIAssistantContextType | undefined>(undefined);

const STORAGE_KEY_CONV_ID = 'insightflow_ai_conv_id';
const STORAGE_KEY_MSGS = 'insightflow_ai_msgs';

const DEFAULT_WELCOME_MESSAGE: ConversationMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hello! I am your **InsightFlow Cross-Application Intelligence Assistant** [1]. I have verified read access to all business modules: Sales, Inventory, Customers, Products, and Business Reports.\n\n" +
    "You can select any item on screen and click **“Ask AI about this”**, request a **Product Intelligence Report** (e.g. *\"Analyze product Mechanical Keyboard Pro\"*), or ask cross-module questions (e.g. *\"Why did sales decline this month?\"*).",
  is_llm_powered: false,
  model_used: 'cross-application-engine',
  created_at: new Date().toISOString(),
  citations: [
    {
      id: 'cite-welcome-1',
      index: 1,
      source_type: 'application_data',
      title: 'InsightFlow Enterprise Unified Relational Database',
      route: '/dashboard',
      entity_type: 'report',
      excerpt: 'Direct read access to 6 operational modules: Sales Orders, Product Economics, Warehouse Movements, Customer Segments, and Reports.',
      verified: true
    }
  ]
};

export const AIAssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeToolsExecuting, setActiveToolsExecuting] = useState<string[]>([]);
  const [selectedContext, setSelectedContext] = useState<SelectedObjectContext | null>(null);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);

  const [progress, setProgress] = useState<ProgressState>({
    step: 1,
    totalSteps: 5,
    label: 'Understanding the request',
    detail: 'Parsing query intent and active application context...'
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const location = useLocation();

  const [conversationId, setConversationId] = useState<string | null>(() => {
    return sessionStorage.getItem(STORAGE_KEY_CONV_ID) || null;
  });

  const [messages, setMessages] = useState<ConversationMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY_MSGS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse saved conversation messages', e);
    }
    return [DEFAULT_WELCOME_MESSAGE];
  });

  // Listen for 'insightflow-ask-ai' custom events across any component
  useEffect(() => {
    const handleAskAIEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ object: SelectedObjectContext; prompt?: string }>;
      if (customEvent.detail) {
        setSelectedContext(customEvent.detail.object);
        if (customEvent.detail.prompt) {
          setInitialPrompt(customEvent.detail.prompt);
        }
        setIsOpen(true);
      }
    };

    window.addEventListener('insightflow-ask-ai', handleAskAIEvent);
    return () => window.removeEventListener('insightflow-ask-ai', handleAskAIEvent);
  }, []);

  // Save conversation state to sessionStorage
  useEffect(() => {
    if (conversationId) {
      sessionStorage.setItem(STORAGE_KEY_CONV_ID, conversationId);
    }
    sessionStorage.setItem(STORAGE_KEY_MSGS, JSON.stringify(messages));
  }, [conversationId, messages]);

  const openSidebar = () => setIsOpen(true);
  const closeSidebar = () => setIsOpen(false);
  const toggleSidebar = () => setIsOpen((prev) => !prev);
  const clearSelectedContext = () => setSelectedContext(null);

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setProgress({
      step: 1,
      totalSteps: 5,
      label: 'Generation stopped',
      detail: 'Investigation canceled by user.'
    });
  };

  const sendMessage = async (query: string, contextOverride?: SelectedObjectContext) => {
    if (!query.trim() || loading) return;

    const activeCtx = contextOverride || selectedContext;

    const userMsg: ConversationMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: query.trim(),
      selected_context: activeCtx || undefined,
      created_at: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Progressive Activity State Machine:
    // 1. Understanding request
    setProgress({
      step: 1,
      totalSteps: 5,
      label: 'Understanding the request',
      detail: 'Analyzing user query and current view context...'
    });

    const timer1 = setTimeout(() => {
      setProgress({
        step: 2,
        totalSteps: 5,
        label: 'Searching application data',
        detail: activeCtx ? `Investigating records for ${activeCtx.title}...` : 'Querying cross-module database tables...'
      });
    }, 400);

    const timer2 = setTimeout(() => {
      setProgress({
        step: 3,
        totalSteps: 5,
        label: 'Retrieving sources',
        detail: 'Collecting transactional rows, inventory positions, and catalog metrics...'
      });
    }, 900);

    const timer3 = setTimeout(() => {
      setProgress({
        step: 4,
        totalSteps: 5,
        label: 'Analyzing information',
        detail: 'Detecting velocity patterns, supply-demand alignment, and anomalies...'
      });
    }, 1400);

    const timer4 = setTimeout(() => {
      setProgress({
        step: 5,
        totalSteps: 5,
        label: 'Generating the result',
        detail: 'Synthesizing verified findings, clickable citations, and interactive canvas...'
      });
    }, 2000);

    try {
      const res = await apiClient.agentChat(
        query.trim(),
        conversationId || undefined,
        location.pathname,
        activeCtx || undefined,
        controller.signal
      );

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);

      if (res.conversation_id) {
        setConversationId(res.conversation_id);
      }

      const actionExecuted =
        res.action_executed ||
        (res.tool_traces?.some((t: ToolTraceItem) =>
          ['adjust_product_inventory', 'update_product_reorder_threshold', 'update_order_status'].includes(t.tool_name)
        )
          ? { action: 'data_mutation' }
          : null);

      if (actionExecuted) {
        window.dispatchEvent(
          new CustomEvent('insightflow-refresh-data', {
            detail: actionExecuted
          })
        );
      }

      const asstMsg: ConversationMessage = {
        id: res.message_id || `asst_${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        tool_traces: res.tool_traces,
        canvas: res.canvas,
        action_executed: actionExecuted,
        citations: res.citations || [],
        is_llm_powered: res.is_llm_powered,
        model_used: res.model_used,
        created_at: new Date().toISOString()
      };

      setMessages((prev) => [...prev, asstMsg]);
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);

      if (err.name === 'CanceledError' || err.message === 'canceled') {
        const cancelMsg: ConversationMessage = {
          id: `cancel_${Date.now()}`,
          role: 'assistant',
          content: '_Generation stopped by user._',
          is_llm_powered: false,
          created_at: new Date().toISOString()
        };
        setMessages((prev) => [...prev, cancelMsg]);
      } else {
        console.error('Agent chat error', err);
        const errMsg: ConversationMessage = {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: `**Investigation Notice**: Encountered an error executing the inquiry: ${
            err.message || 'Server error'
          }. Please check network or rephrase your question.`,
          is_llm_powered: false,
          created_at: new Date().toISOString()
        };
        setMessages((prev) => [...prev, errMsg]);
      }
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
      setActiveToolsExecuting([]);
    }
  };

  const clearConversation = () => {
    sessionStorage.removeItem(STORAGE_KEY_CONV_ID);
    sessionStorage.removeItem(STORAGE_KEY_MSGS);
    setConversationId(null);
    setSelectedContext(null);
    setInitialPrompt(null);
    setMessages([DEFAULT_WELCOME_MESSAGE]);
  };

  return (
    <AIAssistantContext.Provider
      value={{
        isOpen,
        openSidebar,
        closeSidebar,
        toggleSidebar,
        messages,
        conversationId,
        loading,
        progress,
        activeToolsExecuting,
        selectedContext,
        setSelectedContext,
        clearSelectedContext,
        initialPrompt,
        setInitialPrompt,
        sendMessage,
        stopGeneration,
        clearConversation
      }}
    >
      {children}
    </AIAssistantContext.Provider>
  );
};

export const useAIAssistant = (): AIAssistantContextType => {
  const context = useContext(AIAssistantContext);
  if (!context) {
    throw new Error('useAIAssistant must be used within an AIAssistantProvider');
  }
  return context;
};
