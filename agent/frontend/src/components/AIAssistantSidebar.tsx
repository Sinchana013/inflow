import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  X,
  Send,
  Sparkles,
  RotateCcw,
  Compass,
  ArrowRight,
  Maximize2,
  Minimize2,
  Square,
  Tag,
  CheckCircle2,
  Layers,
  HelpCircle,
  FileQuestion,
  TrendingUp,
  ShoppingCart,
  Paperclip,
  Image as ImageIcon,
  Upload,
  FileText
} from 'lucide-react';
import { useAIAssistant } from '../context/AIAssistantContext';
import { useProductAgent } from '../context/ProductAgentContext';
import { AssistantMessageView } from './AssistantMessageView';

const GENERAL_PROMPTS = [
  "Why did sales decline this month?",
  "Find products with increasing demand and low stock.",
  "Which regions have the strongest revenue growth?",
  "Which category contributed the most to sales?",
  "Analyze product Mechanical Keyboard Pro"
];

export const AIAssistantSidebar: React.FC = () => {
  const {
    isOpen,
    closeSidebar,
    messages,
    loading,
    progress,
    selectedContext,
    clearSelectedContext,
    initialPrompt,
    setInitialPrompt,
    sendMessage,
    stopGeneration,
    clearConversation
  } = useAIAssistant();

  const { openAgentWindow } = useProductAgent();

  const [input, setInput] = useState<string>('');
  const [sidebarWidth, setSidebarWidth] = useState<number>(540);
  const [isWide, setIsWide] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Attached image state
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const location = useLocation();

  const handleFileSelect = (file: File) => {
    setAttachedFile(file);
    if (file.type.startsWith('image/') || file.name.endsWith('.pdf')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleRemoveFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAttachedFile(null);
    setPreviewUrl(null);
  };

  // If initialPrompt is set from an external trigger, load it into input
  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
      setInitialPrompt(null);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [initialPrompt, setInitialPrompt]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeSidebar]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen]);

  // Mouse drag handle logic for resizing sidebar
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.min(Math.max(400, newWidth), Math.min(1200, window.innerWidth - 60));
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const toggleWide = () => {
    if (isWide) {
      setSidebarWidth(540);
      setIsWide(false);
    } else {
      setSidebarWidth(Math.min(900, window.innerWidth - 80));
      setIsWide(true);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (attachedFile) {
      openAgentWindow(attachedFile);
      handleRemoveFile();
      return;
    }
    if (!input.trim() || loading) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Get contextual suggested prompt chips depending on selected object
  const getContextPrompts = (): string[] => {
    if (!selectedContext) return GENERAL_PROMPTS;

    switch (selectedContext.type) {
      case 'product':
        return [
          `Analyze product ${selectedContext.title}`,
          `Check stockout risk for SKU #${selectedContext.id || ''}`,
          `Why did sales velocity change?`,
          `Recommend replenishment quantity`
        ];
      case 'order':
        return [
          `Explain order #${selectedContext.id || ''}`,
          `Summarize line items and total`,
          `Check customer profile for this order`
        ];
      case 'inventory':
        return [
          `Explain stock movements for ${selectedContext.title}`,
          `Calculate warehouse safety runway`,
          `Recommend reorder action`
        ];
      case 'customer':
        return [
          `Summarize customer lifetime value`,
          `Explain cohort segment for ${selectedContext.title}`,
          `Show repeat purchase frequency`
        ];
      case 'kpi':
        return [
          `Why has ${selectedContext.title} changed?`,
          `Compare ${selectedContext.title} with previous period`,
          `Find root causes for this metric`
        ];
      case 'chart':
        return [
          `Find anomalies in this chart`,
          `Explain the primary trend`,
          `What action should we take based on this data?`
        ];
      case 'text':
        return [
          `Explain this selection`,
          `Is this claim backed by database data?`,
          `Analyze the implications of this statement`
        ];
      default:
        return GENERAL_PROMPTS;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop for smaller mobile screens */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-2xs lg:hidden"
        onClick={closeSidebar}
      />

      <aside
        style={{ width: `${sidebarWidth}px` }}
        className="fixed top-0 bottom-0 right-0 z-50 max-w-full bg-white border-l border-slate-200/90 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 select-text"
      >
        {/* Left Resizing Drag Handle */}
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={toggleWide}
          title="Drag to resize sidebar width, double-click to snap"
          className={`absolute left-0 top-0 bottom-0 w-2 -ml-1 cursor-ew-resize transition-colors z-50 group flex items-center justify-center ${
            isDragging ? 'bg-blue-600' : 'hover:bg-blue-400'
          }`}
        >
          <div className="w-0.5 h-8 bg-slate-300 group-hover:bg-white rounded-full" />
        </div>

        {/* Header */}
        <div className="h-16 px-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 tracking-tight flex items-center">
                InsightFlow Assistant
                <span className="ml-2 text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700">
                  Context-Aware
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Verified evidence & dynamic multi-module canvases
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={toggleWide}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              title={isWide ? 'Standard Width' : 'Expand Width'}
            >
              {isWide ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={clearConversation}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              title="Clear Conversation History"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={closeSidebar}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              title="Close Assistant (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Current Context Pill Bar */}
        <div className="px-4 py-2 bg-blue-50/60 border-b border-blue-100/70 text-[11px] text-blue-900 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-1.5 truncate">
            <Compass className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="text-slate-500">Active View:</span>
            <span className="font-semibold text-blue-800 uppercase tracking-wide">
              {location.pathname.replace('/', '') || 'dashboard'}
            </span>
          </div>
          <span className="text-[10px] text-blue-700 font-semibold px-1.5 py-0.2 rounded bg-blue-100/70">
            Cross-Module Database Scope
          </span>
        </div>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              {msg.role === 'user' ? (
                <div className="flex flex-col items-end space-y-1">
                  {msg.selected_context && (
                    <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700">
                      <Tag className="w-3 h-3 text-indigo-500" />
                      <span>Context: {msg.selected_context.title}</span>
                    </div>
                  )}
                  <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-blue-600 text-white px-4 py-2.5 text-xs font-normal leading-relaxed shadow-xs">
                    {msg.content}
                  </div>
                  <div className="text-[10px] text-slate-400 px-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ) : (
                <AssistantMessageView message={msg} />
              )}
            </div>
          ))}

          {/* Meaningful Multi-Step Progress State (Instead of generic spinner) */}
          {loading && (
            <div className="p-4 rounded-xl bg-slate-50 border border-blue-100 shadow-2xs space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
                  <span className="text-xs font-bold text-slate-900">
                    Step {progress.step} of {progress.totalSteps}: {progress.label}
                  </span>
                </div>
                <button
                  onClick={stopGeneration}
                  className="inline-flex items-center space-x-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                >
                  <Square className="w-3 h-3 fill-rose-600 text-rose-600" />
                  <span>Stop</span>
                </button>
              </div>

              {/* Progress Steps Timeline Bar */}
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((stepNum) => (
                  <div
                    key={stepNum}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      stepNum < progress.step
                        ? 'bg-emerald-500'
                        : stepNum === progress.step
                        ? 'bg-blue-600 animate-pulse'
                        : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>

              <p className="text-[11px] text-slate-600 italic leading-snug">
                {progress.detail}
              </p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer & Input Controls Area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileSelect(e.dataTransfer.files[0]);
            }
          }}
          className={`p-3 bg-slate-50/90 border-t border-slate-200/90 shrink-0 space-y-2 transition-all ${
            isDragOver ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-300' : ''
          }`}
        >
          {/* Drag and Drop Active Overlay Prompt */}
          {isDragOver && (
            <div className="p-3 bg-emerald-100/90 border border-emerald-300 rounded-xl text-center text-xs font-bold text-emerald-900 animate-pulse">
              Drop your packing slip or document to extract products
            </div>
          )}

          {/* Attached Image Preview Card */}
          {attachedFile && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200">
              <div className="flex items-center space-x-2.5 min-w-0">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-10 h-10 object-cover rounded-lg border border-emerald-300 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-700 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">{attachedFile.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {(attachedFile.size / 1024).toFixed(1)} KB • Document attached
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    openAgentWindow(attachedFile);
                    handleRemoveFile();
                  }}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Extract Products
                </button>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-emerald-100/60 transition-colors"
                  title="Remove attached document"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Active Selected Webpage Context Chip */}
          {selectedContext && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50/80 border border-indigo-200 text-xs">
              <div className="flex items-center space-x-2 truncate">
                <Tag className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="text-slate-500 font-medium">Selected Object:</span>
                <span className="font-bold text-indigo-900 truncate">
                  {selectedContext.title}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-200/60 text-indigo-800 font-semibold uppercase">
                  {selectedContext.type}
                </span>
              </div>
              <button
                onClick={clearSelectedContext}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-indigo-100/60 transition-colors cursor-pointer"
                title="Clear selected object context"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Contextual Suggested Prompt Chips */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar">
            {getContextPrompts().slice(0, 4).map((promptText, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInput(promptText);
                  if (textareaRef.current) textareaRef.current.focus();
                }}
                className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/90 hover:border-blue-300 transition-colors cursor-pointer shadow-2xs"
              >
                {promptText}
              </button>
            ))}
          </div>

          {/* Query Input Box */}
          <form onSubmit={handleSubmit} className="relative flex items-end">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                attachedFile
                  ? `Click "Extract Products" or press Enter to analyze ${attachedFile.name}...`
                  : selectedContext
                  ? `Ask AI about ${selectedContext.title}... (e.g. "Explain this", "Why has value changed?")`
                  : "Ask any cross-module question or drop a packing slip... (Enter to send)"
              }
              className="w-full text-xs p-3 pr-24 rounded-xl border border-slate-300/90 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white text-slate-900 resize-none transition-all outline-hidden leading-relaxed"
            />
            <div className="absolute right-2 bottom-2.5 flex items-center space-x-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Attach packing slip, invoice or product image"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>

              {loading ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  className="p-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer"
                  title="Stop Generation"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() && !attachedFile}
                  className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white shadow-xs transition-colors cursor-pointer"
                  title="Send message or process document (Enter)"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>
        </div>
      </aside>
    </>
  );
};
