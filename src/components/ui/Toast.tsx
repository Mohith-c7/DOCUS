'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastAPI {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

interface ToastContextValue {
  toast: ToastAPI;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 3500;

// ─── Variant config ───────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<
  ToastVariant,
  { icon: string; borderColor: string; iconColor: string; labelColor: string }
> = {
  success: {
    icon: '✓',
    borderColor: 'var(--color-success-border)',
    iconColor: 'var(--color-success)',
    labelColor: 'var(--color-success)',
  },
  error: {
    icon: '✗',
    borderColor: 'var(--color-danger-border)',
    iconColor: 'var(--color-danger)',
    labelColor: 'var(--color-danger)',
  },
  info: {
    icon: 'ℹ',
    borderColor: 'var(--color-brand-muted)',
    iconColor: 'var(--color-brand)',
    labelColor: 'var(--color-brand)',
  },
};

// ─── Single Toast Item ────────────────────────────────────────────────────────

interface SingleToastProps {
  item: ToastItem;
  onClose: (id: string) => void;
}

function SingleToast({ item, onClose }: SingleToastProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trigger slide-in on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setVisible(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Auto-dismiss
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDismiss() {
    setVisible(false);
    // Allow the slide-out animation to finish before removing from DOM
    setTimeout(() => onClose(item.id), 300);
  }

  const config = VARIANT_STYLES[item.variant];

  const bgColor =
    item.variant === 'success'
      ? 'var(--color-success-bg)'
      : item.variant === 'error'
      ? 'var(--color-danger-bg)'
      : 'var(--color-brand-light)';

  return (
    <>
      <style>{`
        @keyframes toast-slide-in {
          from {
            opacity: 0;
            transform: translateX(110%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes toast-slide-out {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(110%);
          }
        }
      `}</style>
      <div
        role="alert"
        aria-live="polite"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          padding: '12px 14px',
          background: bgColor,
          border: `1px solid ${config.borderColor}`,
          borderRadius: 'var(--radius-lg)',
          boxShadow:
            '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.05)',
          minWidth: '280px',
          maxWidth: '360px',
          width: '100%',
          animation: visible
            ? 'toast-slide-in 0.28s cubic-bezier(0.21, 1.02, 0.73, 1) forwards'
            : 'toast-slide-out 0.25s ease forwards',
          willChange: 'transform, opacity',
        }}
      >
        {/* Icon */}
        <span
          style={{
            fontSize: '15px',
            fontWeight: 700,
            color: config.iconColor,
            lineHeight: 1,
            flexShrink: 0,
            marginTop: '1px',
            fontFamily: 'var(--font-sans)',
          }}
          aria-hidden="true"
        >
          {config.icon}
        </span>

        {/* Message */}
        <span
          style={{
            flex: 1,
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--color-text-primary)',
            lineHeight: 1.45,
          }}
        >
          {item.message}
        </span>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss notification"
          style={{
            flexShrink: 0,
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            padding: 0,
            transition: 'background 0.12s ease, color 0.12s ease',
            marginTop: '1px',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              'rgba(0,0,0,0.06)';
            (e.currentTarget as HTMLButtonElement).style.color =
              'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              'transparent';
            (e.currentTarget as HTMLButtonElement).style.color =
              'var(--color-text-muted)';
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, variant: ToastVariant) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => {
      const next = [...prev, { id, message, variant }];
      // Keep only the most recent MAX_TOASTS
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast: ToastAPI = {
    success: (message) => addToast(message, 'success'),
    error: (message) => addToast(message, 'error'),
    info: (message) => addToast(message, 'info'),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Portal-like fixed container: bottom-right, newest toast at bottom */}
      <div
        aria-label="Notifications"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: toasts.length === 0 ? 'none' : 'auto',
        }}
      >
        {toasts.map((item) => (
          <SingleToast key={item.id} item={item} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
