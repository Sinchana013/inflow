import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { AIAssistantSidebar } from '../components/AIAssistantSidebar';
import { TextSelectionToolbar } from '../components/TextSelectionToolbar';
import { ContextualAIDialog } from '../components/ContextualAIDialog';
import { FloatingProductAgent } from '../features/products/FloatingProductAgent';

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Persistent Left Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header with Breadcrumbs & AI Assistant trigger */}
        <Header onOpenSidebar={() => setSidebarOpen(true)} />

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Floating text selection toolbar */}
      <TextSelectionToolbar />

      {/* Persistent Right-Side AI Assistant Sidebar */}
      <AIAssistantSidebar />

      {/* Universal Contextual AI Dialog for Any Answer Element */}
      <ContextualAIDialog />

      {/* Draggable Floating Product Creation Agent Window */}
      <FloatingProductAgent />
    </div>
  );
};
