import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Package, Users, ArrowRight, Loader2 } from 'lucide-react';
import { apiClient } from '../api/client';
import { Modal } from './Modal';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    orders: any[];
    products: any[];
    customers: any[];
  }>({ orders: [], products: [], customers: [] });

  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim()) {
      setResults({ orders: [], products: [], customers: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [salesRes, prodRes, custRes] = await Promise.all([
          apiClient.getSales({ search: query, page_size: 4 }),
          apiClient.getProducts({ search: query, page_size: 4 }),
          apiClient.getCustomers({ search: query, page_size: 4 })
        ]);

        setResults({
          orders: salesRes.items || [],
          products: prodRes.items || [],
          customers: custRes.items || []
        });
      } catch (err) {
        console.error('Search error', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (route: string) => {
    onClose();
    navigate(route);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Global Search" subtitle="Search across orders, products, and customers" maxWidth="xl">
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Type an order ID, customer name, email, or product..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          {loading && (
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
          )}
        </div>

        {query.trim() && (
          <div className="space-y-4 max-h-96 overflow-y-auto pt-2">
            {/* Products */}
            {results.products.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1.5 flex items-center">
                  <Package className="w-3.5 h-3.5 mr-1" /> Products
                </div>
                <div className="space-y-1">
                  {results.products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelect(`/products?highlight=${p.id}`)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 flex items-center justify-between group transition-colors"
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-900 group-hover:text-blue-600">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.category} • ${p.selling_price} • Stock: {p.stock_quantity}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Customers */}
            {results.customers.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1.5 flex items-center">
                  <Users className="w-3.5 h-3.5 mr-1" /> Customers
                </div>
                <div className="space-y-1">
                  {results.customers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelect(`/customers?highlight=${c.id}`)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 flex items-center justify-between group transition-colors"
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-900 group-hover:text-blue-600">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.email} • {c.region} • {c.segment}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Orders */}
            {results.orders.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1.5 flex items-center">
                  <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Orders
                </div>
                <div className="space-y-1">
                  {results.orders.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => handleSelect(`/sales?order_id=${o.id}`)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 flex items-center justify-between group transition-colors"
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-900 group-hover:text-blue-600">Order #{o.id} — {o.customer_name}</div>
                        <div className="text-xs text-slate-500">${o.total_amount} • {o.status} • {o.sales_channel}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loading && results.products.length === 0 && results.customers.length === 0 && results.orders.length === 0 && (
              <div className="text-center py-8 text-sm text-slate-500">
                No records matching &ldquo;{query}&rdquo;
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
