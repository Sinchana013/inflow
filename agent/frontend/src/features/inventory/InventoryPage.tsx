import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Boxes,
  Package,
  AlertTriangle,
  XCircle,
  DollarSign,
  Search,
  Filter,
  Plus,
  Minus,
  RotateCcw,
  History,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { Product, InventoryAlert } from '../../types';
import { KPICard } from '../../components/KPICard';
import { StatusBadge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { AskAIButton } from '../../components/AskAIButton';

export const InventoryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // State
  const [inventoryItems, setInventoryItems] = useState<Product[]>([]);
  const [summaryStats, setSummaryStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [pageSize] = useState<number>(50);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('stock_quantity');
  const [sortOrder, setSortOrder] = useState<string>('asc');

  // Modals & Forms
  const [adjustModalProduct, setAdjustModalProduct] = useState<Product | null>(null);
  const [adjustQtyChange, setAdjustQtyChange] = useState<number>(10);
  const [adjustType, setAdjustType] = useState<string>('Restock');
  const [adjustReason, setAdjustReason] = useState<string>('Regular warehouse replenishment');
  const [adjusting, setAdjusting] = useState<boolean>(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSuccess, setAdjustSuccess] = useState<string | null>(null);

  // Movements history modal
  const [movementsModalProduct, setMovementsModalProduct] = useState<Product | null>(null);
  const [movementsList, setMovementsList] = useState<any[]>([]);
  const [loadingMovements, setLoadingMovements] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Check query parameter highlight
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId && isNaN(Number(highlightId))) {
      setSearch(highlightId);
    }
  }, [searchParams]);

  const loadInventory = async () => {
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

      const [invData, alertsData] = await Promise.all([
        apiClient.getInventory(params),
        apiClient.getInventoryAlerts()
      ]);

      setInventoryItems(invData.items || []);
      setSummaryStats(invData.summary || null);
      setTotalPages(invData.total_pages || 1);
      setTotalCount(invData.total || 0);
      setAlerts(alertsData);
    } catch (err) {
      console.error('Failed to load inventory', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [page, search, categoryFilter, statusFilter, sortBy, sortOrder]);

  // Listen for live data updates from AI Assistant actions
  useEffect(() => {
    const handleDataRefresh = () => {
      loadInventory();
    };
    window.addEventListener('insightflow-refresh-data', handleDataRefresh);
    return () => {
      window.removeEventListener('insightflow-refresh-data', handleDataRefresh);
    };
  }, [page, pageSize, sortBy, sortOrder, search, categoryFilter, statusFilter]);

  const openAdjustModal = (product: Product) => {
    setAdjustModalProduct(product);
    setAdjustQtyChange(10);
    setAdjustType('Restock');
    setAdjustReason('Warehouse replenishment');
    setAdjustError(null);
    setAdjustSuccess(null);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalProduct) return;

    if (adjustModalProduct.stock_quantity + adjustQtyChange < 0) {
      setAdjustError(`Cannot deduct ${Math.abs(adjustQtyChange)} units: current stock is only ${adjustModalProduct.stock_quantity}.`);
      return;
    }

    try {
      setAdjusting(true);
      setAdjustError(null);
      await apiClient.adjustStock(adjustModalProduct.id, {
        quantity_change: adjustQtyChange,
        movement_type: adjustType,
        reason: adjustReason.trim() || 'Manual stock update'
      });

      setAdjustSuccess(`Successfully updated stock for ${adjustModalProduct.name}!`);
      setTimeout(() => {
        setAdjustModalProduct(null);
        loadInventory();
      }, 1000);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to update stock';
      setAdjustError(msg);
    } finally {
      setAdjusting(false);
    }
  };

  const openMovementsModal = async (product: Product) => {
    setMovementsModalProduct(product);
    try {
      setLoadingMovements(true);
      const moves = await apiClient.getProductMovements(product.id);
      setMovementsList(moves);
    } catch (err) {
      console.error('Failed to load movements', err);
    } finally {
      setLoadingMovements(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inventory Monitoring & Control</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time stock valuation, reorder thresholds, audit movement logs, and stock adjustments.
          </p>
        </div>

        <button
          onClick={loadInventory}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium shadow-2xs transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span>Refresh Stock</span>
        </button>
      </div>

      {/* KPI Cards Row */}
      {summaryStats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <KPICard
            data={{
              title: 'Total Catalog SKUs',
              value: summaryStats.total_products,
              formatted_value: summaryStats.total_products.toString(),
              period_label: 'Active products',
              trend: 'neutral'
            }}
            icon={<Package className="w-4 h-4 text-blue-600" />}
          />
          <KPICard
            data={{
              title: 'Total Stock Units',
              value: summaryStats.total_units,
              formatted_value: summaryStats.total_units.toLocaleString(),
              period_label: 'On-hand physical stock',
              trend: 'neutral'
            }}
            icon={<Boxes className="w-4 h-4 text-emerald-600" />}
          />
          <KPICard
            data={{
              title: 'Low-Stock SKUs',
              value: summaryStats.low_stock_count,
              formatted_value: summaryStats.low_stock_count.toString(),
              period_label: 'At or below threshold',
              trend: summaryStats.low_stock_count > 0 ? 'down' : 'neutral'
            }}
            icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
          />
          <KPICard
            data={{
              title: 'Out of Stock',
              value: summaryStats.out_of_stock_count,
              formatted_value: summaryStats.out_of_stock_count.toString(),
              period_label: '0 units remaining',
              trend: summaryStats.out_of_stock_count > 0 ? 'down' : 'neutral'
            }}
            icon={<XCircle className="w-4 h-4 text-rose-600" />}
          />
          <KPICard
            data={{
              title: 'Inventory Valuation',
              value: summaryStats.inventory_valuation,
              formatted_value: `$${summaryStats.inventory_valuation.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
              period_label: 'Unit cost basis',
              trend: 'up'
            }}
            icon={<DollarSign className="w-4 h-4 text-indigo-600" />}
          />
        </div>
      )}

      {/* Critical Stock Alerts Banner */}
      {alerts.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-amber-900">
                {alerts.length} Products Require Immediate Stock Attention
              </div>
              <div className="text-[11px] text-amber-700 mt-0.5">
                Stock is at or below defined safety thresholds. Reordering prevents costly delivery disruptions.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {alerts.slice(0, 3).map((a) => (
              <div key={a.product_id} id={`inventory-alert-${a.product_id}`} data-source-id={`inventory-alert-${a.product_id}`} className="flex items-center space-x-1">
                <button
                  onClick={() => setSearch(a.product_name)}
                  className="text-[11px] font-medium px-2.5 py-1 bg-white border border-amber-300 rounded-md text-amber-800 hover:bg-amber-100 flex items-center space-x-1 cursor-pointer"
                >
                  <span>{a.product_name}</span>
                  <span className="font-bold text-rose-600">({a.current_stock} left)</span>
                </button>
                <AskAIButton
                  objectContext={{
                    type: 'inventory_record',
                    id: a.product_id,
                    title: `Low Stock Alert: ${a.product_name}`,
                    route: `/inventory?highlight=${a.product_id}`,
                    data: a
                  }}
                  prompt={`Analyze critical low-stock alert for "${a.product_name}". Current stock is ${a.current_stock} (threshold: ${a.reorder_threshold}). What is the replenishment urgency and recommended purchase order size?`}
                  variant="icon"
                />
              </div>
            ))}
          </div>
        </div>
      )}

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

          {/* Status Filter */}
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

      {/* Inventory Table */}
      <div id="inventory-table" className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
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
                <th
                  onClick={() => {
                    setSortBy('stock_quantity');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                >
                  Stock
                </th>
                <th className="py-3 px-4 text-right">Threshold</th>
                <th
                  onClick={() => {
                    setSortBy('units_sold');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                >
                  Units Sold
                </th>
                <th className="py-3 px-4 text-right">Unit Cost</th>
                <th
                  onClick={() => {
                    setSortBy('inventory_value');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                >
                  Inventory Value
                </th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading inventory records...
                  </td>
                </tr>
              ) : inventoryItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    No products found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                inventoryItems.map((p) => (
                  <tr
                    key={p.id}
                    id={`inventory-row-${p.id}`}
                    data-source-id={`inventory-${p.id}`}
                    data-record-id={p.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="text-[11px] text-slate-400">SKU #{p.id} • Retail: ${p.selling_price.toFixed(2)}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{p.category}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">{p.stock_quantity}</td>
                    <td className="py-3 px-4 text-right text-slate-500">{p.reorder_threshold}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700">{p.units_sold}</td>
                    <td className="py-3 px-4 text-right text-slate-600">${p.unit_cost.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">
                      ${p.inventory_value.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={p.stock_status} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => openAdjustModal(p)}
                          className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors cursor-pointer"
                        >
                          Adjust
                        </button>
                        <button
                          onClick={() => openMovementsModal(p)}
                          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                          title="Movement History"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <AskAIButton
                          objectContext={{
                            type: 'inventory_record',
                            id: p.id,
                            title: `Inventory: ${p.name}`,
                            route: `/inventory?highlight=${p.id}`,
                            data: {
                              id: p.id,
                              name: p.name,
                              category: p.category,
                              stock_quantity: p.stock_quantity,
                              reorder_threshold: p.reorder_threshold,
                              unit_cost: p.unit_cost,
                              inventory_value: p.inventory_value,
                              stock_status: p.stock_status
                            }
                          }}
                          prompt={`Evaluate inventory status and stockout risk for "${p.name}". Stock is ${p.stock_quantity} (threshold: ${p.reorder_threshold}). Should we reorder now?`}
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
            Showing <strong>{(page - 1) * pageSize + (inventoryItems.length > 0 ? 1 : 0)}</strong> to{' '}
            <strong>{Math.min(page * pageSize, totalCount)}</strong> of <strong>{totalCount}</strong> items
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

      {/* Stock Adjustment Form Modal */}
      {adjustModalProduct && (
        <Modal
          isOpen={!!adjustModalProduct}
          onClose={() => setAdjustModalProduct(null)}
          title={`Adjust Stock: ${adjustModalProduct.name}`}
          subtitle={`Current inventory: ${adjustModalProduct.stock_quantity} units (Threshold: ${adjustModalProduct.reorder_threshold})`}
          maxWidth="md"
        >
          <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
            {adjustError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{adjustError}</span>
              </div>
            )}

            {adjustSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{adjustSuccess}</span>
              </div>
            )}

            <div>
              <label className="block font-medium text-slate-700 mb-1">Adjustment Type</label>
              <select
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Restock">Restock (Adding incoming shipment)</option>
                <option value="Adjustment">Adjustment (Audit physical count)</option>
                <option value="Return">Customer Return</option>
                <option value="Write-off">Damaged / Write-off</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Quantity Change (+ to add, - to deduct)
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setAdjustQtyChange(adjustQtyChange - 1)}
                  className="p-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  value={adjustQtyChange}
                  onChange={(e) => setAdjustQtyChange(Number(e.target.value))}
                  className="flex-1 p-2 text-center font-bold text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setAdjustQtyChange(adjustQtyChange + 1)}
                  className="p-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Projected new stock:{' '}
                <strong>{adjustModalProduct.stock_quantity + adjustQtyChange}</strong> units
              </p>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Reason / Reference Note</label>
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g., PO #4489 received at warehouse"
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAdjustModalProduct(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adjusting}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center space-x-1.5"
              >
                {adjusting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Stock Update</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Movements History Modal */}
      {movementsModalProduct && (
        <Modal
          isOpen={!!movementsModalProduct}
          onClose={() => setMovementsModalProduct(null)}
          title={`Inventory Movement Ledger: ${movementsModalProduct.name}`}
          subtitle={`Audit trail of all restocking, sales deductions, and adjustments`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            {loadingMovements ? (
              <div className="py-8 text-center text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                Loading audit trail...
              </div>
            ) : movementsList.length === 0 ? (
              <div className="py-6 text-center text-slate-500">No movement history recorded yet.</div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3 text-right">Change</th>
                      <th className="py-2 px-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movementsList.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-500">
                          {new Date(m.created_at).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800">{m.movement_type}</td>
                        <td className={`py-2 px-3 text-right font-bold ${
                          m.quantity_change > 0 ? 'text-emerald-600' : 'text-slate-900'
                        }`}>
                          {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                        </td>
                        <td className="py-2 px-3 text-slate-600 max-w-xs truncate">{m.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setMovementsModalProduct(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
