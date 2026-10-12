import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  MapPin,
  Globe,
  Loader2,
  Calendar
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { apiClient } from '../../api/client';
import { Order, SalesAnalytics } from '../../types';
import { KPICard } from '../../components/KPICard';
import { StatusBadge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { AskAIButton } from '../../components/AskAIButton';

const REGION_COLORS = ['#2563eb', '#38bdf8', '#818cf8', '#a855f7'];

export const SalesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // State
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalOrdersCount, setTotalOrdersCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [pageSize] = useState<number>(50);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('order_date');
  const [sortOrder, setSortOrder] = useState<string>('desc');

  // Analytics & Detail Modal
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalLoading, setModalLoading] = useState<boolean>(false);

  // Check URL query parameters (e.g. from global search, AI navigation, or dashboard links)
  useEffect(() => {
    const orderIdParam = searchParams.get('order_id');
    const highlightParam = searchParams.get('highlight');
    const openModal = searchParams.get('modal') === 'true';

    if (orderIdParam) {
      if (openModal) {
        loadOrderDetail(Number(orderIdParam));
      } else {
        setSearch(orderIdParam);
      }
    } else if (highlightParam) {
      setSearch(highlightParam);
    }
    const statusParam = searchParams.get('status');
    if (statusParam) setStatusFilter(statusParam);
    const regionParam = searchParams.get('region');
    if (regionParam) setRegionFilter(regionParam);
  }, [searchParams]);

  const loadOrderDetail = async (orderId: number) => {
    try {
      setModalLoading(true);
      const detail = await apiClient.getOrderDetail(orderId);
      setSelectedOrder(detail);
    } catch (err) {
      console.error('Failed to load order detail', err);
    } finally {
      setModalLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (regionFilter) params.region = regionFilter;
      if (channelFilter) params.channel = channelFilter;

      const [salesData, analyticsData] = await Promise.all([
        apiClient.getSales(params),
        apiClient.getSalesAnalytics({
          status: statusFilter || undefined,
          region: regionFilter || undefined,
          channel: channelFilter || undefined
        })
      ]);

      setOrders(salesData.items || []);
      setTotalOrdersCount(salesData.total || 0);
      setTotalPages(salesData.total_pages || 1);
      setAnalytics(analyticsData);
    } catch (err) {
      console.error('Error fetching sales', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, search, statusFilter, regionFilter, channelFilter, sortBy, sortOrder]);

  // Listen for live data updates from AI Assistant actions
  useEffect(() => {
    const handleDataRefresh = () => {
      fetchOrders();
    };
    window.addEventListener('insightflow-refresh-data', handleDataRefresh);
    return () => {
      window.removeEventListener('insightflow-refresh-data', handleDataRefresh);
    };
  }, [page, pageSize, sortBy, sortOrder, search, statusFilter, regionFilter, channelFilter]);

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (search.trim()) params.append('search', search.trim());
    if (statusFilter) params.append('status', statusFilter);
    if (regionFilter) params.append('region', regionFilter);
    if (channelFilter) params.append('channel', channelFilter);
    params.append('export_csv', 'true');

    window.open(`/api/sales?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sales Management & Analytics</h1>
          <p className="text-xs text-slate-500 mt-1">
            Order lifecycle, sales channel metrics, multi-regional revenue analysis, and transaction history.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center space-x-2 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium shadow-2xs transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Export Filtered CSV</span>
        </button>
      </div>

      {/* KPI Cards */}
      {analytics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard
            data={{
              title: 'Total Filtered Revenue',
              value: analytics.total_revenue,
              formatted_value: `$${analytics.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              period_label: 'Completed orders only',
              trend: 'up'
            }}
            icon={<DollarSign className="w-4 h-4 text-blue-600" />}
          />
          <KPICard
            data={{
              title: 'Total Transactions',
              value: analytics.total_orders,
              formatted_value: analytics.total_orders.toLocaleString(),
              period_label: 'All status types',
              trend: 'neutral'
            }}
            icon={<ShoppingCart className="w-4 h-4 text-emerald-600" />}
          />
          <KPICard
            data={{
              title: 'Average Order Value (AOV)',
              value: analytics.average_order_value,
              formatted_value: `$${analytics.average_order_value.toFixed(2)}`,
              period_label: 'Per completed order',
              trend: 'up'
            }}
            icon={<TrendingUp className="w-4 h-4 text-indigo-600" />}
          />
        </div>
      )}

      {/* Analytics Visualizations: Category, Region & Channel */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales by Category */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center mb-1">
              <Layers className="w-4 h-4 text-blue-600 mr-1.5" /> Sales by Category
            </h2>
            <p className="text-xs text-slate-500 mb-3">Completed revenue per category</p>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.by_category} layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: '#334155' }} width={85} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Revenue']}
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px' }}
                  />
                  <Bar dataKey="revenue" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sales by Region */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center mb-1">
              <MapPin className="w-4 h-4 text-emerald-600 mr-1.5" /> Sales by Region
            </h2>
            <p className="text-xs text-slate-500 mb-3">Revenue geographic allocation</p>
            <div className="h-44 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.by_region}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    dataKey="revenue"
                    nameKey="region"
                  >
                    {analytics.by_region.map((_, idx) => (
                      <Cell key={`cell-${idx}`} fill={REGION_COLORS[idx % REGION_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Revenue']}
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px] pt-1 border-t border-slate-100">
              {analytics.by_region.map((r, i) => (
                <div key={r.region} className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: REGION_COLORS[i % REGION_COLORS.length] }}></span>
                  <span className="text-slate-600 truncate">{r.region}: ${r.revenue.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sales by Channel */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center mb-1">
              <Globe className="w-4 h-4 text-indigo-600 mr-1.5" /> Sales by Channel
            </h2>
            <p className="text-xs text-slate-500 mb-3">Volume across fulfillment routes</p>
            <div className="space-y-3 pt-2">
              {analytics.by_channel.map((ch) => (
                <div key={ch.channel} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">{ch.channel}</span>
                    <span className="font-semibold text-slate-900">${ch.revenue.toLocaleString()} ({ch.orders} orders)</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${Math.min(100, (ch.revenue / (analytics.total_revenue || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by order ID, customer name, email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Processing">Processing</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Returned">Returned</option>
          </select>

          {/* Region Filter */}
          <select
            value={regionFilter}
            onChange={(e) => {
              setRegionFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
          >
            <option value="">All Regions</option>
            <option value="North America">North America</option>
            <option value="Europe">Europe</option>
            <option value="Asia Pacific">Asia Pacific</option>
            <option value="Latin America">Latin America</option>
          </select>

          {/* Channel Filter */}
          <select
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
          >
            <option value="">All Channels</option>
            <option value="Direct Web">Direct Web</option>
            <option value="Enterprise">Enterprise</option>
            <option value="Retail Partner">Retail Partner</option>
            <option value="Marketplace">Marketplace</option>
          </select>
        </div>
      </div>

      {/* Orders Transaction Table */}
      <div id="sales-orders-table" className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th
                  onClick={() => {
                    setSortBy('id');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900"
                >
                  Order ID
                </th>
                <th
                  onClick={() => {
                    setSortBy('order_date');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900"
                >
                  Order Date
                </th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Summary</th>
                <th className="py-3 px-4 text-right">Items</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Region</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-500">
                    No orders found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr
                    key={o.id}
                    id={`order-row-${o.id}`}
                    data-source-id={`order-${o.id}`}
                    data-record-id={o.id}
                    onClick={() => loadOrderDetail(o.id)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-blue-600">#{o.id}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(o.order_date).toLocaleDateString(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{o.customer_name}</div>
                      <div className="text-[11px] text-slate-400">{o.customer_email}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{o.items_summary}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700">{o.total_items}</td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">
                      ${o.total_amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{o.sales_channel}</td>
                    <td className="py-3 px-4 text-slate-600">{o.region}</td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            loadOrderDetail(o.id);
                          }}
                          className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 cursor-pointer text-xs"
                        >
                          Details
                        </button>
                        <AskAIButton
                          objectContext={{
                            type: 'order',
                            id: o.id,
                            title: `Order #${o.id} (${o.customer_name})`,
                            route: `/sales?highlight=${o.id}`,
                            data: {
                              order_id: o.id,
                              customer_name: o.customer_name,
                              customer_email: o.customer_email,
                              order_date: o.order_date,
                              total_amount: o.total_amount,
                              sales_channel: o.sales_channel,
                              region: o.region,
                              status: o.status,
                              items_summary: o.items_summary
                            }
                          }}
                          prompt={`Analyze Order #${o.id} placed by ${o.customer_name} on ${o.order_date} for $${o.total_amount.toFixed(2)}. Break down items and delivery context.`}
                          variant="icon"
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <strong>{(page - 1) * pageSize + (orders.length > 0 ? 1 : 0)}</strong> to{' '}
            <strong>{Math.min(page * pageSize, totalOrdersCount)}</strong> of{' '}
            <strong>{totalOrdersCount}</strong> orders
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="font-medium text-slate-700">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <Modal
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title={`Order #${selectedOrder.id} Details`}
          subtitle={`Placed on ${new Date(selectedOrder.order_date).toLocaleString()} via ${selectedOrder.sales_channel}`}
          maxWidth="2xl"
        >
          <div className="space-y-5 text-xs">
            {/* Top metadata grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/70">
              <div>
                <span className="text-slate-400 block text-[11px]">Customer</span>
                <button
                  onClick={() => {
                    const cid = selectedOrder.customer_id;
                    setSelectedOrder(null);
                    navigate(`/customers?highlight=${cid}`);
                  }}
                  className="font-semibold text-blue-600 hover:underline flex items-center mt-0.5"
                >
                  {selectedOrder.customer_name}
                  <ExternalLink className="w-3 h-3 ml-1" />
                </button>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Status</span>
                <div className="mt-0.5">
                  <StatusBadge status={selectedOrder.status} />
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Delivery Region</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">{selectedOrder.region}</span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Total Amount</span>
                <span className="font-bold text-slate-900 mt-0.5 block text-sm">
                  ${selectedOrder.total_amount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-2">Purchased Items ({selectedOrder.items?.length || 0})</h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                    <tr>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.items?.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3">
                          <button
                            onClick={() => {
                              const pid = item.product_id;
                              setSelectedOrder(null);
                              navigate(`/products?highlight=${pid}`);
                            }}
                            className="font-medium text-blue-600 hover:underline flex items-center"
                          >
                            {item.product_name}
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{item.category}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">${item.unit_price.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-900">${item.total_price.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cross module jump buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <AskAIButton
                objectContext={{
                  type: 'order',
                  id: selectedOrder.id,
                  title: `Order #${selectedOrder.id} (${selectedOrder.customer_name})`,
                  route: `/sales?highlight=${selectedOrder.id}`,
                  data: {
                    id: selectedOrder.id,
                    customer: selectedOrder.customer_name,
                    email: selectedOrder.customer_email,
                    date: selectedOrder.order_date,
                    total: selectedOrder.total_amount,
                    channel: selectedOrder.sales_channel,
                    region: selectedOrder.region,
                    status: selectedOrder.status,
                    items_count: selectedOrder.items?.length
                  }
                }}
                prompt={`Analyze Order #${selectedOrder.id} for customer ${selectedOrder.customer_name}. Summarize purchased items, average price, and fulfillment risk.`}
                label="Ask AI about this order"
              />
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    const cid = selectedOrder.customer_id;
                    setSelectedOrder(null);
                    navigate(`/customers?highlight=${cid}`);
                  }}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium transition-colors cursor-pointer"
                >
                  View Customer Profile
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-medium transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
