import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  BarChart2,
  FileText,
  Table,
  Hash,
  Code2,
  Lightbulb,
  Image as ImageIcon,
  BookOpen,
  Check,
  Copy,
  Layers,
  ArrowRight,
  Minimize2,
  Maximize2
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { useContextualAIDialog } from '../context/ContextualAIDialogContext';
import { CitationSource, ContextualElementType } from '../types';
import { navigateToSourceAndHighlight } from '../utils/sourceNavigator';
import { FloatingWindow } from './FloatingWindow';

const PALETTE = ['#2563eb', '#38bdf8', '#818cf8', '#a855f7', '#10b981'];

export const ContextualAIDialog: React.FC = () => {
  const {
    isOpen,
    activeSelection,
    messages,
    loading,
    error,
    closeDialog,
    sendFollowUp
  } = useContextualAIDialog();

  const navigate = useNavigate();
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [followUpText, setFollowUpText] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [navFeedback, setNavFeedback] = useState<{ message: string; isExternal?: boolean } | null>(null);
  const [expandedSources, setExpandedSources] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset minimized state when a new element is selected
  useEffect(() => {
    setIsMinimized(false);
  }, [activeSelection]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeDialog();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeDialog]);

  // Auto-scroll to bottom of conversation inside dialog
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && !loading && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, loading, isMinimized]);

  if (!isOpen || !activeSelection) return null;

  const handleFollowUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpText.trim() || loading) return;
    const q = followUpText.trim();
    setFollowUpText('');
    sendFollowUp(q);
  };

  const handleCitationClick = async (citation: CitationSource) => {
    // If navigating to an internal application page, minimize dialog so the user can see the green highlight on the actual webpage!
    if (citation.source_type !== 'external_web' && !citation.url?.startsWith('http')) {
      setIsMinimized(true);
    }
    setNavFeedback({ message: `Navigating to ${citation.subpage || citation.route || 'source'}...` });
    try {
      const res = await navigateToSourceAndHighlight(citation, navigate);
      setNavFeedback({ message: res.message, isExternal: res.isExternal });
    } catch {
      setNavFeedback({ message: `Navigated to ${citation.route || '/dashboard'}. Review excerpt below.` });
    }
    setTimeout(() => setNavFeedback(null), 4500);
  };

  const handleCopyCode = (codeText: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getTypeIcon = (type: ContextualElementType) => {
    switch (type) {
      case 'chart':
        return <BarChart2 className="w-3.5 h-3.5 text-blue-600" />;
      case 'metric':
        return <Hash className="w-3.5 h-3.5 text-emerald-600" />;
      case 'table_row':
      case 'table':
        return <Table className="w-3.5 h-3.5 text-purple-600" />;
      case 'code':
        return <Code2 className="w-3.5 h-3.5 text-amber-600" />;
      case 'recommendation':
        return <Lightbulb className="w-3.5 h-3.5 text-amber-500" />;
      case 'image':
      case 'diagram':
        return <ImageIcon className="w-3.5 h-3.5 text-sky-600" />;
      case 'citation':
        return <BookOpen className="w-3.5 h-3.5 text-emerald-600" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  // Render selected element preview according to its type
  const renderSelectedContentPreview = () => {
    const s = activeSelection;
    switch (s.type) {
      case 'chart': {
        const data = Array.isArray(s.data) ? s.data : [];
        if (!data.length) {
          return (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 italic">
              Visualization: {s.title} (live chart series)
            </div>
          );
        }
        // Determine keys
        const first = data[0];
        const keys = Object.keys(first);
        const xKey = keys.find((k) => ['period', 'date', 'name', 'category', 'month'].includes(k)) || keys[0];
        const yKey = keys.find((k) => ['revenue', 'value', 'amount', 'sales', 'count'].includes(k)) || keys[1] || keys[0];

        return (
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-800">{s.title}</span>
              <span className="text-[10px] text-slate-500">{data.length} data points</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', fontSize: '11px' }} />
                  <Bar dataKey={yKey} fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      }

      case 'metric': {
        const val = s.data?.formatted_value || s.data?.value || s.selectedText || '0';
        const trend = s.data?.trend || 'neutral';
        const changePct = s.data?.change_percentage;

        return (
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{s.title}</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{val}</div>
            </div>
            {changePct !== undefined && (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  trend === 'up'
                    ? 'bg-emerald-100 text-emerald-800'
                    : trend === 'down'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {trend === 'up' ? '+' : ''}{changePct}%
              </span>
            )}
          </div>
        );
      }

      case 'table_row': {
        const row = s.data || {};
        const entries = Object.entries(row).filter(
          ([k]) => !['created_at', 'updated_at', 'description'].includes(k)
        );

        return (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-x-auto">
            <div className="text-xs font-semibold text-slate-800 mb-2">{s.title}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {entries.slice(0, 8).map(([key, value]) => (
                <div key={key} className="p-2 bg-white rounded-lg border border-slate-200/60">
                  <div className="text-[10px] text-slate-400 capitalize truncate">{key.replace(/_/g, ' ')}</div>
                  <div className="font-semibold text-slate-900 truncate mt-0.5">
                    {typeof value === 'number' && key.includes('price') ? `$${value.toFixed(2)}` : String(value ?? '-')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'code': {
        const codeSnippet = s.selectedText || String(s.data || '');
        return (
          <div className="relative bg-slate-900 text-slate-100 rounded-xl p-3.5 text-xs font-mono overflow-x-auto">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] text-slate-400">
              <span>{s.title}</span>
              <button
                type="button"
                onClick={() => handleCopyCode(codeSnippet)}
                className="flex items-center space-x-1 hover:text-white transition-colors cursor-pointer"
              >
                {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="text-emerald-400 leading-relaxed overflow-x-auto whitespace-pre-wrap">
              {codeSnippet}
            </pre>
          </div>
        );
      }

      case 'recommendation': {
        return (
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 text-amber-950 rounded-xl text-xs space-y-1">
            <div className="flex items-center space-x-1.5 font-bold">
              <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{s.title}</span>
            </div>
            {s.surroundingContext && (
              <p className="text-slate-700 leading-relaxed text-[11px]">{s.surroundingContext}</p>
            )}
          </div>
        );
      }

      case 'image':
      case 'diagram': {
        return (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div className="text-xs font-semibold text-slate-800">{s.title}</div>
            <div className="text-[11px] text-slate-400">Visual System Architecture Representation</div>
          </div>
        );
      }

      case 'citation': {
        return (
          <div className="p-3 bg-emerald-50/80 border border-emerald-200 text-emerald-950 rounded-xl text-xs space-y-1">
            <div className="font-bold flex items-center space-x-1.5">
              <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
              <span>{s.title}</span>
            </div>
            {s.selectedText && (
              <p className="italic text-slate-700 text-[11px]">"{s.selectedText}"</p>
            )}
          </div>
        );
      }

      default: {
        const text = s.selectedText || s.title;
        return (
          <div className="p-3.5 bg-slate-50 border-l-3 border-l-blue-600 border border-slate-200/80 rounded-xl text-xs text-slate-800 leading-relaxed">
            <span className="font-medium text-slate-500 block text-[10px] uppercase mb-1">Selected Passage</span>
            <p className="italic text-slate-800">"{text}"</p>
          </div>
        );
      }
    }
  };

  // Helper to render markdown tokens & citations
  const renderTokens = (text: string, citations: CitationSource[] = []) => {
    const regex = /(\[[^\]]+\]\([^)]+\)|\[\^?\d+\]|\*\*[^*]+\*\*)/g;
    const parts = text.split(regex);

    return parts.map((part, idx) => {
      if (!part) return null;

      const citeMatch = part.match(/^\[\^?(\d+)\]$/);
      if (citeMatch) {
        const citeIndex = parseInt(citeMatch[1], 10);
        const matchingSource = citations.find((c) => c.index === citeIndex);
        return (
          <button
            key={idx}
            type="button"
            onClick={() => matchingSource && handleCitationClick(matchingSource)}
            className="inline-flex items-center justify-center px-1.5 py-0.2 mx-0.5 text-[10px] font-bold rounded-sm bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 transition-colors cursor-pointer select-none align-super hover:scale-105"
            title={matchingSource ? `Evidence [${citeIndex}]: ${matchingSource.title}` : `Reference [${citeIndex}]`}
          >
            {citeIndex}
          </button>
        );
      }

      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
      }

      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <FloatingWindow
      isOpen={isOpen && !!activeSelection}
      onClose={closeDialog}
      title={
        <div className="flex items-center space-x-2">
          <span>Ask AI about this</span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
            {getTypeIcon(activeSelection.type)}
            <span>{activeSelection.type.replace('_', ' ')}</span>
          </span>
        </div>
      }
      subtitle={activeSelection.title}
      headerPrefix={
        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/80 shrink-0">
          <Sparkles className="w-4 h-4 text-blue-600" />
        </div>
      }
      isMinimized={isMinimized}
      onToggleMinimize={setIsMinimized}
      showMinimize={true}
      maxWidth="2xl"
      bodyClassName="space-y-4"
      footer={
        <form onSubmit={handleFollowUpSubmit} className="p-3">
          <div className="flex items-center space-x-2 bg-white rounded-xl border border-slate-200 px-3 py-1.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <input
              ref={inputRef}
              type="text"
              value={followUpText}
              onChange={(e) => setFollowUpText(e.target.value)}
              placeholder={`Ask a follow-up about this ${activeSelection.type.replace('_', ' ')}...`}
              disabled={loading}
              className="flex-1 text-xs bg-transparent border-none outline-none text-slate-800 placeholder-slate-400"
            />
            <button
              type="submit"
              disabled={!followUpText.trim() || loading}
              className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white transition-colors cursor-pointer shrink-0"
              title="Submit follow-up"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      }
    >
      {/* Navigation Feedback Toast */}
      {navFeedback && (
        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-emerald-600 animate-ping shrink-0" />
            <span>{navFeedback.message}</span>
          </div>
        </div>
      )}

      {/* B. Selected-Content Preview */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center space-x-1">
          <span>Selected Element</span>
        </div>
        {renderSelectedContentPreview()}
      </div>

      {/* C. Conversation & Explanation Flow */}
      <div className="space-y-3.5 pt-1">
        {messages.map((m, idx) => (
          <div
            key={m.id || idx}
            className={`flex flex-col space-y-1.5 ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 px-1">
              <span className="font-semibold text-slate-600">
                {m.role === 'user' ? 'You' : 'AI Assistant'}
              </span>
              <span>•</span>
              <span>{m.timestamp}</span>
            </div>

            <div
              className={`p-3.5 rounded-xl text-xs leading-relaxed max-w-[94%] ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                  : 'bg-slate-50 border border-slate-200/80 text-slate-800 rounded-bl-xs shadow-2xs'
              }`}
            >
              <div className="space-y-1.5">
                {m.content.split('\n').map((line, lIdx) => {
                  if (!line.trim()) return <div key={lIdx} className="h-1" />;
                  return <p key={lIdx}>{renderTokens(line, m.citations || [])}</p>;
                })}
              </div>

              {/* D. Evidence & Source Links */}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-200/70 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <span>Supporting Evidence ({m.citations.length})</span>
                  </div>

                  <div className="space-y-1.5">
                    {m.citations.map((cite, cIdx) => (
                      <div
                        key={cite.id || cIdx}
                        className="p-2.5 rounded-lg bg-white border border-slate-200/80 text-slate-800 text-[11px] space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-center space-x-1.5 font-semibold text-slate-900 truncate">
                            <span className="w-4 h-4 rounded-sm bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                              {cite.index}
                            </span>
                            <span className="truncate">{cite.title}</span>
                          </div>
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold shrink-0">
                            {cite.source_type}
                          </span>
                        </div>

                        {cite.excerpt && (
                          <p className="text-[10px] text-slate-600 italic border-l-2 border-l-emerald-500 pl-1.5">
                            "{cite.excerpt}"
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[9px] text-slate-400 font-mono">
                            #{cite.element_id || cite.route || 'source'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCitationClick(cite)}
                            className="inline-flex items-center space-x-1 px-2 py-0.8 rounded text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer"
                          >
                            <span>Open source & highlight</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center space-x-2 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>Analyzing {activeSelection.title} and grounding evidence...</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </FloatingWindow>
  );

};
