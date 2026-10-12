import React, { useState, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  HelpCircle,
  History,
  CheckCircle2,
  AlertCircle,
  Layers,
  Loader2,
  ShieldAlert,
  Wrench,
  ChevronDown,
  ChevronUp,
  Zap,
  ArrowRight
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { AnalysisRunResponse, ToolTraceItem } from '../../types';
import { CanvasRenderer } from './CanvasRenderer';
import { useAIAssistant } from '../../context/AIAssistantContext';

const SUGGESTED_PROMPTS = [
  "Which products have declining sales and high inventory?",
  "Analyze product Mechanical Keyboard Pro",
  "Find products with increasing demand and low stock.",
  "Which regions have the strongest revenue growth?",
  "Analyze product Wireless Noise-Canceling Earbuds",
  "Why did sales decline this month?",
  "Which product categories contribute most to revenue?"
];

export const AIAnalystPage: React.FC = () => {
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisRunResponse | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [showTraces, setShowTraces] = useState<boolean>(true);
  const { openSidebar, sendMessage } = useAIAssistant();

  // Automatically execute the primary default analysis on initial load
  useEffect(() => {
    executeAnalysis("Which products have declining sales and high inventory?");
  }, []);

  const executeAnalysis = async (userQuery: string) => {
    if (!userQuery.trim() || loading) return;

    try {
      setLoading(true);
      setQuery(userQuery);
      const res = await apiClient.runAnalysis(userQuery);
      setAnalysisResult(res);
      setHistory((prev) => Array.from(new Set([userQuery, ...prev])).slice(0, 8));
    } catch (err) {
      console.error('Failed to run analysis', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeAnalysis(query);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI Analyst Workspace</h1>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
              analysisResult?.is_rule_based === false
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              {analysisResult?.is_rule_based === false ? 'Gemini 2.5 Flash' : 'Deterministic Engine'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Dynamic multi-dimensional dashboard canvas generator powered by verified database metrics and cross-module tools.
          </p>
        </div>

        <button
          onClick={() => {
            if (analysisResult?.query) {
              sendMessage(analysisResult.query);
            }
            openSidebar();
          }}
          className="self-start sm:self-auto flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Open Assistant Drawer</span>
          <ArrowRight className="w-3 h-3 text-blue-500" />
        </button>
      </div>

      {/* Dynamic Capability Banner */}
      <div className={`p-3.5 rounded-xl border flex items-start space-x-3 text-xs ${
        analysisResult?.is_rule_based === false
          ? 'bg-indigo-50/70 border-indigo-200/80'
          : 'bg-blue-50/70 border-blue-200/80'
      }`}>
        {analysisResult?.is_rule_based === false ? (
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        ) : (
          <Zap className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        )}
        <div className="space-y-0.5">
          <div className={`font-semibold ${
            analysisResult?.is_rule_based === false ? 'text-indigo-900' : 'text-blue-900'
          }`}>
            {analysisResult?.is_rule_based === false
              ? 'Gemini LLM Multi-Step Tool Investigation Active'
              : 'Rule-Based Deterministic Analytics Active'}
          </div>
          <div className="text-slate-600">
            {analysisResult?.is_rule_based === false
              ? 'Gemini autonomously determined the relevant database tools, inspected multi-module metrics, and generated this structured canvas specification.'
              : 'Queries run through certified database analytical routines, correlating sales, inventory, customers, and product tables with zero hallucinations.'}
          </div>
        </div>
      </div>

      {/* Main Workspace Layout: Left (Inputs & Suggested) + Right (Dynamic Canvas) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Conversational Input & Suggested Prompts */}
        <div className="lg:col-span-4 space-y-4">
          {/* Query Input Box */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2 flex items-center">
              <Bot className="w-3.5 h-3.5 text-blue-600 mr-1.5" /> Ask Business Question
            </h2>
            <form onSubmit={handleFormSubmit} className="space-y-3">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about revenue, low stock, customer churn, regional growth..."
                rows={3}
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 shadow-xs transition-colors cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Run Analysis</span>
              </button>
            </form>
          </div>

          {/* Suggested Prompts */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-2.5">
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center">
              <HelpCircle className="w-3.5 h-3.5 text-indigo-600 mr-1.5" /> Suggested Inquiries
            </h2>
            <div className="space-y-1.5">
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => executeAnalysis(prompt)}
                  className="w-full text-left p-2 rounded-lg text-[11px] font-medium text-slate-700 hover:text-blue-600 bg-slate-50 hover:bg-blue-50/50 border border-slate-200/60 hover:border-blue-200 transition-colors block"
                >
                  &ldquo;{prompt}&rdquo;
                </button>
              ))}
            </div>
          </div>

          {/* Query History */}
          {history.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-2">
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center">
                <History className="w-3.5 h-3.5 text-slate-500 mr-1.5" /> Recent Queries
              </h2>
              <div className="space-y-1">
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => executeAnalysis(h)}
                    className="w-full text-left py-1 px-2 text-[11px] text-slate-500 hover:text-slate-900 truncate block hover:bg-slate-50 rounded"
                  >
                    • {h}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Canvas Workspace */}
        <div className="lg:col-span-8 space-y-4">
          {loading ? (
            <div className="min-h-[450px] bg-white rounded-xl border border-slate-200/80 p-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-xs text-slate-500 font-medium">
                Synthesizing multi-module dataset and compiling canvas specification...
              </p>
            </div>
          ) : analysisResult ? (
            <div className="space-y-4">
              {/* Analysis Explanation Header */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-800">Diagnostic Summary</span>
                  <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Validated against SQLite
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {analysisResult.explanation}
                </p>
              </div>

              {/* Tool Execution Traces Panel */}
              {analysisResult.tool_traces && analysisResult.tool_traces.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs">
                  <button
                    onClick={() => setShowTraces(!showTraces)}
                    className="flex items-center justify-between w-full text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
                  >
                    <span className="flex items-center space-x-2">
                      <Wrench className="w-3.5 h-3.5 text-blue-600" />
                      <span>Executed Cross-Module Tools ({analysisResult.tool_traces.length})</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        Total duration: {analysisResult.tool_traces.reduce((acc, t) => acc + (t.duration_ms || 0), 0)}ms
                      </span>
                    </span>
                    {showTraces ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {showTraces && (
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-2.5">
                      {analysisResult.tool_traces.map((trace: ToolTraceItem, idx: number) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-blue-700 text-[11px]">
                              {trace.tool_name}()
                            </span>
                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-100 text-emerald-700">
                                {trace.status}
                              </span>
                              <span className="text-[10px] text-slate-400">{trace.duration_ms}ms</span>
                            </div>
                          </div>
                          {trace.result_summary && (
                            <p className="text-[11px] text-slate-600">
                              {trace.result_summary}
                            </p>
                          )}
                          {trace.args && Object.keys(trace.args).length > 0 && (
                            <div className="text-[10px] font-mono text-slate-400 bg-white/80 p-1 rounded border border-slate-200/50 truncate">
                              args: {JSON.stringify(trace.args)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Dynamic Canvas Component Tree with Citations & Multi-Format Export */}
              <CanvasRenderer
                canvas={analysisResult.canvas}
                query={analysisResult.query}
                citations={analysisResult.citations}
              />
            </div>
          ) : (
            <div className="min-h-[450px] bg-white rounded-xl border border-slate-200/80 p-12 flex flex-col items-center justify-center text-center space-y-2">
              <Bot className="w-10 h-10 text-slate-300" />
              <h3 className="text-sm font-semibold text-slate-700">Canvas Ready for Query</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Select a suggested question on the left or enter a custom business inquiry to construct a dynamic canvas.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
