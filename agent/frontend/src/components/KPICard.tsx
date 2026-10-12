import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { KPICardData } from '../types';

interface KPICardProps {
  data: KPICardData;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const KPICard: React.FC<KPICardProps> = ({ data, icon, onClick, className = '' }) => {
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs transition-all ${
        isClickable ? 'cursor-pointer hover:border-blue-400 hover:shadow-sm' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between text-slate-500 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{data.title}</span>
        {icon && <div className="text-slate-400 p-1.5 rounded-lg bg-slate-50 border border-slate-100">{icon}</div>}
      </div>

      <div className="flex items-baseline space-x-2">
        <span className="text-2xl font-bold text-slate-900 tracking-tight">{data.formatted_value}</span>
      </div>

      {(data.change_percentage !== undefined && data.change_percentage !== null) || data.previous_value !== undefined ? (
        <div className="mt-2.5 flex items-center text-xs space-x-1.5">
          {data.trend === 'up' && (
            <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              {data.change_percentage !== null && data.change_percentage !== undefined
                ? `${data.change_percentage > 0 ? '+' : ''}${data.change_percentage}%`
                : 'Up'}
            </span>
          )}
          {data.trend === 'down' && (
            <span className="inline-flex items-center text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-medium">
              <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
              {data.change_percentage !== null && data.change_percentage !== undefined
                ? `${data.change_percentage}%`
                : 'Down'}
            </span>
          )}
          {data.trend === 'neutral' && (
            <span className="inline-flex items-center text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
              <Minus className="w-3 h-3 mr-0.5" />
              0.0%
            </span>
          )}
          <span className="text-slate-400 font-normal truncate">{data.period_label}</span>
        </div>
      ) : (
        <div className="mt-2.5 text-xs text-slate-400 font-normal">
          {data.period_label}
        </div>
      )}
    </div>
  );
};
