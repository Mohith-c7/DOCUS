import React from 'react';

interface CollectionItem {
  id: string;
  name: string;
  color: string;
  icon: string;
  _count: { documents: number };
}

interface CollectionsSidebarProps {
  collections: CollectionItem[];
  activeCollection: string | null;
  onSelectCollection: (id: string | null) => void;
  onCreateCollection: () => void;
  loading: boolean;
}

export function CollectionsSidebar({
  collections,
  activeCollection,
  onSelectCollection,
  onCreateCollection,
  loading,
}: CollectionsSidebarProps) {
  return (
    <div style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <div className="section-label" style={{ paddingLeft: '12px' }}>Views</div>
        <button
          className={`sidebar-item ${activeCollection === null ? 'active' : ''}`}
          onClick={() => onSelectCollection(null)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          All Documents
        </button>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '4px', paddingLeft: '12px' }}>
          <span className="section-label" style={{ margin: 0 }}>Collections</span>
          <button
            onClick={onCreateCollection}
            style={{ background: 'none', border: 'none', color: 'var(--color-brand)', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold' }}
            title="Create Collection"
          >
            +
          </button>
        </div>

        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {loading ? (
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', paddingLeft: '12px' }}>Loading...</div>
          ) : collections.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', paddingLeft: '12px' }}>No collections yet</div>
          ) : (
            collections.map((col) => (
              <button
                key={col.id}
                className={`sidebar-item ${activeCollection === col.id ? 'active' : ''}`}
                onClick={() => onSelectCollection(col.id)}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color || 'var(--color-brand)' }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.name}</span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{col._count?.documents || 0}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <button
        className="btn btn-secondary"
        onClick={onCreateCollection}
        style={{ fontSize: '12px', marginTop: 'auto', justifyContent: 'center' }}
      >
        + New Collection
      </button>
    </div>
  );
}
