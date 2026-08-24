'use client';

import React, { useState, useEffect } from 'react';

interface PastDocument {
  id: string;
  originalFileName: string;
  fileType: string;
  fileSizeBytes: number;
  status: string;
  currentStage: string;
  createdAt: string;
  summaries?: Array<{
    length: string;
    title: string;
    summary: string;
  }>;
}

interface PastSummariesModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  anonymousSessionId?: string;
  onSelectDocument: (docId: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PastSummariesModal({
  isOpen,
  onClose,
  userId,
  anonymousSessionId,
  onSelectDocument,
}: PastSummariesModalProps) {
  const [documents, setDocuments] = useState<PastDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPastDocuments = async () => {
    setLoading(true);
    try {
      const param = userId
        ? `userId=${userId}`
        : anonymousSessionId
        ? `anonymousSessionId=${anonymousSessionId}`
        : '';
      const res = await fetch(`/api/documents?${param}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Failed to fetch past documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchPastDocuments();
  }, [isOpen, userId, anonymousSessionId]);

  if (!isOpen) return null;

  const filteredDocs = documents.filter((doc) =>
    doc.originalFileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        background: 'rgba(10, 37, 64, 0.4)',
        backdropFilter: 'blur(6px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: '660px',
        height: '75vh', maxHeight: '680px',
        background: '#ffffff',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeIn 0.18s ease',
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.015em', marginBottom: '3px' }}>
              Past summaries
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              {documents.length > 0 ? `${documents.length} document${documents.length !== 1 ? 's' : ''} processed` : 'Your processed documents'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '30px', height: '30px',
              border: 'none', borderRadius: '6px',
              background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-text-muted)',
              transition: 'background 0.12s ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-secondary)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search bar */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by file name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 33px',
                background: 'var(--color-surface-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                fontSize: '13px',
                color: 'var(--color-text-primary)',
                outline: 'none',
                transition: 'border-color 0.12s ease, box-shadow 0.12s ease',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,91,255,0.12)'; e.currentTarget.style.background = '#fff'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = 'var(--color-surface-secondary)'; }}
            />
          </div>
        </div>

        {/* Document list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px' }}>
              <div className="page-spinner" style={{ width: '28px', height: '28px', borderWidth: '2px' }} />
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Loading documents…</span>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', textAlign: 'center', padding: '24px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '10px',
                background: 'var(--color-surface-secondary)', border: '1px solid var(--color-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '14px', color: 'var(--color-text-muted)',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                {searchQuery ? 'No matching documents' : 'No documents yet'}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                {searchQuery ? 'Try a different search term' : 'Upload a document to generate your first summary.'}
              </p>
            </div>
          ) : (
            filteredDocs.map((doc, index) => (
              <div
                key={doc.id}
                onClick={() => { onSelectDocument(doc.id); onClose(); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '13px 24px',
                  cursor: 'pointer',
                  borderBottom: index < filteredDocs.length - 1 ? '1px solid var(--color-border)' : 'none',
                  transition: 'background 0.1s ease',
                  gap: '12px',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-secondary)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {/* File icon + info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <div style={{
                    width: '38px', height: '38px',
                    borderRadius: '6px',
                    background: doc.fileType === 'PDF' ? '#fff3f0' : '#f0f7ff',
                    border: `1px solid ${doc.fileType === 'PDF' ? '#ffd5cc' : '#cce0ff'}`,
                    color: doc.fileType === 'PDF' ? '#c0392b' : '#1a56db',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {doc.fileType === 'PDF' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                        <line x1="9" y1="15" x2="15" y2="15" /><line x1="9" y1="11" x2="11" y2="11" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                      </svg>
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      fontSize: '14px', fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      marginBottom: '3px',
                    }}>
                      {doc.originalFileName}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {formatFileSize(doc.fileSizeBytes)}
                      </span>
                      <span style={{ color: 'var(--color-border-strong)', fontSize: '10px' }}>·</span>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {formatDate(doc.createdAt)}
                      </span>
                      <span style={{ color: 'var(--color-border-strong)', fontSize: '10px' }}>·</span>
                      <span style={{
                        fontSize: '11px', fontWeight: 600,
                        padding: '1px 7px', borderRadius: '3px',
                        background: doc.status === 'COMPLETED' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                        color: doc.status === 'COMPLETED' ? 'var(--color-success)' : 'var(--color-warning)',
                        border: `1px solid ${doc.status === 'COMPLETED' ? 'var(--color-success-border)' : 'var(--color-warning-border)'}`,
                      }}>
                        {doc.status === 'COMPLETED' ? 'Ready' : doc.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
