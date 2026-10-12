import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Package,
  DollarSign,
  TrendingUp,
  Percent,
  Search,
  Filter,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Boxes,
  History,
  ShoppingCart,
  Loader2,
  Plus,
  Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { apiClient } from '../../api/client';
import { Product, ProductDetail } from '../../types';
import { KPICard } from '../../components/KPICard';
import { StatusBadge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { AskAIButton } from '../../components/AskAIButton';
import { ProductFormModal } from './ProductFormModal';
import { useProductAgent } from '../../context/ProductAgentContext';

export const ProductsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Product Agent & Form State
  const {
    isFormModalOpen,
    openFormModal,
    closeFormModal,
    isAgentDrivingForm,
    activeFormField,
    completedFormFields,
    activeFormData,
    openAgentWindow
  } = useProductAgent();

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [pageSize] = useState<number>(50);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('revenue');
  const [sortOrder, setSortOrder] = useState<string>('desc');

  // Detail Modal
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Check URL highlight - only open modal if modal=true is explicitly requested
  useEffect(() => {
    const highlight = searchParams.get('highlight');
    const openModal = searchParams.get('modal') === 'true';
    if (highlight) {
      if (openModal && !isNaN(Number(highlight))) {
        loadProductDetail(Number(highlight));
      } else if (isNaN(Number(highlight))) {
        setSearch(highlight);
      }
      setTimeout(() => {
        const el = document.getElementById(`product-row-${highlight}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
    }
  }, [searchParams, products]);

  const loadProductDetail = async (id: number) => {
    try {
      setSelectedProductId(id);
      setDetailLoading(true);
      const detail = await apiClient.getProductDetail(id);
      setProductDetail(detail);
    } catch (err) {
      console.error('Failed to load product detail', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      if (search.trim()) params.search = search.trim();
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.stock_status = statusFilter;

      const data = await apiClient.getProducts(params);
      setProducts(data.items || []);
      setSummary(data.summary || null);
      setTotalPages(data.total_pages || 1);
      setTotalCount(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch products', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, search, categoryFilter, statusFilter, sortBy, sortOrder]);

  // Listen for live data updates from AI Assistant actions
  useEffect(() => {
    const handleDataRefresh = () => {
      fetchProducts();
    };
    window.addEventListener('insightflow-refresh-data', handleDataRefresh);
    return () => {
      window.removeEventListener('insightflow-refresh-data', handleDataRefresh);
    };
  }, [page, pageSize, sortBy, sortOrder, search, categoryFilter, statusFilter]);

  // Derive top 5 and bottom 5 products from current loaded items for comparison
  const topProducts = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const bottomProducts = [...products].filter(p => p.units_sold > 0).sort((a, b) => a.revenue - b.revenue).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Product Catalogue & Margin Performance</h1>
          <p className="text-xs text-slate-500 mt-1">
            Catalog unit economics, gross margins, historical COGS tracking, and sales velocity comparisons.
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => openAgentWindow()}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>AI Document Import</span>
          </button>
          <button
            id="add-product-button"
            type="button"
            onClick={openFormModal}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            data={{
              title: 'Total Active SKUs',
              value: summary.total_products,
              formatted_value: summary.total_products.toString(),
              period_label: 'Catalog universe',
              trend: 'neutral'
            }}
            icon={<Package className="w-4 h-4 text-blue-600" />}
          />
          <KPICard
            data={{
              title: 'Lifetime Catalog Revenue',
              value: summary.total_revenue,
              formatted_value: `$${summary.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
              period_label: 'Completed orders',
              trend: 'up'
            }}
            icon={<DollarSign className="w-4 h-4 text-emerald-600" />}
          />
          <KPICard
            data={{
              title: 'Average Gross Margin',
              value: summary.average_margin,
              formatted_value: `${summary.average_margin.toFixed(1)}%`,
              period_label: 'Across all SKUs',
              trend: 'up'
            }}
            icon={<Percent className="w-4 h-4 text-indigo-600" />}
          />
          <KPICard
            data={{
              title: 'Total Units Delivered',
              value: summary.total_units_sold,
              formatted_value: summary.total_units_sold.toLocaleString(),
              period_label: 'Customer purchases',
              trend: 'up'
            }}
            icon={<TrendingUp className="w-4 h-4 text-amber-600" />}
          />
        </div>
      )}

      {/* Top vs Bottom Products Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Products by Revenue */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Top 5 Products by Revenue</h2>
          <p className="text-xs text-slate-500 mb-3">Leading catalog revenue contributors</p>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#334155' }} width={120} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Revenue']}
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px' }}
                />
                <Bar dataKey="revenue" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lowest Revenue Products */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Lowest Active SKUs by Revenue</h2>
          <p className="text-xs text-slate-500 mb-3">Underperforming or slow-velocity products</p>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bottomProducts} layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#334155' }} width={120} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Revenue']}
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px' }}
                />
                <Bar dataKey="revenue" fill="#94a3b8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search product name or SKU..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
          >
            <option value="">All Categories</option>
            <option value="Electronics">Electronics</option>
            <option value="Furniture">Furniture</option>
            <option value="Office Supplies">Office Supplies</option>
            <option value="Apparel">Apparel</option>
            <option value="Fitness">Fitness</option>
          </select>

          {/* Availability Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
          >
            <option value="">All Stock Statuses</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Products Performance Table */}
      <div id="products-table" className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th
                  onClick={() => {
                    setSortBy('name');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900"
                >
                  Product SKU & Name
                </th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Price</th>
                <th className="py-3 px-4 text-right">Unit Cost</th>
                <th
                  onClick={() => {
                    setSortBy('units_sold');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                >
                  Units Sold
                </th>
                <th
                  onClick={() => {
                    setSortBy('revenue');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                >
                  Revenue
                </th>
                <th
                  onClick={() => {
                    setSortBy('gross_profit');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                >
                  Gross Profit
                </th>
                <th
                  onClick={() => {
                    setSortBy('gross_margin_percent');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                >
                  Margin (%)
                </th>
                <th className="py-3 px-4 text-center">Stock</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-500">
                    No products found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr
                    key={p.id}
                    id={`product-row-${p.id}`}
                    data-source-id={`product-${p.id}`}
                    data-record-id={p.id}
                    onClick={() => loadProductDetail(p.id)}
                    className={`cursor-pointer transition-all ${
                      searchParams.get('highlight') === String(p.id)
                        ? 'bg-emerald-50/80 ring-2 ring-emerald-500/40 shadow-xs'
                        : 'hover:bg-blue-50/40'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">SKU: {p.sku || `#${p.id}`}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{p.category}</td>
                    <td className="py-3 px-4 text-right text-slate-700 font-medium">${p.selling_price.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-slate-500">${p.unit_cost.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-slate-700 font-medium">{p.units_sold}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">${p.revenue.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                      ${p.gross_profit.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">
                      {p.gross_margin_percent.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={p.stock_status} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            loadProductDetail(p.id);
                          }}
                          className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 text-xs cursor-pointer"
                        >
                          Performance
                        </button>
                        <AskAIButton
                          objectContext={{
                            type: 'product',
                            id: p.id,
                            title: p.name,
                            route: `/products?highlight=${p.id}`,
                            data: {
                              id: p.id,
                              name: p.name,
                              category: p.category,
                              price: p.selling_price,
                              cost: p.unit_cost,
                              revenue: p.revenue,
                              units_sold: p.units_sold,
                              gross_profit: p.gross_profit,
                              gross_margin_percent: p.gross_margin_percent,
                              stock_status: p.stock_status
                            }
                          }}
                          prompt={`Analyze product "${p.name}" (SKU #${p.id}) and provide a comprehensive Product Intelligence Report.`}
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
            Showing <strong>{(page - 1) * pageSize + (products.length > 0 ? 1 : 0)}</strong> to{' '}
            <strong>{Math.min(page * pageSize, totalCount)}</strong> of <strong>{totalCount}</strong> products
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

      {/* Product Detail Modal */}
      {selectedProductId && (
        <Modal
          isOpen={!!selectedProductId}
          onClose={() => {
            setSelectedProductId(null);
            setProductDetail(null);
          }}
          title={productDetail ? productDetail.name : 'Loading Product...'}
          subtitle={productDetail ? `SKU #${productDetail.id} • Category: ${productDetail.category}` : ''}
          maxWidth="2xl"
        >
          {detailLoading || !productDetail ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              Loading product dossier...
            </div>
          ) : (
            <div className="space-y-5 text-xs">
              {/* Unit Economics Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-slate-400 block text-[11px]">Retail Price</span>
                  <span className="font-bold text-slate-900 mt-0.5 block text-sm">
                    ${productDetail.selling_price.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Unit COGS</span>
                  <span className="font-bold text-slate-900 mt-0.5 block text-sm">
                    ${productDetail.unit_cost.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Gross Margin</span>
                  <span className="font-bold text-emerald-700 mt-0.5 block text-sm">
                    {productDetail.gross_margin_percent.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Current Stock</span>
                  <span className="font-bold text-slate-900 mt-0.5 block text-sm">
                    {productDetail.stock_quantity} units
                  </span>
                </div>
              </div>

              {/* Cross-module links and AI Analysis */}
              <div className="flex flex-wrap items-center gap-2.5">
                <AskAIButton
                  objectContext={{
                    type: 'product',
                    id: productDetail.id,
                    title: productDetail.name,
                    route: `/products?highlight=${productDetail.id}`,
                    data: {
                      id: productDetail.id,
                      name: productDetail.name,
                      category: productDetail.category,
                      selling_price: productDetail.selling_price,
                      unit_cost: productDetail.unit_cost,
                      gross_margin_percent: productDetail.gross_margin_percent,
                      stock_quantity: productDetail.stock_quantity,
                      total_units_sold: productDetail.sales_history.reduce((a, b) => a + b.quantity, 0),
                      recent_orders_count: productDetail.sales_history.length
                    }
                  }}
                  prompt={`Analyze product "${productDetail.name}" (SKU #${productDetail.id}) and provide a comprehensive Product Intelligence Report with historical sales trends and restocking recommendations.`}
                  label="Ask AI for Product Intelligence Report"
                />
                <button
                  onClick={() => {
                    const pid = productDetail.id;
                    setSelectedProductId(null);
                    navigate(`/inventory?highlight=${pid}`);
                  }}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Boxes className="w-3.5 h-3.5" />
                  <span>Manage in Inventory</span>
                </button>
                <button
                  onClick={() => {
                    const pid = productDetail.id;
                    setSelectedProductId(null);
                    navigate(`/sales?product_id=${pid}`);
                  }}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Filter Sales Orders</span>
                </button>
              </div>

              {/* Recent Sales History */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-2 flex items-center">
                  <ShoppingCart className="w-3.5 h-3.5 text-blue-600 mr-1.5" /> Recent Orders ({productDetail.sales_history.length})
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                      <tr>
                        <th className="py-2 px-3">Order ID</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Customer</th>
                        <th className="py-2 px-3 text-right">Qty</th>
                        <th className="py-2 px-3 text-right">Total</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {productDetail.sales_history.slice(0, 10).map((sh) => (
                        <tr key={sh.order_id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-blue-600 font-medium">#{sh.order_id}</td>
                          <td className="py-2 px-3 text-slate-600">{sh.order_date}</td>
                          <td className="py-2 px-3 text-slate-800 font-medium">{sh.customer_name}</td>
                          <td className="py-2 px-3 text-right text-slate-700">{sh.quantity}</td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-900">${sh.total_price.toFixed(2)}</td>
                          <td className="py-2 px-3 text-center">
                            <StatusBadge status={sh.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setSelectedProductId(null);
                    setProductDetail(null);
                  }}
                  className="px-3.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Controlled Product Creation Form Modal (Manual & Visual Agent Driven) */}
      <ProductFormModal
        isOpen={isFormModalOpen}
        onClose={closeFormModal}
        onSuccess={() => {
          fetchProducts();
        }}
        initialData={activeFormData}
        isAgentControlled={isAgentDrivingForm}
        activeHighlightField={activeFormField}
        completedFields={completedFormFields}
      />
    </div>
  );
};
