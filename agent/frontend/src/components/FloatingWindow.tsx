import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Minus, Maximize2, GripVertical } from 'lucide-react';

export interface FloatingWindowProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  headerPrefix?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  initialWidth?: number;
  showMinimize?: boolean;
  isMinimized?: boolean;
  onToggleMinimize?: (minimized: boolean) => void;
  className?: string;
  bodyClassName?: string;
  id?: string;
}

const MAX_WIDTH_CLASSES: Record<string, string> = {
  sm: 'sm:w-[380px]',
  md: 'sm:w-[480px]',
  lg: 'sm:w-[560px]',
  xl: 'sm:w-[640px]',
  '2xl': 'sm:w-[720px]',
  '3xl': 'sm:w-[840px]',
  '4xl': 'sm:w-[960px]',
};

const APPROX_WIDTH_PX: Record<string, number> = {
  sm: 380,
  md: 480,
  lg: 560,
  xl: 640,
  '2xl': 720,
  '3xl': 840,
  '4xl': 960,
};

export const FloatingWindow: React.FC<FloatingWindowProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  headerPrefix,
  headerActions,
  children,
  footer,
  maxWidth = '2xl',
  initialWidth,
  showMinimize = true,
  isMinimized: controlledIsMinimized,
  onToggleMinimize,
  className = '',
  bodyClassName = '',
  id,
}) => {
  const [internalMinimized, setInternalMinimized] = useState(false);
  const isMinimized = controlledIsMinimized !== undefined ? controlledIsMinimized : internalMinimized;

  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const windowRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    windowX: number;
    windowY: number;
  }>({ pointerX: 0, pointerY: 0, windowX: 0, windowY: 0 });

  // Clamp coordinates within visible viewport boundaries
  const clampPosition = useCallback(
    (x: number, y: number, currentWidth?: number) => {
      const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 800;

      const expectedW =
        currentWidth ||
        windowRef.current?.offsetWidth ||
        initialWidth ||
        APPROX_WIDTH_PX[maxWidth] ||
        640;

      const actualW = Math.min(expectedW, winW - 16);

      // Clamp X so the window stays strictly within viewport margins
      const minX = 8;
      const maxX = Math.max(minX, winW - actualW - 8);
      const clampedX = Math.max(minX, Math.min(x, maxX));

      // Clamp Y so header is always visible and accessible
      const minY = 8;
      const maxY = Math.max(minY, winH - 60);
      const clampedY = Math.max(minY, Math.min(y, maxY));

      return { x: clampedX, y: clampedY };
    },
    [maxWidth, initialWidth]
  );

  // Initialize position centered in viewport on first opening
  useEffect(() => {
    if (isOpen && position === null) {
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const targetWidth = Math.min(
        initialWidth || APPROX_WIDTH_PX[maxWidth] || 640,
        winW - 32
      );
      const targetHeight = isMinimized ? 52 : Math.min(640, winH - 80);

      const startX = Math.max(16, (winW - targetWidth) / 2);
      const startY = Math.max(24, Math.min(70, (winH - targetHeight) / 2));

      setPosition(clampPosition(startX, startY, targetWidth));
    }
  }, [isOpen, position, maxWidth, initialWidth, isMinimized, clampPosition]);

  // Adjust position when viewport resizes to prevent going off-screen
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return prev;
        return clampPosition(prev.x, prev.y);
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, clampPosition]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag on left click or touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // Do not initiate drag if clicking buttons, inputs, links, or controls
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select, a, [data-no-drag]')) {
      return;
    }

    e.preventDefault();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignored if pointer capture not supported
    }

    isDraggingRef.current = true;
    setIsDragging(true);

    const currentX = position?.x ?? 20;
    const currentY = position?.y ?? 20;

    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      windowX: currentX,
      windowY: currentY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();

    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;

    const newX = dragStartRef.current.windowX + dx;
    const newY = dragStartRef.current.windowY + dy;

    setPosition(clampPosition(newX, newY));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
  };

  const toggleMinimize = () => {
    const next = !isMinimized;
    if (onToggleMinimize) {
      onToggleMinimize(next);
    } else {
      setInternalMinimized(next);
    }
  };

  if (!isOpen) return null;

  const widthClass = MAX_WIDTH_CLASSES[maxWidth] || 'sm:w-[720px]';

  // Fallback initial coordinates while calculating
  const posX = position?.x ?? 24;
  const posY = position?.y ?? 24;

  return (
    <div
      id={id}
      ref={windowRef}
      style={{
        left: `${posX}px`,
        top: `${posY}px`,
      }}
      className={`fixed z-50 w-[calc(100vw-24px)] ${
        isMinimized ? 'sm:w-[360px]' : widthClass
      } bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-200/90 flex flex-col overflow-hidden transition-shadow duration-150 ${
        isDragging ? 'select-none ring-2 ring-blue-500/30 shadow-3xl' : ''
      } ${className}`}
    >
      {/* Draggable Title Bar / Header */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className={`flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/90 backdrop-blur-xs select-none touch-none transition-colors ${
          isDragging ? 'cursor-grabbing bg-slate-100/90' : 'cursor-grab hover:bg-slate-100/70'
        }`}
        title="Click and drag to move window"
      >
        {/* Left: Drag Handle + Prefix + Title + Subtitle */}
        <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0 mr-2">
          <div
            className="text-slate-400 hover:text-slate-600 p-0.5 cursor-grab active:cursor-grabbing shrink-0"
            title="Drag Handle"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          {headerPrefix && <div className="shrink-0">{headerPrefix}</div>}

          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight truncate">
                {title}
              </h3>
            </div>
            {!isMinimized && subtitle && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: Window Controls */}
        <div className="flex items-center space-x-1 shrink-0" data-no-drag>
          {headerActions}

          {showMinimize && (
            <button
              type="button"
              onClick={toggleMinimize}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              title={isMinimized ? 'Expand window' : 'Minimize window'}
              aria-label={isMinimized ? 'Expand window' : 'Minimize window'}
            >
              {isMinimized ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <Minus className="w-4 h-4" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Close window (Esc)"
            aria-label="Close window"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Window Body & Footer (Hidden when minimized) */}
      {!isMinimized && (
        <>
          <div
            className={`p-4 sm:p-5 overflow-y-auto max-h-[calc(85vh-90px)] flex-1 text-slate-800 ${bodyClassName}`}
          >
            {children}
          </div>

          {footer && (
            <div className="shrink-0 border-t border-slate-100 bg-slate-50/70">
              {footer}
            </div>
          )}
        </>
      )}
    </div>
  );
};
