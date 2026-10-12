import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ExternalLink,
  AlertTriangle,
  Info,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Search,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LabelList
} from 'recharts';
import { CanvasSpecification, CanvasComponent, CitationSource } from '../../types';
import { KPICard } from '../../components/KPICard';
import { CanvasExportMenu } from '../../components/CanvasExportMenu';
import { AskAIButton } from '../../components/AskAIButton';

interface CanvasRendererProps {
  canvas: CanvasSpecification;
  query?: string;
  summary?: string;
  citations?: CitationSource[];
  showExportMenu?: boolean;
}

const PALETTE = ['#2563eb', '#38bdf8', '#818cf8', '#a855f7', '#10b981'];

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  canvas,
  summary,
  citations = [],
  showExportMenu = true
}) => {
  const navigate = useNavigate();
  const [tableSearch, setTableSearch] = useState<Record<string, string>>({});

  // Validate canvas components
  if (!canvas || !Array.isArray(canvas.components)) {
    return (
      <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
        Invalid canvas specification provided.
      </div>
    );
  }

  const renderComponent = (comp: CanvasComponent) => {
    switch (comp.type) {
      case 'kpi_card': {
        const p = comp.props;
        const kpiTitle = p.title || comp.title || 'Metric';
        return (
          <div className="relative group">
            <KPICard
              data={{
                title: kpiTitle,
                value: p.value || p.formatted_value || '0',
                formatted_value: p.formatted_value || String(p.value || '0'),
                trend: p.trend || 'neutral',
                period_label: p.period_label || '',
                change_percentage: p.change_percentage
              }}
            />
            <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <AskAIButton
                objectContext={{
                  type: 'kpi',
                  title: kpiTitle,
                  fields: p,
                  route: window.location.pathname
                }}
                variant="icon"
                prompt={`Why has the metric "${kpiTitle}" reached ${p.formatted_value || p.value}? Analyze causes.`}
              />
            </div>
          </div>
        );
      }

      case 'insight_card': {
        const p = comp.props;
        const sev = p.severity || 'info';
        const rawTitle = p.title || comp.title || 'Insight Finding';

        // Detect hypothesis status badges
        let badge: { label: string; bg: string; text: string } | null = null;
        let cleanTitle = rawTitle;

        if (rawTitle.startsWith('[SUPPORTED]')) {
          badge = { label: 'SUPPORTED', bg: 'bg-emerald-100 border-emerald-200', text: 'text-emerald-800' };
          cleanTitle = rawTitle.replace('[SUPPORTED]', '').trim();
        } else if (rawTitle.startsWith('[REFUTED]')) {
          badge = { label: 'REFUTED', bg: 'bg-rose-100 border-rose-200', text: 'text-rose-800' };
          cleanTitle = rawTitle.replace('[REFUTED]', '').trim();
        } else if (rawTitle.startsWith('[INCONCLUSIVE]')) {
          badge = { label: 'INCONCLUSIVE', bg: 'bg-slate-100 border-slate-200', text: 'text-slate-700' };
          cleanTitle = rawTitle.replace('[INCONCLUSIVE]', '').trim();
        }

        return (
          <div
            className={`p-4 rounded-xl border text-xs transition-shadow ${
              badge?.label === 'SUPPORTED'
                ? 'bg-emerald-50/60 border-emerald-200/80 text-emerald-950'
                : badge?.label === 'REFUTED'
                ? 'bg-slate-50/70 border-slate-200 text-slate-800'
                : sev === 'high'
                ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                : sev === 'warning'
                ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                : 'bg-blue-50/80 border-blue-200 text-blue-950'
            }`}
          >
            <div className="flex items-center justify-between font-bold mb-1.5 gap-2">
              <div className="flex items-center space-x-2 min-w-0">
                {badge ? (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide border ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                ) : sev === 'high' || sev === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                )}
                <span className="truncate">{cleanTitle}</span>
              </div>
              <AskAIButton
                objectContext={{
                  type: 'report',
                  title: cleanTitle,
                  fields: { description: p.description, severity: sev },
                  route: window.location.pathname
                }}
                variant="badge"
                label="Ask AI"
                prompt={`Explain this finding: "${cleanTitle}". What actions should be prioritized?`}
              />
            </div>
            <p className="leading-relaxed text-slate-700 whitespace-pre-line mt-1">{p.description}</p>
          </div>
        );
      }

      case 'bar_chart':
      case 'horizontal_bar_chart': {
        const p = comp.props;
        const dataKey = p.dataKey || 'value';
        const categoryKey = p.categoryKey || 'category';
        const data = p.data || [];
        const isHorizontal = Boolean(p.is_horizontal || comp.type === 'horizontal_bar_chart');

        return (
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs relative group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{comp.title}</h3>
                {p.why_this_chart && (
                  <span
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/80 cursor-help transition-colors select-none"
                    title={`Why this chart: ${p.why_this_chart}`}
                  >
                    <Info className="w-3 h-3 text-slate-400" />
                    <span>Why this chart</span>
                  </span>
                )}
              </div>
              <AskAIButton
                objectContext={{
                  type: 'chart',
                  title: comp.title || 'Bar Chart',
                  underlying_data: data,
                  route: window.location.pathname
                }}
                variant="chip"
                label="Ask AI about chart"
                prompt={`Find trends and anomalies in this chart: "${comp.title}"`}
              />
            </div>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {isHorizontal ? (
                  <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                    />
                    <YAxis
                      dataKey={categoryKey}
                      type="category"
                      width={110}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v: any) => [`$${Number(v).toLocaleString()}`, '']}
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px' }}
                    />
                    <Bar dataKey={dataKey} fill="#2563eb" radius={[0, 4, 4, 0]}>
                      <LabelList
                        dataKey={dataKey}
                        position="right"
                        fontSize={10}
                        fill="#475569"
                        formatter={(v: any) => (typeof v === 'number' && v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                      />
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey={categoryKey} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                    />
                    <Tooltip
                      formatter={(v: any) => [`$${Number(v).toLocaleString()}`, '']}
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px' }}
                    />
                    <Bar dataKey={dataKey} fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            {p.why_this_chart && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 italic flex items-center space-x-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span><strong>Why this chart:</strong> {p.why_this_chart}</span>
              </div>
            )}
          </div>
        );
      }

      case 'line_chart': {
        const p = comp.props;
        const dataKey = p.dataKey || 'value';
        const xKey = p.xKey || p.categoryKey || 'period';
        const data = p.data || [];

        return (
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs relative group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{comp.title}</h3>
                {p.why_this_chart && (
                  <span
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/80 cursor-help transition-colors select-none"
                    title={`Why this chart: ${p.why_this_chart}`}
                  >
                    <Info className="w-3 h-3 text-slate-400" />
                    <span>Why this chart</span>
                  </span>
                )}
              </div>
              <AskAIButton
                objectContext={{
                  type: 'chart',
                  title: comp.title || 'Trend Chart',
                  underlying_data: data,
                  route: window.location.pathname
                }}
                variant="chip"
                label="Ask AI about trend"
                prompt={`Analyze the momentum shift and rate of change in this trend: "${comp.title}"`}
              />
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                  />
                  <Tooltip
                    formatter={(v: any) => [`$${Number(v).toLocaleString()}`, '']}
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px' }}
                  />
                  <Line type="monotone" dataKey={dataKey} stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3, fill: '#2563eb' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {p.why_this_chart && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 italic flex items-center space-x-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span><strong>Why this chart:</strong> {p.why_this_chart}</span>
              </div>
            )}
          </div>
        );
      }

      case 'area_chart': {
        const p = comp.props;
        const dataKey = p.dataKey || 'value';
        const xKey = p.xKey || p.categoryKey || 'period';
        const data = p.data || [];

        return (
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs relative group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{comp.title}</h3>
                {p.why_this_chart && (
                  <span
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/80 cursor-help transition-colors select-none"
                    title={`Why this chart: ${p.why_this_chart}`}
                  >
                    <Info className="w-3 h-3 text-slate-400" />
                    <span>Why this chart</span>
                  </span>
                )}
              </div>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                  />
                  <Tooltip
                    formatter={(v: any) => [`$${Number(v).toLocaleString()}`, '']}
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey={dataKey} stroke="#2563eb" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {p.why_this_chart && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 italic flex items-center space-x-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span><strong>Why this chart:</strong> {p.why_this_chart}</span>
              </div>
            )}
          </div>
        );
      }

      case 'donut_chart':
      case 'pie_chart': {
        const p = comp.props;
        const dataKey = p.dataKey || 'value';
        const nameKey = p.nameKey || p.categoryKey || 'name';
        const data = p.data || [];
        const isDonut = comp.type === 'donut_chart';

        return (
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{comp.title}</h3>
                {p.why_this_chart && (
                  <span
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/80 cursor-help transition-colors select-none"
                    title={`Why this chart: ${p.why_this_chart}`}
                  >
                    <Info className="w-3 h-3 text-slate-400" />
                    <span>Why this chart</span>
                  </span>
                )}
              </div>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={isDonut ? 50 : 0}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey={dataKey}
                    nameKey={nameKey}
                  >
                    {data.map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => [`$${Number(v).toLocaleString()}`, '']}
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {p.why_this_chart && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 italic flex items-center space-x-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span><strong>Why this chart:</strong> {p.why_this_chart}</span>
              </div>
            )}
          </div>
        );
      }

      case 'scatter_chart': {
        const p = comp.props;
        const xKey = p.xKey || 'price';
        const yKey = p.yKey || 'units_sold';
        const data = p.data || [];

        return (
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs relative group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{comp.title}</h3>
                {p.why_this_chart && (
                  <span
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/80 cursor-help transition-colors select-none"
                    title={`Why this chart: ${p.why_this_chart}`}
                  >
                    <Info className="w-3 h-3 text-slate-400" />
                    <span>Why this chart</span>
                  </span>
                )}
              </div>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey={xKey} name={p.xAxisLabel || 'Price'} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey={yKey} name={p.yAxisLabel || 'Units'} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px' }}
                  />
                  <Scatter name="Products" data={data} fill="#2563eb" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            {p.why_this_chart && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 italic flex items-center space-x-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span><strong>Why this chart:</strong> {p.why_this_chart}</span>
              </div>
            )}
          </div>
        );
      }

      case 'heatmap': {
        const p = comp.props;
        const data = p.data || [];

        return (
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{comp.title}</h3>
                {p.why_this_chart && (
                  <span
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/80 cursor-help transition-colors select-none"
                    title={`Why this chart: ${p.why_this_chart}`}
                  >
                    <Info className="w-3 h-3 text-slate-400" />
                    <span>Why this chart</span>
                  </span>
                )}
              </div>
            </div>
            <div className="overflow-x-auto py-2">
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {data.slice(0, 18).map((item: any, idx: number) => {
                  const val = item.value || item.sales || item.revenue || 0;
                  const intensity = Math.min(100, Math.max(10, Math.round(Number(val) / 500) * 10));
                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-slate-200 text-center transition-transform hover:scale-105"
                      style={{ backgroundColor: `rgba(37, 99, 235, ${0.1 + (intensity / 100) * 0.7})` }}
                    >
                      <div className="text-[10px] font-medium text-slate-700 truncate">{item.name || item.product || item.month || `Cell ${idx+1}`}</div>
                      <div className="text-xs font-bold text-slate-900 mt-1">${Number(val).toLocaleString()}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {p.why_this_chart && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 italic flex items-center space-x-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span><strong>Why this chart:</strong> {p.why_this_chart}</span>
              </div>
            )}
          </div>
        );
      }

      case 'data_table': {
        const p = comp.props;
        const columns = p.columns || [];
        const rawData = p.data || [];
        const searchVal = (tableSearch[comp.id] || '').toLowerCase().trim();

        const filteredData = searchVal
          ? rawData.filter((row: any) =>
              columns.some((col: any) =>
                String(row[col.key] || '')
                  .toLowerCase()
                  .includes(searchVal)
              )
            )
          : rawData;

        return (
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{comp.title}</h3>
                <span className="text-[10px] text-slate-500 font-medium px-1.5 py-0.2 rounded bg-slate-100">
                  {filteredData.length} records
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                  <input
                    type="text"
                    placeholder="Filter records..."
                    value={tableSearch[comp.id] || ''}
                    onChange={(e) =>
                      setTableSearch((prev) => ({
                        ...prev,
                        [comp.id]: e.target.value
                      }))
                    }
                    className="text-[11px] pl-6 pr-2 py-1 rounded-md border border-slate-200 focus:outline-hidden focus:border-blue-400 w-36"
                  />
                </div>
                <AskAIButton
                  objectContext={{
                    type: 'report',
                    title: comp.title || 'Data Table',
                    underlying_data: filteredData.slice(0, 20),
                    route: window.location.pathname
                  }}
                  variant="chip"
                  label="Analyze table"
                  prompt={`Analyze patterns and anomalies in the records of "${comp.title}"`}
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-72 border border-slate-100 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0">
                  <tr>
                    {columns.map((col: any) => (
                      <th key={col.key} className="py-2 px-3 text-[11px]">
                        {col.label}
                      </th>
                    ))}
                    <th className="py-2 px-3 text-[11px] text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.map((row: any, rIdx: number) => (
                    <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                      {columns.map((col: any) => (
                        <td key={col.key} className="py-2 px-3 text-slate-700 text-[11px]">
                          {row[col.key]}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right">
                        <AskAIButton
                          objectContext={{
                            type: 'product',
                            id: row.id || rIdx + 1,
                            title: row.name || row.customer_name || `Record #${row.id || rIdx + 1}`,
                            data: row,
                            fields: row,
                            route: window.location.pathname
                          }}
                          variant="chip"
                          size="xs"
                          label="Ask AI"
                          prompt={`Analyze and explain this record: "${row.name || row.customer_name || `Record #${row.id || rIdx + 1}`}"`}
                        />
                      </td>
                    </tr>
                  ))}
                  {filteredData.length === 0 && (
                    <tr>
                      <td colSpan={columns.length + 1} className="py-6 text-center text-slate-400 text-xs">
                        No matching entries found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case 'action_button': {
        const p = comp.props;
        return (
          <button
            onClick={() => p.route && navigate(p.route)}
            className={`w-full py-2.5 px-4 rounded-xl font-medium text-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer ${
              p.variant === 'primary'
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
            }`}
          >
            <span>{p.label || comp.title}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        );
      }

      case 'detail_link': {
        const p = comp.props;
        return (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
            <span className="text-slate-700 font-medium">{p.label || comp.title}</span>
            <button
              onClick={() => p.route && navigate(p.route)}
              className="text-blue-600 font-semibold flex items-center space-x-1 hover:underline cursor-pointer"
            >
              <span>Inspect</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        );
      }

      default:
        return (
          <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-500">
            Unsupported canvas component: {comp.type}
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Title Bar with Integrated Multi-Format Export Menu */}
      <div className="border-b border-slate-200/90 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>{canvas.title}</span>
          </h2>
          {canvas.subtitle && <p className="text-xs text-slate-500 mt-0.5">{canvas.subtitle}</p>}
        </div>

        {showExportMenu && (
          <CanvasExportMenu
            canvas={canvas}
            title={canvas.title}
            subtitle={canvas.subtitle}
            summary={summary}
            citations={citations}
          />
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {canvas.components.map((comp) => {
          const colSpan = comp.layout?.colSpan || 12;
          const colClass = {
            1: 'col-span-1',
            2: 'col-span-2',
            3: 'col-span-12 sm:col-span-6 lg:col-span-3',
            4: 'col-span-12 sm:col-span-6 lg:col-span-4',
            6: 'col-span-12 lg:col-span-6',
            8: 'col-span-12 lg:col-span-8',
            12: 'col-span-12',
          }[colSpan] || 'col-span-12';

          return (
            <div key={comp.id} className={colClass}>
              {renderComponent(comp)}
            </div>
          );
        })}
      </div>
    </div>
  );
};
