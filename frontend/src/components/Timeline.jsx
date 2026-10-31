import React from 'react';

const STEP_LABELS = {
  ingested: { label: '1. Ingested from Stream', icon: '📥' },
  mapped: { label: '2. Schema Normalized & Mapped', icon: '🔄' },
  validated: { label: '3. Integrity Checks Passed', icon: '🛡' },
  normalised: { label: '4. Whitespace & Canonicalization', icon: '✨' },
  entity_merged: { label: '5. Entity Resolution & Merging', icon: '🔗' },
  loaded: { label: '6. Loaded to PostgreSQL Store', icon: '💾' },
};

export default function Timeline({ steps = [], transactionId = 'TXN_7701' }) {
  if (!steps || steps.length === 0) {
    return (
      <div className="empty-state">
        <h3>No Provenance Trail Available</h3>
        <p>Select a valid transaction ID to audit its complete transformation lifecycle.</p>
      </div>
    );
  }

  return (
    <div className="workbench-panel">
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>AUDIT PROVENANCE TIMELINE</span>
          <span className="badge badge-neutral mono">{transactionId}</span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Traceable Record Lineage
        </span>
      </div>

      <div className="panel-body" style={{ padding: '24px 32px' }}>
        <div style={{ position: 'relative', borderLeft: '2px solid var(--border-default)', marginLeft: '12px' }}>
          {steps.map((item, index) => {
            const meta = STEP_LABELS[item.step] || { label: item.step, icon: '•' };
            const isLast = index === steps.length - 1;

            return (
              <div
                key={index}
                style={{
                  position: 'relative',
                  marginBottom: isLast ? 0 : '24px',
                  paddingLeft: '24px',
                }}
              >
                {/* Node dot on line */}
                <div
                  style={{
                    position: 'absolute',
                    left: '-7px',
                    top: '2px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: isLast ? 'var(--risk-normal)' : 'var(--accent-navy)',
                    border: '2px solid var(--bg-surface)',
                  }}
                />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {meta.label}
                    </span>
                    <span className="badge badge-outline-dark" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                      {item.step}
                    </span>
                  </div>
                  <span className="mono" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    {item.created_at}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--bg-surface-subtle)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {item.detail}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
