import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className = '' }) => {
  const variantStyles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'in stock':
      return <Badge variant="success">{status}</Badge>;
    case 'processing':
    case 'low stock':
    case 'warning':
    case 'repeat':
      return <Badge variant="warning">{status}</Badge>;
    case 'cancelled':
    case 'out of stock':
    case 'critical':
      return <Badge variant="danger">{status}</Badge>;
    case 'high value':
      return <Badge variant="purple">{status}</Badge>;
    case 'new':
      return <Badge variant="info">{status}</Badge>;
    case 'returned':
      return <Badge variant="neutral">{status}</Badge>;
    case 'inactive':
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
};
