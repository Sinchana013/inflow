import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  TrendingUp,
  Package,
  AlertTriangle,
  RotateCcw,
  Calendar,
  ArrowRight,
  Clock,
  ChevronRight,
  Loader2
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { apiClient } from '../../api/client';
import { DashboardSummary, RevenueTrendPoint } from '../../types';
import { KPICard } from '../../components/KPICard';
import { StatusBadge } from '../../components/Badge';
import { AskAIButton } from '../../components/AskAIButton';

const CATEGORY_COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

export const DashboardPage: React.FC = () => {
  const [days, setDays] = useState<number>(30);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trend, setTrend] = useState<RevenueTrendPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const navigate = useNavigate();

  const fetchData = async (selectedDays: number) => {
    try {
      setLoading(true);
      const [sumData, trendData] = await Promise.all([
        apiClient.getDashboardSummary(selectedDays),
        apiClient.getRevenueTrend(selectedDays)
      ]);
      setSummary(sumData);
      setTrend(trendData);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(days);
  }, [days]);

  // Listen for live data updates from AI Assistant actions
  useEffect(() => {
    const handleDataRefresh = () => {
      fetchData(days);
    };
    window.addEventListener('insightflow-refresh-data', handleDataRefresh);
    return () => {
      window.removeEventListener('insightflow-refresh-data', handleDataRefresh);
    };
  }, [days]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(days);
  };

  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-slate-500">Loading executive analytics...</p>
      </div>
    );
  }

  // Derive category data from top selling products or fallback
  const categoryData = summary?.top_selling_products.reduce((acc: any[], p) => {
    const existing = acc.find(item => item.name === p.category);
    if (existing) {
      existing.value += p.revenue;
    } else {
      acc.push({ name: p.category, value: p.revenue });
    }
    return acc;
  }, []) || [];

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Overview</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time cross-application business health, sales momentum, and inventory risks.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Date Range Selector */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="text-xs font-medium text-slate-700 bg-transparent pr-2 py-1 focus:outline-none cursor-pointer"
            >
              <option value={14}>Last 14 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={60}>Last 60 Days</option>
              <option value={90}>Last 90 Days</option>
              <option value={180}>Last 180 Days</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium shadow-2xs transition-colors cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      {summary && (
        <div id="dashboard-kpis" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div id="kpi-total-sales">
            <KPICard
              data={summary.total_sales}
              icon={<DollarSign className="w-4 h-4 text-blue-600" />}
              onClick={() => navigate('/sales')}
            />
          </div>
          <div id="kpi-revenue-growth">
            <KPICard
              data={summary.revenue_growth}
              icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
              onClick={() => navigate('/reports')}
            />
          </div>
          <div id="kpi-units-sold">
            <KPICard
              data={summary.units_sold}
              icon={<Package className="w-4 h-4 text-indigo-600" />}
              onClick={() => navigate('/products')}
            />
          </div>
          <div id="kpi-low-stock">
            <KPICard
              data={summary.low_stock_products}
              icon={<AlertTriangle className="w-4 h-4 text-rose-600" />}
              onClick={() => navigate('/inventory')}
            />
          </div>
        </div>
      )}

      {/* Charts Section: Revenue over time & Sales by category */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Line Chart */}
        <div id="chart-revenue-trend" className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-semibold text-slate-900">Revenue Over Time</h2>
                <AskAIButton
                  objectContext={{
                    type: 'chart',
                    title: `Revenue Trend (${days} Days)`,
                    route: '/dashboard',
                    data: {
                      period_days: days,
                      trend_points: trend.slice(-10),
                      total_sales_val: summary?.total_sales.value
                    }
                  }}
                  prompt={`Analyze this ${days}-day revenue trajectory. Identify any anomalies, mid-month drop-offs, and revenue momentum patterns.`}
                  size="xs"
                  label="Ask AI"
                />
              </div>
              <p className="text-xs text-slate-500">Gross completed sales trend ({days} day window)</p>
            </div>
            <button
              onClick={() => navigate('/sales')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1 cursor-pointer"
            >
              <span>Sales details</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Share Donut */}
        <div id="chart-category-share" className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-semibold text-slate-900">Sales by Category</h2>
                <AskAIButton
                  objectContext={{
                    type: 'chart',
                    title: 'Sales by Category Breakdown',
                    route: '/dashboard',
                    data: {
                      period_days: days,
                      categories: categoryData
                    }
                  }}
                  prompt="Analyze this category sales breakdown. Which categories dominate revenue and which present margin expansion opportunities?"
                  size="xs"
                  label="Ask AI"
                />
              </div>
              <p className="text-xs text-slate-500">Top category distribution</p>
            </div>
            <button
              onClick={() => navigate('/products')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1 cursor-pointer"
            >
              <span>Catalogue</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-48 w-full flex items-center justify-center my-auto">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400">No completed category sales in selected period.</p>
            )}
          </div>

          <div className="space-y-1.5 mt-2 border-t border-slate-100 pt-3">
            {categoryData.slice(0, 4).map((c, i) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}></div>
                  <span className="text-slate-600 truncate max-w-[120px]">{c.name}</span>
                </div>
                <span className="font-semibold text-slate-900">${c.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tables Section: Top Selling Products & Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top-Selling Products */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Top-Selling Products</h2>
              <p className="text-xs text-slate-500">Ranked by revenue in selected window</p>
            </div>
            <button
              onClick={() => navigate('/products')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1 cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-medium">
                  <th className="pb-2.5 font-medium">Product</th>
                  <th className="pb-2.5 font-medium">Category</th>
                  <th className="pb-2.5 font-medium text-right">Units</th>
                  <th className="pb-2.5 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {summary?.top_selling_products.map((p) => (
                  <tr
                    key={p.product_id}
                    id={`dashboard-top-product-${p.product_id}`}
                    data-source-id={`product-${p.product_id}`}
                    onClick={() => navigate(`/products?highlight=${p.product_id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 font-medium text-slate-900 max-w-[180px]">
                      <div className="flex items-center space-x-1">
                        <span className="truncate">{p.product_name}</span>
                        <AskAIButton
                          objectContext={{
                            type: 'product',
                            id: p.product_id,
                            title: p.product_name,
                            route: `/products?highlight=${p.product_id}`,
                            data: p
                          }}
                          prompt={`Analyze top-selling product "${p.product_name}". What are its revenue momentum, margins, and stock status?`}
                          variant="icon"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 text-slate-500">{p.category}</td>
                    <td className="py-2.5 text-slate-700 text-right font-medium">{p.units_sold}</td>
                    <td className="py-2.5 text-slate-900 text-right font-semibold">{p.formatted_revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Sales Table */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Recent Transactions</h2>
              <p className="text-xs text-slate-500">Latest orders placed across channels</p>
            </div>
            <button
              onClick={() => navigate('/sales')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1 cursor-pointer"
            >
              <span>All orders</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-medium">
                  <th className="pb-2.5 font-medium">Order ID</th>
                  <th className="pb-2.5 font-medium">Customer</th>
                  <th className="pb-2.5 font-medium">Amount</th>
                  <th className="pb-2.5 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {summary?.recent_sales.slice(0, 5).map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => navigate(`/sales?order_id=${o.id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 font-mono text-blue-600 font-medium">#{o.id}</td>
                    <td className="py-2.5 text-slate-900 font-medium truncate max-w-[130px]">{o.customer_name}</td>
                    <td className="py-2.5 text-slate-900 font-semibold">${o.total_amount.toFixed(2)}</td>
                    <td className="py-2.5 text-right">
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Section: Low-stock alerts & Recent business activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low-Stock Alerts */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-900">Low-Stock Alerts</h2>
            </div>
            <button
              onClick={() => navigate('/inventory')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Inventory
            </button>
          </div>

          <div className="space-y-2.5">
            {summary?.low_stock_alerts.slice(0, 4).map((a) => (
              <div
                key={a.product_id}
                onClick={() => navigate(`/inventory?highlight=${a.product_id}`)}
                className="p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="font-medium text-xs text-slate-900 truncate max-w-[160px]">{a.product_name}</div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                    a.urgency === 'Critical' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {a.stock_status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                  <span>Stock: <strong>{a.current_stock}</strong> units</span>
                  <span>Threshold: {a.reorder_threshold}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Business Activity Feed */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-1.5">
              <Clock className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Recent Business Activity</h2>
            </div>
            <span className="text-xs text-slate-400">Live system audit trail</span>
          </div>

          <div className="space-y-3">
            {summary?.recent_activities.slice(0, 5).map((act) => (
              <div key={act.id} className="flex items-start space-x-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                <div className="flex-1">
                  <p className="text-slate-800 font-medium">{act.description}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {new Date(act.created_at).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
