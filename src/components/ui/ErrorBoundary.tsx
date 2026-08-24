'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Optional custom fallback. If provided, replaces the default error UI.
   * Receives the error and a reset callback.
   */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * `ErrorBoundary` catches unhandled JavaScript errors anywhere in its child
 * component tree and renders a clean fallback UI instead of crashing the page.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <SomeDangerousComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to an error reporting service if available
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  reset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (!hasError || !error) {
      return children;
    }

    // Custom fallback
    if (fallback) {
      return fallback(error, this.reset);
    }

    // ── Default fallback UI ────────────────────────────────────────────────
    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '220px',
          padding: '24px',
        }}
      >
        <div
          className="card"
          style={{
            maxWidth: '480px',
            width: '100%',
            padding: '32px 28px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              background: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-danger)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          {/* Title */}
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.015em',
              margin: 0,
            }}
          >
            Something went wrong
          </h2>

          {/* Error message */}
          <p
            style={{
              fontSize: '13px',
              color: 'var(--color-text-muted)',
              lineHeight: 1.55,
              margin: 0,
              maxWidth: '340px',
            }}
          >
            {error.message ||
              'An unexpected error occurred while rendering this section.'}
          </p>

          {/* Error name badge (non-production detail) */}
          {error.name && error.name !== 'Error' && (
            <code
              style={{
                display: 'inline-block',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                background: 'var(--color-surface-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '3px 8px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {error.name}
            </code>
          )}

          {/* Reset button */}
          <button
            className="btn btn-primary"
            onClick={this.reset}
            style={{ marginTop: '4px' }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
