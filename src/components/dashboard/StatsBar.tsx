import React from 'react';

interface StatsBarProps {
  totalDocuments: number;
  totalSummaries: number;
  documentsThisMonth: number;
}

export function StatsBar({ totalDocuments, totalSummaries, documentsThisMonth }: StatsBarProps) {
  return (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
      <div className="stat-card">
        <div className="section-label">Total Documents</div>
        <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}>
          {totalDocuments.toLocaleString()}
        </div>
      </div>
      <div className="stat-card">
        <div className="section-label">Summaries Generated</div>
        <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-brand)', letterSpacing: '-0.03em' }}>
          {totalSummaries.toLocaleString()}
        </div>
      </div>
      <div className="stat-card">
        <div className="section-label">Processed This Month</div>
        <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-success)', letterSpacing: '-0.03em' }}>
          {documentsThisMonth.toLocaleString()}
        </div>
      </div>
    </div>
  );
}
