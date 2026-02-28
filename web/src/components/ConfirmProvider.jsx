import React, { createContext, useContext, useMemo, useState } from 'react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ open: false, message: '', resolve: null, title: 'Please confirm' });

  const ask = (message, title = 'Please confirm') => {
    return new Promise((resolve) => {
      setState({ open: true, message, resolve, title });
    });
  };

  const close = (result) => {
    if (state.resolve) state.resolve(result);
    setState({ open: false, message: '', resolve: null, title: 'Please confirm' });
  };

  const api = useMemo(() => ({ confirm: ask }), []);

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {state.open && (
        <div className="fixed inset-0 z-[1100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-gold/20 bg-rich-gray shadow-2xl p-5">
            <h3 className="text-lg font-semibold text-white mb-2">{state.title}</h3>
            <p className="text-sm text-gray-300 mb-5">{state.message}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => close(false)} className="px-4 py-2 rounded-lg border border-white/15 text-gray-300 hover:text-white hover:border-white/30">Cancel</button>
              <button onClick={() => close(true)} className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-400">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    return { confirm: (msg) => Promise.resolve(window.confirm(msg)) };
  }
  return ctx;
}
