import React, { createContext, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const pushToast = (message, type = 'success', durationMs = 2800) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    if (durationMs > 0) {
      setTimeout(() => removeToast(id), durationMs);
    }
  };

  const api = useMemo(() => ({
    success: (msg, ms) => pushToast(msg, 'success', ms),
    error: (msg, ms) => pushToast(msg, 'error', ms),
    info: (msg, ms) => pushToast(msg, 'info', ms),
  }), []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed right-4 top-4 z-[1000] flex flex-col gap-2">
        {toasts.map(t => {
          const style =
            t.type === 'error'
              ? 'border-red-500/40 bg-red-500/10 text-red-300'
              : t.type === 'info'
                ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                : 'border-green-500/40 bg-green-500/10 text-green-300';
          return (
            <div key={t.id} className={`min-w-[260px] max-w-[420px] px-4 py-3 rounded-xl border shadow-xl ${style}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">{t.message}</span>
                <button onClick={() => removeToast(t.id)} className="text-xs opacity-70 hover:opacity-100">Dismiss</button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      success: (msg) => console.log(msg),
      error: (msg) => console.error(msg),
      info: (msg) => console.info(msg),
    };
  }
  return ctx;
}
