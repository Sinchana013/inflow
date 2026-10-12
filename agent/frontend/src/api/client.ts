import axios from 'axios';
import {
  DashboardSummary,
  RevenueTrendPoint,
  SalesAnalytics,
  Order,
  Product,
  ProductDetail,
  ProductCreateInput,
  ExtractedProductItem,
  ProductDuplicateCheckResponse,
  DocumentExtractResponse,
  Customer,
  CustomerDetail,
  InventoryAlert,
  ReportSummary,
  CrossModuleInsight,
  AnalysisRunResponse,
  ContextualExplainRequest,
  ContextualExplainResponse
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const apiClient = {
  // Health
  checkHealth: async () => {
    const res = await api.get('/health');
    return res.data;
  },

  // Dashboard
  getDashboardSummary: async (days: number = 30): Promise<DashboardSummary> => {
    const res = await api.get<DashboardSummary>(`/dashboard/summary?days=${days}`);
    return res.data;
  },

  getRevenueTrend: async (days: number = 30): Promise<RevenueTrendPoint[]> => {
    const res = await api.get<RevenueTrendPoint[]>(`/dashboard/revenue-trend?days=${days}`);
    return res.data;
  },

  // Sales
  getSales: async (params: Record<string, any> = {}) => {
    const res = await api.get('/sales', { params });
    return res.data;
  },

  getOrderDetail: async (orderId: number): Promise<Order> => {
    const res = await api.get<Order>(`/sales/${orderId}`);
    return res.data;
  },

  getSalesAnalytics: async (params: Record<string, any> = {}): Promise<SalesAnalytics> => {
    const res = await api.get<SalesAnalytics>('/sales/analytics', { params });
    return res.data;
  },

  // Inventory
  getInventory: async (params: Record<string, any> = {}) => {
    const res = await api.get('/inventory', { params });
    return res.data;
  },

  getInventoryAlerts: async (): Promise<InventoryAlert[]> => {
    const res = await api.get<InventoryAlert[]>('/inventory/alerts');
    return res.data;
  },

  adjustStock: async (productId: number, payload: { quantity_change: number; movement_type: string; reason: string }): Promise<Product> => {
    const res = await api.patch<Product>(`/inventory/${productId}`, payload);
    return res.data;
  },

  getProductMovements: async (productId: number) => {
    const res = await api.get(`/inventory/${productId}/movements`);
    return res.data;
  },

  // Customers
  getCustomers: async (params: Record<string, any> = {}) => {
    const res = await api.get('/customers', { params });
    return res.data;
  },

  getCustomerDetail: async (customerId: number): Promise<CustomerDetail> => {
    const res = await api.get<CustomerDetail>(`/customers/${customerId}`);
    return res.data;
  },

  getCustomerOrders: async (customerId: number): Promise<Order[]> => {
    const res = await api.get<Order[]>(`/customers/${customerId}/orders`);
    return res.data;
  },

  // Products
  getProducts: async (params: Record<string, any> = {}) => {
    const res = await api.get('/products', { params });
    return res.data;
  },

  getProductDetail: async (productId: number): Promise<ProductDetail> => {
    const res = await api.get<ProductDetail>(`/products/${productId}`);
    return res.data;
  },

  getProductSales: async (productId: number) => {
    const res = await api.get(`/products/${productId}/sales`);
    return res.data;
  },

  createProduct: async (payload: ProductCreateInput): Promise<Product> => {
    const res = await api.post<Product>('/products', payload);
    return res.data;
  },

  checkProductDuplicates: async (items: ExtractedProductItem[]): Promise<ProductDuplicateCheckResponse> => {
    const res = await api.post<ProductDuplicateCheckResponse>('/products/check-duplicates', { items });
    return res.data;
  },

  extractProductsFromImage: async (file: File): Promise<DocumentExtractResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<DocumentExtractResponse>('/products/extract-from-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return res.data;
  },

  // Reports
  getMonthlyRevenueReport: async (): Promise<ReportSummary> => {
    const res = await api.get<ReportSummary>('/reports/revenue');
    return res.data;
  },

  getCategoryPerformanceReport: async (): Promise<ReportSummary> => {
    const res = await api.get<ReportSummary>('/reports/category-performance');
    return res.data;
  },

  getProductPerformanceReport: async (): Promise<ReportSummary> => {
    const res = await api.get<ReportSummary>('/reports/product-performance');
    return res.data;
  },

  getSalesInventoryReport: async (): Promise<ReportSummary> => {
    const res = await api.get<ReportSummary>('/reports/sales-inventory');
    return res.data;
  },

  getCrossModuleInsights: async (): Promise<CrossModuleInsight[]> => {
    const res = await api.get<CrossModuleInsight[]>('/reports/insights');
    return res.data;
  },

  // AI Analyst & Agent Intelligence Layer
  runAnalysis: async (query: string, analysis_type?: string, conversation_id?: string, current_route?: string, selected_context?: any): Promise<AnalysisRunResponse> => {
    const res = await api.post<AnalysisRunResponse>('/analysis/run', { query, analysis_type, conversation_id, current_route, selected_context });
    return res.data;
  },

  agentChat: async (
    query: string,
    conversation_id?: string,
    current_route?: string,
    selected_context?: any,
    signal?: AbortSignal
  ) => {
    const res = await api.post(
      '/agent/chat',
      { query, conversation_id, current_route, selected_context },
      { signal }
    );
    return res.data;
  },

  getConversationHistory: async (conversation_id: string) => {
    const res = await api.get(`/agent/conversations/${conversation_id}`);
    return res.data;
  },

  getAvailableTools: async () => {
    const res = await api.get('/agent/tools');
    return res.data;
  },

  explainContextualElement: async (payload: ContextualExplainRequest): Promise<ContextualExplainResponse> => {
    const res = await api.post<ContextualExplainResponse>('/agent/contextual-explain', payload);
    return res.data;
  },

  // Document & Canvas Exports (PPTX, DOCX, XLSX, PDF, PNG)
  exportDocument: async (payload: any): Promise<void> => {
    const res = await api.post('/export/generate', payload, {
      responseType: 'blob'
    });

    // Extract filename from header if available
    const disposition = res.headers['content-disposition'] || '';
    let filename = `InsightFlow_Export.${payload.format || 'pdf'}`;
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }

    // Trigger browser file download
    const contentType = (res.headers['content-type'] as string) || 'application/octet-stream';
    const blob = new Blob([res.data], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
};
