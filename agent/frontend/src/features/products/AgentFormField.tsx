import React from 'react';
import { CheckCircle2, AlertCircle, Sparkles, AlertTriangle } from 'lucide-react';

export interface AgentFormFieldProps {
  label: string;
  name: string;
  required?: boolean;
  isActive?: boolean;
  isCompleted?: boolean;
  hasError?: string | null;
  isUncertain?: boolean;
  hint?: string;
  children: React.ReactNode;
}

export const AgentFormField: React.FC<AgentFormFieldProps> = ({
  label,
  name,
  required = false,
  isActive = false,
  isCompleted = false,
  hasError = null,
  isUncertain = false,
  hint,
  children
}) => {
  return (
    <div
      data-field-name={name}
      className={`relative p-2.5 rounded-xl border transition-all duration-300 ${
        isActive
          ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/70 shadow-sm'
          : hasError
          ? 'border-rose-300 bg-rose-50/30'
          : isCompleted
          ? 'border-emerald-300 bg-emerald-50/20'
          : isUncertain
          ? 'border-amber-300 bg-amber-50/20'
          : 'border-slate-200/90 bg-white'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <label
          htmlFor={name}
          className={`text-xs font-semibold flex items-center space-x-1 ${
            isActive
              ? 'text-emerald-900'
              : hasError
              ? 'text-rose-700'
              : isCompleted
              ? 'text-emerald-800'
              : 'text-slate-700'
          }`}
        >
          <span>{label}</span>
          {required && <span className="text-rose-500">*</span>}
        </label>

        {/* Status Indicators */}
        <div className="flex items-center space-x-1.5">
          {isActive && (
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white shadow-xs animate-pulse">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Agent Active</span>
            </span>
          )}

          {!isActive && isCompleted && (
            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Extracted</span>
            </span>
          )}

          {isUncertain && !hasError && (
            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200" title="Extracted value was flagged as uncertain from the document">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>Review</span>
            </span>
          )}

          {hasError && (
            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
              <AlertCircle className="w-3 h-3 text-rose-600" />
              <span>Invalid</span>
            </span>
          )}
        </div>
      </div>

      {/* The Wrapped Form Input */}
      <div>{children}</div>

      {/* Error or Hint message */}
      {hasError ? (
        <p className="text-[11px] text-rose-600 font-medium mt-1">{hasError}</p>
      ) : hint ? (
        <p className="text-[10px] text-slate-400 mt-1">{hint}</p>
      ) : null}
    </div>
  );
};
