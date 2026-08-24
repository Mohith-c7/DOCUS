'use client';

import React from 'react';

// ─── Shimmer keyframes injected once via a shared style tag ──────────────────

const SHIMMER_STYLE = `
  @keyframes skeleton-shimmer {
    0% {
      background-position: -400px 0;
    }
    100% {
      background-position: 400px 0;
    }
  }

  .skeleton-shimmer {
    background: linear-gradient(
      90deg,
      var(--color-border)       25%,
      var(--color-surface-tertiary) 50%,
      var(--color-border)       75%
    );
    background-size: 800px 100%;
    animation: skeleton-shimmer 1.6s ease-in-out infinite;
    border-radius: var(--radius-sm);
  }
`;

function ShimmerStyles() {
  return <style>{SHIMMER_STYLE}</style>;
}

// ─── SkeletonText ─────────────────────────────────────────────────────────────

export interface SkeletonTextProps {
  width?: string;
  height?: string;
}

/**
 * A single animated shimmer text placeholder line.
 */
export function SkeletonText({
  width = '100%',
  height = '14px',
}: SkeletonTextProps) {
  return (
    <>
      <ShimmerStyles />
      <div
        className="skeleton-shimmer"
        aria-hidden="true"
        style={{
          width,
          height,
          borderRadius: 'var(--radius-sm)',
          flexShrink: 0,
        }}
      />
    </>
  );
}

// ─── SkeletonCard ─────────────────────────────────────────────────────────────

export interface SkeletonCardProps {
  /** Number of text line rows to render inside the card. Defaults to 4. */
  lines?: number;
}

/**
 * A card-shaped skeleton with a shimmer header block and configurable text lines.
 */
export function SkeletonCard({ lines = 4 }: SkeletonCardProps) {
  return (
    <>
      <ShimmerStyles />
      <div
        className="card"
        aria-hidden="true"
        aria-label="Loading…"
        style={{
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {/* Header block */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            className="skeleton-shimmer"
            style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', flexShrink: 0 }}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <SkeletonText width="55%" height="14px" />
            <SkeletonText width="35%" height="12px" />
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--color-border)', margin: '2px 0' }} />

        {/* Content lines */}
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonText
            key={i}
            width={i === lines - 1 ? '70%' : '100%'}
            height="13px"
          />
        ))}
      </div>
    </>
  );
}

// ─── SkeletonDocumentRow ──────────────────────────────────────────────────────

/**
 * A skeleton row matching the shape of a PastSummariesModal document row:
 * file-type icon block | filename + meta | arrow chevron.
 */
export function SkeletonDocumentRow() {
  return (
    <>
      <ShimmerStyles />
      <div
        aria-hidden="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '13px 24px',
          borderBottom: '1px solid var(--color-border)',
          gap: '12px',
        }}
      >
        {/* Left: icon + text info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
          {/* File icon block */}
          <div
            className="skeleton-shimmer"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-md)',
              flexShrink: 0,
            }}
          />

          {/* Text info */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <SkeletonText width="60%" height="14px" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SkeletonText width="40px" height="11px" />
              <SkeletonText width="60px" height="11px" />
              <SkeletonText width="42px" height="18px" />
            </div>
          </div>
        </div>

        {/* Right: arrow placeholder */}
        <div
          className="skeleton-shimmer"
          style={{ width: '14px', height: '14px', borderRadius: '2px', flexShrink: 0 }}
        />
      </div>
    </>
  );
}

// ─── SkeletonSummaryContent ───────────────────────────────────────────────────

/**
 * Skeleton for the full summary content card, matching a 3-section layout:
 * header, primary body block, and two supporting detail blocks.
 */
export function SkeletonSummaryContent() {
  return (
    <>
      <ShimmerStyles />
      <div
        className="card card-elevated"
        aria-hidden="true"
        aria-label="Loading summary…"
        style={{ overflow: 'hidden' }}
      >
        {/* Section 1 – Card header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            className="skeleton-shimmer"
            style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-md)', flexShrink: 0 }}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <SkeletonText width="40%" height="15px" />
            <SkeletonText width="25%" height="11px" />
          </div>
          {/* Right-side badge placeholder */}
          <div
            className="skeleton-shimmer"
            style={{ width: '64px', height: '22px', borderRadius: '3px', flexShrink: 0 }}
          />
        </div>

        {/* Section 2 – Main summary body */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <SkeletonText width="30%" height="13px" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginTop: '4px' }}>
            <SkeletonText width="100%" height="13px" />
            <SkeletonText width="100%" height="13px" />
            <SkeletonText width="95%" height="13px" />
            <SkeletonText width="100%" height="13px" />
            <SkeletonText width="80%" height="13px" />
          </div>
        </div>

        {/* Section 3 – Supporting detail blocks (two columns) */}
        <div
          style={{
            padding: '20px 24px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
          }}
        >
          {/* Detail block A */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            <SkeletonText width="45%" height="12px" />
            <SkeletonText width="100%" height="13px" />
            <SkeletonText width="90%" height="13px" />
            <SkeletonText width="75%" height="13px" />
          </div>

          {/* Detail block B */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            <SkeletonText width="45%" height="12px" />
            <SkeletonText width="100%" height="13px" />
            <SkeletonText width="85%" height="13px" />
            <SkeletonText width="60%" height="13px" />
          </div>
        </div>
      </div>
    </>
  );
}
