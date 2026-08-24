import React from 'react';

interface DocumentCardProps {
  document: {
    id: string;
    originalFileName: string;
    fileType: string;
    fileSizeBytes: number;
    status: string;
    createdAt: string;
    summaries?: Array<{ length: string; title: string }>;
  };
  onSelect: (id: string) => void;
  onAddToCollection?: (id: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentCard({ document, onSelect, onAddToCollection }: DocumentCardProps) {
  const isPdf = document.fileType === 'PDF';
  const displayTitle = document.summaries?.[0]?.title || document.originalFileName;

  return (
    <div
      className="card"
      onClick={() => onSelect(document.id)}
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)';
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '6px',
            background: isPdf ? '#fff3f0' : '#f0f7ff',
            border: `1px solid ${isPdf ? '#ffd5cc' : '#cce0ff'}`,
            color: isPdf ? '#c0392b' : '#1a56db',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isPdf ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            )}
          </div>

          {onAddToCollection && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToCollection(document.id);
              }}
              className="btn btn-ghost"
              style={{ padding: '4px 8px', fontSize: '11px' }}
              title="Add to Collection"
            >
              + Folder
            </button>
          )}
        </div>

        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayTitle}
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '12px' }}>
          {document.originalFileName}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          {formatFileSize(document.fileSizeBytes)}
        </span>
        <span className={`badge ${document.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
          {document.status === 'COMPLETED' ? 'Ready' : document.status}
        </span>
      </div>
    </div>
  );
}
