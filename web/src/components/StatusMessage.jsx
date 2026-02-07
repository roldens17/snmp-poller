import React from 'react';
import clsx from 'clsx';
import { AlertCircle, Inbox } from 'lucide-react';

// Premium "Gold Skeleton" for loading states
function GoldSkeleton() {
    return (
        <div className="w-full space-y-3 p-4">
            <div className="h-4 bg-white/5 rounded w-3/4 animate-shimmer-gold relative overflow-hidden"></div>
            <div className="h-4 bg-white/5 rounded w-1/2 animate-shimmer-gold relative overflow-hidden"></div>
            <div className="h-4 bg-white/5 rounded w-5/6 animate-shimmer-gold relative overflow-hidden"></div>
        </div>
    );
}

export function StatusMessage({ variant = 'info', title, description, onRetry }) {
    if (variant === 'loading') {
        return (
            <div className="space-y-3" role="status" aria-live="polite">
                <GoldSkeleton />
                {title && <p className="text-xs text-gray-400">{title}</p>}
            </div>
        );
    }

    const icons = {
        error: <AlertCircle className="w-5 h-5 text-red-400" />,
        empty: <Inbox className="w-5 h-5 text-gray-400" />,
        info: <AlertCircle className="w-5 h-5 text-gold" />
    };

    return (
        <div className={clsx(
            "flex items-center justify-between px-4 py-3 rounded-lg border text-sm backdrop-blur-md transition-all duration-300",
            variant === 'error' && "border-red-500/30 bg-red-900/10 text-red-100 shadow-[0_0_15px_rgba(239,68,68,0.1)]",
            variant === 'empty' && "border-white/5 bg-white/5 text-gray-400 flex-col py-8 gap-2",
            variant === 'info' && "border-gold/20 bg-gold/5 text-gray-200"
        )}>
            <div className={clsx("flex items-center space-x-3", variant === 'empty' && "flex-col space-x-0 gap-2")}>
                {icons[variant]}
                <div className={clsx(variant === 'empty' && "text-center")}>
                    <p className="font-semibold">{title}</p>
                    {description && <p className="text-xs opacity-60 mt-0.5">{description}</p>}
                </div>
            </div>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="text-xs font-semibold text-gold bg-gold/10 hover:bg-gold/20 border border-gold/20 rounded px-4 py-1.5 transition uppercase tracking-wider hover:shadow-[0_0_10px_rgba(212,175,55,0.2)]"
                >
                    Retry
                </button>
            )}
        </div>
    );
}
