import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Search,
  Bell,
  Menu,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { GlobalSearch } from './GlobalSearch';
import { useAIAssistant } from '../context/AIAssistantContext';

interface HeaderProps {
  onOpenSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSidebar }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { toggleSidebar } = useAIAssistant();
  const location = useLocation();

  // Get current section name
  const path = location.pathname.replace('/', '') || 'dashboard';
  const pageTitles: Record<string, string> = {
    dashboard: 'Dashboard',
    sales: 'Sales Analytics',
    inventory: 'Inventory Monitoring',
    customers: 'Customer Intelligence',
    products: 'Product Catalogue & Margin',
    reports: 'Business Reports',
    'ai-analyst': 'AI Analyst Workspace',
  };

  const currentTitle = pageTitles[path] || 'Overview';

  return (
    <>
      <header className="h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200/80 sticky top-0 z-30 px-4 lg:px-8 flex items-center justify-between">
        {/* Left: Mobile hamburger & Breadcrumbs */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenSidebar}
            className="p-2 -ml-2 text-slate-500 hover:text-slate-700 rounded-lg lg:hidden hover:bg-slate-100"
          >
            <Menu className="w-5 h-5" />
          </button>

          <nav className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
            <span className="text-slate-400">InsightFlow</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-slate-800 font-semibold">{currentTitle}</span>
          </nav>
        </div>

        {/* Right: Search, Notifications, Profile */}
        <div className="flex items-center space-x-2.5">
          {/* Global Search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center space-x-2 px-3 py-1.5 text-xs text-slate-400 bg-slate-50 hover:bg-slate-100 hover:text-slate-600 rounded-lg border border-slate-200/80 transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Search records...</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded">
              ⌘K
            </kbd>
          </button>

          {/* AI Assistant Button (Persistent Header Trigger) */}
          <button
            onClick={toggleSidebar}
            className="flex items-center space-x-2 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg shadow-xs transition-all cursor-pointer group"
            title="Open Cross-Application AI Assistant"
          >
            <Sparkles className="w-3.5 h-3.5 text-white/90 group-hover:rotate-12 transition-transform" />
            <span className="hidden sm:inline">AI Assistant</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-white/20 text-white">
              Agent
            </span>
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg relative transition-colors"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600"></span>
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">Notifications</span>
                  <span className="text-[11px] text-blue-600 font-medium">3 unread</span>
                </div>
                <div className="divide-y divide-slate-50 text-xs">
                  <div className="p-3 hover:bg-slate-50 flex items-start space-x-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-slate-800">Critical Stock Warning</div>
                      <div className="text-slate-500 text-[11px]">Wireless Noise-Canceling Earbuds below threshold (4 units).</div>
                    </div>
                  </div>
                  <div className="p-3 hover:bg-slate-50 flex items-start space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-slate-800">New High-Value Account</div>
                      <div className="text-slate-500 text-[11px]">Sarah Jenkins crossed $1,500 lifetime spend.</div>
                    </div>
                  </div>
                  <div className="p-3 hover:bg-slate-50 flex items-start space-x-2.5">
                    <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-slate-800">Database Seed Validated</div>
                      <div className="text-slate-500 text-[11px]">210 orders & 30 products verified with deterministic checks.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User profile menu */}
          <div className="relative pl-1">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center space-x-2 p-1 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-semibold text-xs flex items-center justify-center border-2 border-white shadow-2xs">
                JD
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-semibold text-slate-800 leading-tight">Jane Doe</div>
                <div className="text-[10px] text-slate-600 leading-tight">Head of Analytics</div>
              </div>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 text-xs">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="font-semibold text-slate-900">Jane Doe</div>
                  <div className="text-slate-500 text-[11px]">jane.doe@insightflow.ai</div>
                </div>
                <div className="py-1">
                  <div className="px-3 py-1.5 text-slate-700 hover:bg-slate-50 cursor-pointer">Workspace Settings</div>
                  <div className="px-3 py-1.5 text-slate-700 hover:bg-slate-50 cursor-pointer">API Keys & Endpoints</div>
                  <div className="px-3 py-1.5 text-slate-700 hover:bg-slate-50 cursor-pointer">Export Logs</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
};
