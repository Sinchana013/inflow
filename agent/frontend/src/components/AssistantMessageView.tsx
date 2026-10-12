import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Wrench,
  CheckCircle2,
  AlertCircle,
  FileText,
  Globe,
  Database,
  Layers,
  Sparkles,
  Link2,
  Compass
} from 'lucide-react';
import { ConversationMessage, CitationSource, ToolTraceItem } from '../types';
import { CanvasRenderer } from '../features/ai-analyst/CanvasRenderer';
import { navigateToSourceAndHighlight } from '../utils/sourceNavigator';
import { useContextualAIDialog } from '../context/ContextualAIDialogContext';

interface AssistantMessageViewProps {
  message: ConversationMessage;
}

export const AssistantMessageView: React.FC<AssistantMessageViewProps> = ({ message }) => {
  const navigate = useNavigate();
  const { openDialog } = useContextualAIDialog();
  const [expandedTraces, setExpandedTraces] = useState<boolean>(false);
  const [expandedSources, setExpandedSources] = useState<boolean>(true);
  const [navFeedback, setNavFeedback] = useState<{
    message: string;
    type: 'success' | 'info' | 'fallback';
  } | null>(null);

  const citations = message.citations || [];

  const handleCitationClick = async (citation: CitationSource) => {
    setNavFeedback({
      message: `Navigating to ${citation.subpage || citation.route || 'source'} and resolving evidence...`,
      type: 'info',
    });

    try {
      const res = await navigateToSourceAndHighlight(citation, navigate);
      if (res.isExternal) {
        setNavFeedback({ message: res.message, type: 'info' });
      } else if (res.success) {
        setNavFeedback({ message: res.message, type: 'success' });
      } else {
        setNavFeedback({ message: res.message, type: 'fallback' });
      }
    } catch (err) {
      setNavFeedback({
        message: `Navigated to ${citation.route || '/dashboard'}. Review supporting excerpt below.`,
        type: 'info',
      });
    }

    setTimeout(() => {
      setNavFeedback((current) => (current ? null : null));
    }, 4500);
  };

  // Helper: Render text with interactive code blocks, tables, lists, and citations
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Code Block Start (```)
      if (line.trim().startsWith('```')) {
        const lang = line.trim().slice(3).trim() || 'code';
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        const codeText = codeLines.join('\n');
        const codeIdx = i;
        elements.push(
          <div key={`code-${codeIdx}`} className="group relative my-2 bg-slate-900 rounded-lg p-3 text-slate-100 font-mono text-[11px] overflow-x-auto">
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800 text-[10px] text-slate-400">
              <span className="uppercase">{lang}</span>
              <button
                type="button"
                onClick={() => openDialog({
                  type: 'code',
                  title: `Code Snippet (${lang})`,
                  selectedText: codeText
                }, `Explain this ${lang} calculation and logic`)}
                className="inline-flex items-center space-x-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded cursor-pointer transition-colors"
              >
                <Sparkles className="w-3 h-3 text-blue-400" />
                <span>Ask AI about code</span>
              </button>
            </div>
            <pre className="text-emerald-400 leading-relaxed whitespace-pre-wrap">{codeText}</pre>
          </div>
        );
        continue;
      }

      // Markdown Table Start (| ... |)
      if (line.trim().startsWith('|') && line.includes('|')) {
        const tableLines: string[] = [];
        const tableStartIdx = i;
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }
        if (tableLines.length >= 2) {
          const parseRow = (r: string) => r.split('|').map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length);
          const headers = parseRow(tableLines[0]);
          const dataRows = tableLines.slice(2).map((r) => parseRow(r));

          elements.push(
            <div key={`table-${tableStartIdx}`} className="my-2 overflow-x-auto border border-slate-200 rounded-lg shadow-2xs">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    {headers.map((h, hIdx) => (
                      <th key={hIdx} className="p-2">{h}</th>
                    ))}
                    <th className="p-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dataRows.map((row, rIdx) => {
                    const rowObj: Record<string, string> = {};
                    headers.forEach((h, hIdx) => { rowObj[h] = row[hIdx] || ''; });
                    return (
                      <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                        {headers.map((_, cIdx) => (
                          <td key={cIdx} className="p-2 text-slate-800">{row[cIdx] || ''}</td>
                        ))}
                        <td className="p-2 text-right">
                          <button
                            type="button"
                            onClick={() => openDialog({
                              type: 'table_row',
                              title: `Table Row: ${row[0] || 'Record'}`,
                              data: rowObj
                            }, `Explain the significance of this row (${row[0] || 'Record'})`)}
                            className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 cursor-pointer"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                            <span>Ask AI</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // Blockquote / Recommendation (> ...)
      if (line.startsWith('> ')) {
        const quoteText = line.slice(2).trim();
        const quoteIdx = i;
        elements.push(
          <div key={`quote-${quoteIdx}`} className="my-2 p-2.5 rounded-lg bg-amber-50/70 border-l-3 border-amber-500 text-amber-950 text-xs flex items-start justify-between group">
            <div className="flex-1 italic">{renderInlineTokens(quoteText)}</div>
            <button
              type="button"
              onClick={() => openDialog({
                type: 'recommendation',
                title: 'Recommendation Finding',
                surroundingContext: quoteText
              }, `Explain this finding and prioritized actions`)}
              className="ml-2 text-[10px] font-semibold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded inline-flex items-center space-x-1 cursor-pointer shrink-0"
            >
              <Sparkles className="w-2.5 h-2.5 text-amber-600" />
              <span>Ask AI</span>
            </button>
          </div>
        );
        i++;
        continue;
      }

      // Headers (##, ###)
      if (line.startsWith('## ')) {
        elements.push(
          <h2 key={`h2-${i}`} className="text-sm font-bold text-slate-900 mt-3 mb-1 tracking-tight">
            {renderInlineTokens(line.replace('## ', ''))}
          </h2>
        );
        i++;
        continue;
      }
      if (line.startsWith('### ')) {
        elements.push(
          <h3 key={`h3-${i}`} className="text-xs font-bold text-slate-900 mt-2 mb-1 uppercase tracking-wider text-blue-900">
            {renderInlineTokens(line.replace('### ', ''))}
          </h3>
        );
        i++;
        continue;
      }

      // Bullet points
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const itemText = line.slice(2);
        const itemIdx = i;
        elements.push(
          <div key={`bullet-${itemIdx}`} className="group flex items-start space-x-1.5 pl-1.5 py-0.5 hover:bg-slate-50/70 rounded">
            <span className="text-blue-500 font-bold select-none">•</span>
            <span className="flex-1">{renderInlineTokens(itemText)}</span>
            <button
              type="button"
              onClick={() => openDialog({
                type: 'list_item',
                title: 'Bullet Item',
                selectedText: itemText
              }, `Explain this point: "${itemText.slice(0, 50)}..."`)}
              className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-600 hover:text-blue-800 px-1 py-0.2 rounded hover:bg-blue-50 inline-flex items-center space-x-0.5 cursor-pointer transition-opacity"
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span>Ask AI</span>
            </button>
          </div>
        );
        i++;
        continue;
      }

      // Numbered items
      const mNum = line.match(/^(\d+)\.\s+(.*)$/);
      if (mNum) {
        const numText = mNum[2];
        const numIdx = i;
        elements.push(
          <div key={`num-${numIdx}`} className="group flex items-start space-x-1.5 pl-1.5 py-0.5 hover:bg-slate-50/70 rounded">
            <span className="font-semibold text-blue-700 select-none">{mNum[1]}.</span>
            <span className="flex-1">{renderInlineTokens(numText)}</span>
            <button
              type="button"
              onClick={() => openDialog({
                type: 'list_item',
                title: `Point #${mNum[1]}`,
                selectedText: numText
              }, `Explain this item: "${numText.slice(0, 50)}..."`)}
              className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-600 hover:text-blue-800 px-1 py-0.2 rounded hover:bg-blue-50 inline-flex items-center space-x-0.5 cursor-pointer transition-opacity"
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span>Ask AI</span>
            </button>
          </div>
        );
        i++;
        continue;
      }

      // Empty line
      if (!line.trim()) {
        elements.push(<div key={`empty-${i}`} className="h-1.5" />);
        i++;
        continue;
      }

      // Standard Paragraph
      const pIdx = i;
      const currentLine = line;
      elements.push(
        <div key={`p-${pIdx}`} className="group relative flex items-start justify-between gap-1 hover:bg-slate-50/60 p-0.5 rounded transition-colors">
          <p className="flex-1">{renderInlineTokens(currentLine)}</p>
          <button
            type="button"
            onClick={() => openDialog({
              type: 'paragraph',
              title: 'Answer Paragraph',
              selectedText: currentLine
            }, `Explain this statement: "${currentLine.slice(0, 60)}..."`)}
            className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-600 hover:text-blue-800 px-1 py-0.2 rounded hover:bg-blue-50 inline-flex items-center space-x-0.5 cursor-pointer transition-opacity shrink-0"
          >
            <Sparkles className="w-2.5 h-2.5" />
            <span>Ask AI</span>
          </button>
        </div>
      );
      i++;
    }

    return elements;
  };

  // Helper to parse bold, links, and inline citations e.g. [1], [2]
  const renderInlineTokens = (text: string) => {
    // Regex matches:
    // 1. Markdown link: [Title](URL)
    // 2. Citation: [1], [2], [^1]
    // 3. Bold: **text**
    const regex = /(\[[^\]]+\]\([^)]+\)|\[\^?\d+\]|\*\*[^*]+\*\*)/g;
    const parts = text.split(regex);

    return parts.map((part, idx) => {
      if (!part) return null;

      // Inline Citation Pill: [1], [2], etc.
      const citeMatch = part.match(/^\[\^?(\d+)\]$/);
      if (citeMatch) {
        const citeIndex = parseInt(citeMatch[1], 10);
        const matchingSource = citations.find((c) => c.index === citeIndex);
        return (
          <button
            key={idx}
            type="button"
            onClick={() => matchingSource && handleCitationClick(matchingSource)}
            title={matchingSource ? `${matchingSource.title} (${matchingSource.source_type}) - Click to highlight evidence` : `Reference [${citeIndex}]`}
            className="inline-flex items-center justify-center px-1.5 py-0.2 mx-0.5 text-[10px] font-bold rounded-sm bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 transition-colors cursor-pointer select-none align-super hover:scale-105 active:scale-95"
          >
            {citeIndex}
          </button>
        );
      }

      // Markdown Link: [Title](URL)
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const linkText = linkMatch[1];
        const linkUrl = linkMatch[2];
        const isInternal = linkUrl.startsWith('/');
        return (
          <button
            key={idx}
            type="button"
            onClick={() => {
              if (isInternal) {
                navigate(linkUrl);
              } else {
                window.open(linkUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            className="inline-flex items-center space-x-0.5 text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
          >
            <span>{linkText}</span>
            <ExternalLink className="w-2.5 h-2.5 inline ml-0.5" />
          </button>
        );
      }

      // Bold text: **text**
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
      }

      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <div className="space-y-3">
      {/* Main Message Body */}
      <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
        {renderFormattedContent(message.content)}

        {/* Traceable Sources & Verifiable Evidence Accordion */}
        {citations.length > 0 && (
          <div className="pt-2 border-t border-slate-100 mt-2">
            <button
              onClick={() => setExpandedSources((prev) => !prev)}
              className="flex items-center justify-between w-full py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Traceable Sources & Evidence ({citations.length})</span>
                <span className="text-[10px] font-normal text-slate-400">• Click to navigate & highlight</span>
              </div>
              {expandedSources ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {/* Navigation feedback alert */}
            {navFeedback && (
              <div
                className={`mt-2 p-2 rounded-lg text-[11px] font-medium flex items-center gap-2 transition-all animate-in fade-in duration-150 ${
                  navFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : navFeedback.type === 'fallback'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                }`}
              >
                {navFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : navFeedback.type === 'fallback' ? (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                ) : (
                  <Compass className="w-3.5 h-3.5 text-blue-600 shrink-0 animate-spin" />
                )}
                <span>{navFeedback.message}</span>
              </div>
            )}

            {expandedSources && (
              <div className="mt-2.5 space-y-2 animate-in fade-in duration-150">
                {citations.map((source) => {
                  const isWeb = source.source_type === 'external_web';
                  const isContext = source.source_type === 'uploaded_context';
                  const typeLabel = isWeb
                    ? 'External Web Source'
                    : isContext
                    ? 'Selected UI Context'
                    : 'Application Record';

                  return (
                    <div
                      key={source.id}
                      className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-50/90 border border-slate-200/80 transition-all text-left space-y-2 group"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-5 h-5 rounded-md bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                            {source.index}
                          </div>
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {source.title}
                          </div>
                        </div>
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wide ${
                            isWeb
                              ? 'bg-emerald-100 text-emerald-800'
                              : isContext
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {typeLabel}
                        </span>
                      </div>

                      {/* Subpage / Section / Element Location */}
                      {(source.subpage || source.element_id || source.route) && (
                        <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-slate-600">Location:</span>
                          <span className="text-slate-700">{source.subpage || source.route}</span>
                          {source.element_id && (
                            <span className="font-mono text-[9px] bg-slate-200/70 text-slate-600 px-1 py-0.2 rounded">
                              #{source.element_id}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Supporting Excerpt */}
                      {source.excerpt && (
                        <div className="p-2 rounded bg-white border border-slate-200/70 text-[11px] text-slate-700 italic border-l-2 border-l-emerald-500 leading-relaxed">
                          "{source.excerpt}"
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-slate-400">
                          {source.retrieval_timestamp
                            ? `Retrieved ${new Date(source.retrieval_timestamp).toLocaleTimeString()}`
                            : source.timestamp || 'Verified live'}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openDialog({
                              type: 'citation',
                              title: source.title,
                              selectedText: source.excerpt,
                              data: source,
                              route: source.route || window.location.pathname
                            }, `Analyze the reliability, provenance, and data grounding of "${source.title}"`)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                            title="Ask AI about this evidence source"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                            <span>Ask AI</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCitationClick(source)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer"
                          >
                            <span>{isWeb ? 'Open source' : 'Open source & highlight evidence'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Database Action Execution Confirmation */}
        {message.action_executed && (
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="leading-snug font-medium">
              Database mutation executed & synchronized with application views.
            </div>
          </div>
        )}

        {/* Tool Execution Traces Accordion */}
        {message.tool_traces && message.tool_traces.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={() => setExpandedTraces((prev) => !prev)}
              className="flex items-center justify-between w-full text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-1.5">
                <Wrench className="w-3.5 h-3.5 text-slate-400" />
                <span>Executed Database Tools ({message.tool_traces.length})</span>
              </div>
              {expandedTraces ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {expandedTraces && (
              <div className="mt-2 space-y-1.5 animate-in fade-in duration-150">
                {message.tool_traces.map((trace: ToolTraceItem, tIdx: number) => (
                  <div key={tIdx} className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-[11px] font-mono">
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span>{trace.tool_name}</span>
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => openDialog({
                            type: 'code',
                            title: `Database Tool: ${trace.tool_name}`,
                            data: trace
                          }, `Explain the arguments and query result of tool ${trace.tool_name}`)}
                          className="text-blue-600 hover:text-blue-800 text-[10px] font-medium inline-flex items-center space-x-0.5 cursor-pointer"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Ask AI</span>
                        </button>
                        <span className="text-slate-400 text-[10px]">{trace.duration_ms}ms</span>
                      </div>
                    </div>
                    {trace.args && Object.keys(trace.args).length > 0 && (
                      <div className="text-slate-500 text-[10px] mt-0.5">
                        args: {JSON.stringify(trace.args)}
                      </div>
                    )}
                    {trace.result_summary && (
                      <div className="text-blue-600 text-[10px] mt-0.5">
                        result: {trace.result_summary}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Embedded Dynamic Canvas */}
      {message.canvas && (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs">
          <CanvasRenderer
            canvas={message.canvas}
            citations={citations}
            summary={message.content}
            showExportMenu={true}
          />
        </div>
      )}
    </div>
  );
};
