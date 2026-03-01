import React from 'react';
import clsx from 'clsx';
import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react';

function Skeleton() {
  return (
    <div className="w-full space-y-2 p-2">
      <div className="h-3 w-3/4 animate-pulse rounded bg-slate-700" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-slate-700" />
      <div className="h-3 w-5/6 animate-pulse rounded bg-slate-700" />
    </div>
  );
}

export function StatusMessage({ variant = 'info', title, description, onRetry }) {
  if (variant === 'loading') {
    return (
      <div className="space-y-2" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          <span>{title || 'Loading...'}</span>
        </div>
        <Skeleton />
      </div>
    );
  }

  const icon = {
    error: <AlertCircle className="h-5 w-5 text-rose-600" />,
    empty: <Inbox className="h-5 w-5 text-slate-500" />,
    info: <AlertCircle className="h-5 w-5 text-blue-600" />,
  }[variant];

  return (
    <div className={clsx(
      'flex items-center justify-between rounded-lg border px-4 py-3 text-sm',
      variant === 'error' && 'border-rose-300 bg-rose-100 text-rose-800',
      variant === 'empty' && 'flex-col gap-2 border-slate-300 bg-slate-100 text-slate-700 py-6',
      variant === 'info' && 'border-blue-300 bg-blue-100 text-blue-800'
    )}>
      <div className={clsx('flex items-center gap-3', variant === 'empty' && 'flex-col text-center')}>
        {icon}
        <div>
          <p className="font-semibold">{title}</p>
          {description && <p className="mt-0.5 text-xs opacity-80">{description}</p>}
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-md border border-blue-300 bg-white px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
        >
          Retry
        </button>
      )}
    </div>
  );
}
