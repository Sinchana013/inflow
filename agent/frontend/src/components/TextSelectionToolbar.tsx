import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useContextualAIDialog } from '../context/ContextualAIDialogContext';

export const TextSelectionToolbar: React.FC = () => {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string>('');
  const [surroundingText, setSurroundingText] = useState<string>('');
  const location = useLocation();
  const { openDialog } = useContextualAIDialog();

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setPosition(null);
        return;
      }

      const text = selection.toString().trim();
      if (text.length < 3) {
        setPosition(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Get surrounding context from parent element
      const parent = range.commonAncestorContainer.parentElement;
      const surrounding = parent ? parent.innerText.slice(0, 300) : text;

      setSelectedText(text);
      setSurroundingText(surrounding);
      setPosition({
        x: Math.max(10, rect.left + rect.width / 2),
        y: Math.max(10, rect.top + window.scrollY - 38)
      });
    };

    const handleMouseDown = (e: MouseEvent) => {
      // If clicking inside the toolbar, don't dismiss immediately
      const target = e.target as HTMLElement;
      if (target.closest('.text-selection-toolbar')) return;
      setPosition(null);
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  if (!position || !selectedText) return null;

  const handleAskAI = (e: React.MouseEvent) => {
    e.stopPropagation();
    openDialog(
      {
        type: 'paragraph',
        title: `Text selection: "${selectedText.slice(0, 36)}..."`,
        selectedText: selectedText,
        surroundingContext: surroundingText,
        route: location.pathname
      },
      `Explain and analyze this selected text: "${selectedText}"`
    );
    setPosition(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div
      className="text-selection-toolbar fixed z-50 transform -translate-x-1/2 flex items-center bg-slate-900 text-white rounded-lg px-2.5 py-1.5 shadow-xl text-xs font-medium space-x-1.5 cursor-pointer animate-in fade-in zoom-in-95 duration-150 hover:bg-slate-800"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onClick={handleAskAI}
    >
      <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
      <span>Ask AI about selected text</span>
    </div>
  );
};
