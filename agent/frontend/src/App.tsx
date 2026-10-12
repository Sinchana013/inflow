import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AIAssistantProvider } from './context/AIAssistantContext';
import { ContextSelectionProvider } from './context/ContextSelectionContext';
import { ContextualAIDialogProvider } from './context/ContextualAIDialogContext';
import { ProductAgentProvider } from './context/ProductAgentContext';
import { AppLayout } from './layouts/AppLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { SalesPage } from './features/sales/SalesPage';
import { InventoryPage } from './features/inventory/InventoryPage';
import { CustomersPage } from './features/customers/CustomersPage';
import { ProductsPage } from './features/products/ProductsPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { AIAnalystPage } from './features/ai-analyst/AIAnalystPage';

export function App() {
  return (
    <BrowserRouter>
      <ProductAgentProvider>
        <AIAssistantProvider>
          <ContextSelectionProvider>
            <ContextualAIDialogProvider>
              <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="sales" element={<SalesPage />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="ai-analyst" element={<AIAnalystPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </ContextualAIDialogProvider>
        </ContextSelectionProvider>
      </AIAssistantProvider>
    </ProductAgentProvider>
  </BrowserRouter>
  );
}

export default App;
