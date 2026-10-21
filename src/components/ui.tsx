import type { ReactNode } from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-eco-200 border-t-eco-600 rounded-full animate-spin" style={{ borderWidth: '3px' }} />
        <p className="text-eco-600 text-sm font-medium">{message}</p>
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-clay-100 flex items-center justify-center mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-clay-500">
          <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <p className="text-eco-800 font-medium mb-1">Environmental data temporarily unavailable</p>
      <p className="text-sm text-eco-500 max-w-md mb-4">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary text-sm">
          Retry
        </button>
      )}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-eco-900 tracking-tight">{title}</h1>
      {subtitle && <p className="text-eco-500 mt-1 text-sm">{subtitle}</p>}
    </div>
  );
}

export function Badge({ children, color = 'eco' }: { children: ReactNode; color?: 'eco' | 'warm' | 'clay' | 'amber' | 'red' }) {
  const colors = {
    eco: 'bg-eco-100 text-eco-700',
    warm: 'bg-warm-100 text-warm-700',
    clay: 'bg-clay-100 text-clay-500',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}

export function formatValue(val: number | null, unit: string = '', decimals = 1): string {
  if (val === null || val === undefined || isNaN(val)) return 'Unavailable';
  return `${val.toFixed(decimals)}${unit ? ' ' + unit : ''}`;
}
