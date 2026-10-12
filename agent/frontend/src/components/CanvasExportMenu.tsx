import React, { useState } from 'react';
import {
  Download,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileCheck,
  Image as ImageIcon,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '../api/client';
import { CanvasSpecification, CitationSource } from '../types';

interface CanvasExportMenuProps {
  canvas?: CanvasSpecification | null;
  title?: string;
  subtitle?: string;
  summary?: string;
  citations?: CitationSource[];
  recommendations?: string[];
  className?: string;
}

export const CanvasExportMenu: React.FC<CanvasExportMenuProps> = ({
  canvas,
  title,
  subtitle,
  summary,
  citations,
  recommendations,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const reportTitle = title || canvas?.title || "InsightFlow AI Analytics Report";
  const reportSubtitle = subtitle || canvas?.subtitle || "Cross-Module Enterprise Intelligence";

  const handleExport = async (format: 'pptx' | 'docx' | 'xlsx' | 'pdf' | 'png') => {
    try {
      setExportingFormat(format);
      setExportStatus(null);

      // Extract tables and KPIs from canvas
      const tables: any[] = [];
      const kpis: any[] = [];
      let chartConfig: any = null;

      if (canvas && Array.isArray(canvas.components)) {
        canvas.components.forEach((comp) => {
          if (comp.type === 'data_table' && comp.props) {
            tables.push({
              title: comp.title || 'Data Table',
              columns: comp.props.columns || [],
              rows: comp.props.data || []
            });
          } else if (comp.type === 'kpi_card' && comp.props) {
            kpis.push({
              title: comp.props.title || comp.title || 'Metric',
              value: comp.props.value || 0,
              formatted_value: comp.props.formatted_value || String(comp.props.value || ''),
              trend: comp.props.trend || 'neutral',
              period_label: comp.props.period_label || ''
            });
          } else if ((comp.type === 'bar_chart' || comp.type === 'line_chart') && comp.props && !chartConfig) {
            chartConfig = {
              type: comp.type === 'bar_chart' ? 'bar' : 'line',
              data: comp.props.data || [],
              x_key: comp.props.categoryKey || comp.props.xKey || 'category',
              y_keys: [comp.props.dataKey || comp.props.yKey || 'value']
            };
          }
        });
      }

      await apiClient.exportDocument({
        format,
        title: reportTitle,
        subtitle: reportSubtitle,
        summary: summary || undefined,
        kpis,
        tables,
        recommendations,
        sources: citations,
        canvas: canvas || undefined,
        chart_config: chartConfig
      });

      setExportStatus({
        type: 'success',
        message: `Successfully generated and downloaded ${format.toUpperCase()} file.`
      });
      setTimeout(() => setExportStatus(null), 4000);
      setIsOpen(false);
    } catch (err: any) {
      console.error('Export error', err);
      setExportStatus({
        type: 'error',
        message: `Failed to export ${format.toUpperCase()}: ${err.message || 'Server error'}`
      });
    } finally {
      setExportingFormat(null);
    }
  };

  const exportFormats = [
    {
      format: 'pdf' as const,
      label: 'PDF Document (.pdf)',
      desc: 'Polished print-ready report with KPIs and tables',
      icon: FileCheck,
      color: 'text-rose-600 bg-rose-50'
    },
    {
      format: 'pptx' as const,
      label: 'PowerPoint Slides (.pptx)',
      desc: 'Editable presentation with summaries and metrics',
      icon: Presentation,
      color: 'text-amber-600 bg-amber-50'
    },
    {
      format: 'docx' as const,
      label: 'Word Document (.docx)',
      desc: 'Structured report with headings & references',
      icon: FileText,
      color: 'text-blue-600 bg-blue-50'
    },
    {
      format: 'xlsx' as const,
      label: 'Excel Spreadsheet (.xlsx)',
      desc: 'Multi-worksheet workbook with tables & formulas',
      icon: FileSpreadsheet,
      color: 'text-emerald-600 bg-emerald-50'
    },
    {
      format: 'png' as const,
      label: 'Chart Image (.png)',
      desc: 'High-resolution PNG of canvas visualizations',
      icon: ImageIcon,
      color: 'text-purple-600 bg-purple-50'
    }
  ];

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={!!exportingFormat}
        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
        title="Export dynamic canvas in multiple verified file formats"
      >
        {exportingFormat ? (
          <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5 text-slate-600" />
        )}
        <span>{exportingFormat ? `Exporting ${exportingFormat.toUpperCase()}...` : 'Export Canvas'}</span>
      </button>

      {/* Export status notification */}
      {exportStatus && (
        <div
          className={`absolute right-0 mt-2 z-50 p-2.5 rounded-lg border text-xs shadow-lg flex items-center space-x-2 w-72 animate-in fade-in slide-in-from-top-2 duration-150 ${
            exportStatus.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {exportStatus.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="leading-tight">{exportStatus.message}</span>
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200/90 z-50 py-2 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Multi-Format Workspace Export
              </span>
              <span className="text-[10px] text-slate-400">Verifiable data</span>
            </div>

            <div className="p-1 space-y-0.5">
              {exportFormats.map((item) => {
                const IconComponent = item.icon;
                const isItemLoading = exportingFormat === item.format;
                return (
                  <button
                    key={item.format}
                    onClick={() => handleExport(item.format)}
                    disabled={!!exportingFormat}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-start space-x-2.5 cursor-pointer disabled:opacity-50"
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${item.color}`}>
                      {isItemLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      ) : (
                        <IconComponent className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 flex items-center">
                        {item.label}
                        {isItemLoading && (
                          <span className="ml-2 text-[10px] text-blue-600 font-medium">Building...</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 leading-snug">{item.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
