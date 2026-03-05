import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const AppModalContext = createContext(null);

export function AppModalProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const closeDialog = useCallback((result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setDialog(null);
  }, []);

  const showAlert = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        type: 'alert',
        title: options.title || 'Notice',
        message,
        confirmText: options.confirmText || 'OK',
      });
    });
  }, []);

  const showConfirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        type: 'confirm',
        title: options.title || 'Please confirm',
        message,
        confirmText: options.confirmText || 'Confirm',
      });
    });
  }, []);

  const value = useMemo(() => ({ showAlert, showConfirm }), [showAlert, showConfirm]);

  return (
    <AppModalContext.Provider value={value}>
      {children}

      {dialog && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            closeDialog(dialog.type === 'alert' ? true : false);
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{dialog.title}</h3>
              <button
                type="button"
                onClick={() => closeDialog(dialog.type === 'alert' ? true : false)}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  padding: '0 10px',
                }}
                aria-label="Close"
              >
                ✖
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 20, opacity: 0.9 }}>{dialog.message}</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                <button
                  type="button"
                  className="account-button"
                  style={{ border: '1px solid #3a3a3a' }}
                  onClick={() => closeDialog(true)}
                >
                  {dialog.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppModalContext.Provider>
  );
}

export function useAppModal() {
  const ctx = useContext(AppModalContext);
  if (!ctx) {
    throw new Error('useAppModal must be used within AppModalProvider');
  }
  return ctx;
}
