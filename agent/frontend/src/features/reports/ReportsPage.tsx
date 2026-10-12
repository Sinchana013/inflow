import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileBarChart2,
  Download,
  AlertTriangle,
  TrendingUp,
  Info,
  Calendar,
  Layers,
  MapPin,
  Boxes,
  Users,
  ArrowRight,
  ExternalLink,
  Loader2
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { apiClient } from '../../api/client';
import { ReportSummary, CrossModuleInsight } from '../../types';
import { KPICard } from '../../components/KPICard';
import { AskAIButton } from '../../components/AskAIButton';

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();

  // Active Report Tab: 'monthly_revenue' | 'category_region' | 'product_performance' | 'sales_inventory'
  const [activeReportKey, setActiveReportKey] = useState<string>('monthly_revenue');
  const [reportData, setReportData] = useState<ReportSummary | null>(null);
  const [insights, setInsights] = useState<CrossModuleInsight[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const reportTabs = [
    { key: 'monthly_revenue', title: 'Monthly Revenue', icon: TrendingUp },
    { key: 'category_region', title: 'Category & Region', icon: MapPin },
    { key: 'product_performance', title: 'Top & Declining SKUs', icon: Layers },
    { key: 'sales_inventory', title: 'Sales vs Inventory', icon: Boxes },
  ];

  const loadReport = async (key: string) => {
    try {
      setLoading(true);
      let data: ReportSummary;
      switch (key) {
        case 'category_region':
          data = await apiClient.getCategoryPerformanceReport();
          break;
        case 'product_performance':
          data = await apiClient.getProductPerformanceReport();
          break;
        case 'sales_inventory':
          data = await apiClient.getSalesInventoryReport();
          break;
        case 'monthly_revenue':
        default:
          data = await apiClient.getMonthlyRevenueReport();
          break;
      }
      setReportData(data);
    } catch (err) {
      console.error('Failed to load report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(activeReportKey);
  }, [activeReportKey]);

  useEffect(() => {
    apiClient.getCrossModuleInsights().then(setInsights).catch(console.error);
  }, []);

  const handleExportCSV = () => {
    if (!reportData || !reportData.data.length) return;
    const headers = Object.keys(reportData.data[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of reportData.data) {
      const values = headers.map(header => {
        const val = row[header] ?? '';
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insightflow_${reportData.id}_report.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Business Reports & Cross-Module Intelligence</h1>
          <p className="text-xs text-slate-500 mt-1">
            Predefined auditable reports with deterministic formula definitions and database cross-correlations.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={!reportData}
          className="inline-flex items-center space-x-2 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium shadow-2xs transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Export Report Data</span>
        </button>
      </div>

      {/* Cross-Module Real Insights Section */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Cross-Module Diagnostic Insights</h2>
          </div>
          <span className="text-[11px] font-medium text-slate-400">Deterministic SQL calculations</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
          {insights.map((ins) => (
            <div
              key={ins.id}
              id={`insight-card-${ins.id}`}
              data-source-id={`insight-${ins.id}`}
              className={`p-4 rounded-xl border text-xs flex flex-col justify-between transition-all ${
                ins.severity === 'high'
                  ? 'bg-rose-50/50 border-rose-200 text-rose-950'
                  : ins.severity === 'warning'
                  ? 'bg-amber-50/50 border-amber-200 text-amber-950'
                  : ins.severity === 'positive'
                  ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                  : 'bg-blue-50/50 border-blue-200 text-blue-950'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs">{ins.title}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                    ins.severity === 'high'
                      ? 'bg-rose-100 text-rose-800'
                      : ins.severity === 'warning'
                      ? 'bg-amber-100 text-amber-800'
                      : ins.severity === 'positive'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {ins.type.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-slate-700 leading-relaxed text-[11px] mt-1">{ins.description}</p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200/40 flex items-center justify-between">
                <AskAIButton
                  objectContext={{
                    type: 'report',
                    id: ins.id,
                    title: `Diagnostic Insight: ${ins.title}`,
                    route: '/reports',
                    data: {
                      id: ins.id,
                      title: ins.title,
                      type: ins.type,
                      severity: ins.severity,
                      description: ins.description,
                      target_route: ins.target_route,
                      target_id: ins.target_id
                    }
                  }}
                  prompt={`Analyze cross-module diagnostic insight: "${ins.title}". Explanation: "${ins.description}". What root cause drives this pattern and what is the optimal corrective action?`}
                  variant="chip"
                  label="Ask AI"
                />
                <button
                  onClick={() => {
                    const target = ins.target_id ? `${ins.target_route}?highlight=${ins.target_id}` : ins.target_route;
                    navigate(target);
                  }}
                  className="font-semibold text-[11px] flex items-center space-x-1 hover:underline text-blue-700 cursor-pointer"
                >
                  <span>Investigate in {ins.target_route.replace('/', '')}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Report Selection Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {reportTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReportKey === tab.key;
          return (
            <button
              key={tab.key}
              id={`report-tab-${tab.key}`}
              data-source-id={`report-${tab.key}`}
              onClick={() => setActiveReportKey(tab.key)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.title}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Report Content */}
      {loading || !reportData ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2 text-blue-600" />
          Computing report dataset...
        </div>
      ) : (
        <div id={`report-content-${activeReportKey}`} className="space-y-6">
          {/* Report Description and Metric Cards */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">{reportData.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{reportData.description}</p>
              </div>
              <AskAIButton
                objectContext={{
                  type: 'report',
                  title: reportData.title,
                  route: '/reports',
                  data: {
                    report_title: reportData.title,
                    description: reportData.description,
                    kpi_summary: reportData.kpis.map((k) => `${k.title}: ${k.formatted_value || k.value}`),
                    row_count: reportData.data?.length || 0
                  }
                }}
                prompt={`Analyze the "${reportData.title}" report dataset. What are the key business findings, high-leverage bottlenecks, and executive decisions needed?`}
                label="Ask AI about this report"
                size="sm"
              />
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {reportData.kpis.map((kpi, idx) => (
                <KPICard key={idx} data={kpi} />
              ))}
            </div>
          </div>

          {/* Interactive Chart for Monthly Revenue or Product Performance */}
          {activeReportKey === 'monthly_revenue' && (
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">6-Month Revenue & Gross Profit Progression</h3>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    />
                    <Tooltip
                      formatter={(v: any) => [`$${Number(v).toLocaleString()}`, '']}
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Bar dataKey="revenue" name="Revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="gross_profit" name="Gross Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Report Data Table */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Report Dataset</h3>
              <span className="text-xs text-slate-400">{reportData.data.length} records evaluated</span>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold sticky top-0">
                  <tr>
                    {Object.keys(reportData.data[0] || {}).map((colKey) => (
                      <th key={colKey} className="py-2.5 px-3 uppercase tracking-wider font-semibold">
                        {colKey.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.data.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50">
                      {Object.keys(reportData.data[0] || {}).map((colKey) => (
                        <td key={colKey} className="py-2.5 px-3 text-slate-700">
                          {typeof row[colKey] === 'number'
                            ? (colKey.includes('margin') || colKey.includes('percent')
                              ? `${row[colKey]}%`
                              : colKey.includes('revenue') || colKey.includes('profit') || colKey.includes('value') || colKey.includes('total')
                              ? `$${row[colKey].toLocaleString()}`
                              : row[colKey])
                            : row[colKey]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Metric Definitions & Methodology */}
          <div className="bg-slate-100/60 rounded-xl p-4 border border-slate-200 text-xs">
            <div className="flex items-center space-x-1.5 text-slate-800 font-semibold mb-2">
              <Info className="w-4 h-4 text-slate-500" />
              <span>Calculation Definitions & Mathematical Rules</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
              {Object.entries(reportData.definitions).map(([term, def]) => (
                <div key={term}>
                  <strong className="text-slate-800">{term}:</strong> {def}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
