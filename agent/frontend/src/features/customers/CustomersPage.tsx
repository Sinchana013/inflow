import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Repeat,
  DollarSign,
  Search,
  Filter,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  TrendingUp,
  Tag,
  Loader2
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { Customer, CustomerDetail } from '../../types';
import { KPICard } from '../../components/KPICard';
import { StatusBadge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { AskAIButton } from '../../components/AskAIButton';

export const CustomersPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [pageSize] = useState<number>(50);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [segmentFilter, setSegmentFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('total_revenue');
  const [sortOrder, setSortOrder] = useState<string>('desc');

  // Customer Detail Modal
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Check URL highlight parameter - only open modal if modal=true is explicitly requested
  useEffect(() => {
    const highlight = searchParams.get('highlight');
    const openModal = searchParams.get('modal') === 'true';
    if (highlight) {
      if (openModal && !isNaN(Number(highlight))) {
        loadCustomerDetail(Number(highlight));
      } else if (isNaN(Number(highlight))) {
        setSearch(highlight);
      }
    }
  }, [searchParams]);

  const loadCustomerDetail = async (id: number) => {
    try {
      setSelectedCustomerId(id);
      setDetailLoading(true);
      const detail = await apiClient.getCustomerDetail(id);
      setCustomerDetail(detail);
    } catch (err) {
      console.error('Failed to load customer detail', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      if (search.trim()) params.search = search.trim();
      if (regionFilter) params.region = regionFilter;
      if (segmentFilter) params.segment = segmentFilter;

      const data = await apiClient.getCustomers(params);
      setCustomers(data.items || []);
      setSummary(data.summary || null);
      setTotalPages(data.total_pages || 1);
      setTotalCount(data.total || 0);
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, search, regionFilter, segmentFilter, sortBy, sortOrder]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customer Intelligence & Lifetime Value</h1>
        <p className="text-xs text-slate-500 mt-1">
          Deterministic cohort segmentation, repeat purchasing rates, regional distribution, and order histories.
        </p>
      </div>

      {/* KPI Cards Row */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            data={{
              title: 'Total Active Customers',
              value: summary.total_customers,
              formatted_value: summary.total_customers.toString(),
              period_label: 'Registered accounts',
              trend: 'neutral'
            }}
            icon={<Users className="w-4 h-4 text-blue-600" />}
          />
          <KPICard
            data={{
              title: 'New Accounts (Last 45d)',
              value: summary.new_customers,
              formatted_value: summary.new_customers.toString(),
              period_label: 'Recent onboarding cohort',
              trend: 'up'
            }}
            icon={<UserPlus className="w-4 h-4 text-emerald-600" />}
          />
          <KPICard
            data={{
              title: 'Repeat Customer Rate',
              value: summary.repeat_percentage,
              formatted_value: `${summary.repeat_percentage}%`,
              period_label: '≥2 completed orders',
              trend: 'up'
            }}
            icon={<Repeat className="w-4 h-4 text-indigo-600" />}
          />
          <KPICard
            data={{
              title: 'Average Lifetime Revenue',
              value: summary.avg_lifetime_revenue,
              formatted_value: `$${summary.avg_lifetime_revenue.toFixed(2)}`,
              period_label: 'Revenue / Total Customers',
              trend: 'up'
            }}
            icon={<DollarSign className="w-4 h-4 text-amber-600" />}
          />
        </div>
      )}

      {/* Segmentation Rule Explanations Banner */}
      <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl text-xs flex flex-wrap items-center gap-x-6 gap-y-1.5 text-slate-600">
        <span className="font-semibold text-blue-900">Deterministic Segment Criteria:</span>
        <span><strong className="text-purple-700">High Value:</strong> Lifetime Spend ≥ $1,500</span>
        <span><strong className="text-amber-700">Repeat:</strong> ≥ 2 Completed Orders</span>
        <span><strong className="text-blue-700">New:</strong> Registered ≤ 45 days ago</span>
        <span><strong className="text-slate-600">Inactive:</strong> No purchase within 75 days</span>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or email address..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

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

          {/* Segment Filter */}
          <select
            value={segmentFilter}
            onChange={(e) => {
              setSegmentFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
          >
            <option value="">All Segments</option>
            <option value="High Value">High Value</option>
            <option value="Repeat">Repeat</option>
            <option value="New">New</option>
            <option value="Inactive">Inactive</option>
            <option value="Standard">Standard</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div id="customers-table" className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
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
                  Customer Name
                </th>
                <th className="py-3 px-4">Region</th>
                <th
                  onClick={() => {
                    setSortBy('registration_date');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900"
                >
                  Registration Date
                </th>
                <th
                  onClick={() => {
                    setSortBy('total_orders');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                >
                  Total Orders
                </th>
                <th
                  onClick={() => {
                    setSortBy('total_revenue');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                >
                  Lifetime Revenue
                </th>
                <th className="py-3 px-4">Last Order</th>
                <th className="py-3 px-4 text-center">Segment</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    No customers found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr
                    key={c.id}
                    id={`customer-row-${c.id}`}
                    data-source-id={`customer-${c.id}`}
                    data-record-id={c.id}
                    onClick={() => loadCustomerDetail(c.id)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{c.name}</div>
                      <div className="text-[11px] text-slate-400">{c.email}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{c.region}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(c.registration_date).toLocaleDateString(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700">{c.total_orders}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      ${c.total_revenue.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {c.last_order_date
                        ? new Date(c.last_order_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Never'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={c.segment} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            loadCustomerDetail(c.id);
                          }}
                          className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 cursor-pointer text-xs"
                        >
                          Profile
                        </button>
                        <AskAIButton
                          objectContext={{
                            type: 'customer',
                            id: c.id,
                            title: `Customer: ${c.name}`,
                            route: `/customers?highlight=${c.id}`,
                            data: {
                              id: c.id,
                              name: c.name,
                              email: c.email,
                              region: c.region,
                              segment: c.segment,
                              orders_count: c.total_orders,
                              total_orders: c.total_orders,
                              total_revenue: c.total_revenue
                            }
                          }}
                          prompt={`Analyze customer profile for ${c.name} (${c.segment} segment, ${c.region}). What is their purchasing frequency and churn risk?`}
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
            Showing <strong>{(page - 1) * pageSize + (customers.length > 0 ? 1 : 0)}</strong> to{' '}
            <strong>{Math.min(page * pageSize, totalCount)}</strong> of <strong>{totalCount}</strong> customers
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

      {/* Customer Detail Profile Modal */}
      {selectedCustomerId && (
        <Modal
          isOpen={!!selectedCustomerId}
          onClose={() => {
            setSelectedCustomerId(null);
            setCustomerDetail(null);
          }}
          title={customerDetail ? customerDetail.name : 'Loading Profile...'}
          subtitle={customerDetail ? `${customerDetail.email} • ${customerDetail.region} Customer` : ''}
          maxWidth="2xl"
        >
          {detailLoading || !customerDetail ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              Loading customer dossier...
            </div>
          ) : (
            <div className="space-y-5 text-xs">
              {/* Summary KPIs banner */}
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-slate-400 block text-[11px]">Lifetime Spend</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                    ${customerDetail.total_revenue.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Completed Orders</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                    {customerDetail.total_orders}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Assigned Segment</span>
                  <div className="mt-0.5">
                    <StatusBadge status={customerDetail.segment} />
                  </div>
                </div>
              </div>

              {/* Category Preferences Breakdown */}
              {customerDetail.category_preferences.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2 flex items-center">
                    <Tag className="w-3.5 h-3.5 text-blue-600 mr-1.5" /> Category Preferences
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {customerDetail.category_preferences.map((cat) => (
                      <div
                        key={cat.category}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg flex items-center space-x-2"
                      >
                        <span className="text-slate-700 font-medium">{cat.category}</span>
                        <span className="font-semibold text-blue-600">${cat.spend.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Order History */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-2 flex items-center">
                  <ShoppingBag className="w-3.5 h-3.5 text-indigo-600 mr-1.5" /> Order History ({customerDetail.recent_orders.length})
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                      <tr>
                        <th className="py-2 px-3">Order ID</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Channel</th>
                        <th className="py-2 px-3 text-right">Items</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                        <th className="py-2 px-3 text-center">Status</th>
                        <th className="py-2 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customerDetail.recent_orders.map((o) => (
                        <tr key={o.order_id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-blue-600 font-medium">#{o.order_id}</td>
                          <td className="py-2 px-3 text-slate-600">{o.order_date}</td>
                          <td className="py-2 px-3 text-slate-600">{o.channel}</td>
                          <td className="py-2 px-3 text-right text-slate-700">{o.items_count}</td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-900">${o.amount.toFixed(2)}</td>
                          <td className="py-2 px-3 text-center">
                            <StatusBadge status={o.status} />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => {
                                setSelectedCustomerId(null);
                                navigate(`/sales?order_id=${o.order_id}`);
                              }}
                              className="text-blue-600 hover:underline flex items-center justify-center font-medium"
                            >
                              View
                              <ExternalLink className="w-3 h-3 ml-0.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <AskAIButton
                  objectContext={{
                    type: 'customer',
                    id: customerDetail.id,
                    title: `Customer: ${customerDetail.name}`,
                    route: `/customers?highlight=${customerDetail.id}`,
                    data: {
                      id: customerDetail.id,
                      name: customerDetail.name,
                      email: customerDetail.email,
                      region: customerDetail.region,
                      segment: customerDetail.segment,
                      total_orders: customerDetail.total_orders,
                      total_revenue: customerDetail.total_revenue,
                      recent_orders: customerDetail.recent_orders
                    }
                  }}
                  prompt={`Analyze customer dossier for "${customerDetail.name}". Total revenue is $${customerDetail.total_revenue.toFixed(2)} with ${customerDetail.total_orders} orders in ${customerDetail.region}. What is their loyalty risk profile and recommended next-best-action?`}
                  label="Ask AI about customer"
                />
                <button
                  onClick={() => {
                    setSelectedCustomerId(null);
                    setCustomerDetail(null);
                  }}
                  className="px-3.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-medium cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
