import React from 'react';
import { Sparkles } from 'lucide-react';
import { SelectedObjectContext } from '../types';
import { useContextSelection } from '../context/ContextSelectionContext';
import { useAIAssistant } from '../context/AIAssistantContext';
import { useContextualAIDialog } from '../context/ContextualAIDialogContext';
import { ContextualElementSelection, ContextualElementType } from '../types';

interface AskAIButtonProps {
  objectContext: SelectedObjectContext;
  variant?: 'button' | 'icon' | 'badge' | 'chip';
  size?: 'xs' | 'sm' | 'md';
  prompt?: string;
  className?: string;
  label?: string;
  target?: 'dialog' | 'sidebar';
}

export const AskAIButton: React.FC<AskAIButtonProps> = ({
  objectContext,
  variant = 'button',
  size = 'sm',
  prompt,
  className = '',
  label = 'Ask AI about this',
  target = 'dialog'
}) => {
  const { askAboutObject } = useContextSelection();
  const { openSidebar } = useAIAssistant();
  const { openDialog } = useContextualAIDialog();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (target === 'sidebar') {
      askAboutObject(objectContext, prompt);
      openSidebar();
      return;
    }

    let elType: ContextualElementType = 'text';
    if (objectContext.type === 'chart') elType = 'chart';
    else if (objectContext.type === 'kpi') elType = 'metric';
    else if (
      objectContext.type === 'product' ||
      objectContext.type === 'order' ||
      objectContext.type === 'inventory' ||
      objectContext.type === 'customer'
    ) {
      elType = 'table_row';
    } else if (objectContext.type === 'report') {
      elType = 'recommendation';
    } else if (objectContext.type === 'text') {
      elType = 'paragraph';
    }

    const selection: ContextualElementSelection = {
      id: objectContext.id ? String(objectContext.id) : undefined,
      type: elType,
      title: objectContext.title,
      selectedText: objectContext.selected_text,
      surroundingContext: objectContext.surrounding_context,
      data: objectContext.data || objectContext.underlying_data || objectContext.fields,
      props: objectContext.fields,
      route: objectContext.route || window.location.pathname
    };

    openDialog(selection, prompt);
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleClick}
        title={`Ask AI about ${objectContext.title}`}
        className={`p-1.5 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all cursor-pointer ${className}`}
      >
        <Sparkles className="w-3.5 h-3.5" />
      </button>
    );
  }

  if (variant === 'chip') {
    return (
      <button
        onClick={handleClick}
        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 transition-colors cursor-pointer ${className}`}
      >
        <Sparkles className="w-3 h-3 text-blue-500" />
        <span>{label}</span>
      </button>
    );
  }

  if (variant === 'badge') {
    return (
      <button
        onClick={handleClick}
        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer ${className}`}
      >
        <Sparkles className="w-3 h-3 text-indigo-600" />
        <span>{label}</span>
      </button>
    );
  }

  const sizeClasses =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[10px]'
      : size === 'sm'
      ? 'px-2 py-1 text-xs'
      : 'px-3 py-1.5 text-xs';

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center space-x-1.5 font-medium rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all shadow-2xs hover:shadow-xs cursor-pointer ${sizeClasses} ${className}`}
    >
      <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
      <span>{label}</span>
    </button>
  );
};
