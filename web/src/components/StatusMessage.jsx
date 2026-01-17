import React from 'react';
import clsx from 'clsx';
import { Loader2, AlertCircle, Inbox } from 'lucide-react';

export function StatusMessage({ variant = 'info', title, description, onRetry }) {
    const icons = {
        loading: <Loader2 className="w-5 h-5 animate-spin text-gold" />,
        error: <AlertCircle className="w-5 h-5 text-red-400" />,
        empty: <Inbox className="w-5 h-5 text-gray-400" />,
        info: <AlertCircle className="w-5 h-5 text-gold" />
    };

    return (
        <div className={clsx(
            "flex items-center justify-between px-4 py-3 rounded-lg border text-sm",
            variant === 'loading' && "border-gold/20 bg-gold/5 text-gold",
            variant === 'error' && "border-red-500/30 bg-red-900/20 text-red-100",
            variant === 'empty' && "border-white/10 bg-white/5 text-gray-300",
            variant === 'info' && "border-white/10 bg-white/5 text-gray-200"
        )}>
            <div className="flex items-center space-x-3">
                {icons[variant]}
                <div>
                    <p className="font-semibold">{title}</p>
                    {description && <p className="text-xs opacity-80">{description}</p>}
                </div>
            </div>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="text-xs font-semibold text-white bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded px-3 py-1 transition"
                >
                    Retry
                </button>
            )}
        </div>
    );
}
