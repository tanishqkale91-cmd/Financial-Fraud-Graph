import React, { useState } from 'react';

export default function EvidenceList({ evidence = [], onAddEvidence, isSubmitting = false }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [type, setType] = useState('note');
  const [ref, setRef] = useState('');
  const [noteText, setNoteText] = useState('');

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!ref.trim() && type !== 'note') return;

    onAddEvidence({
      type,
      ref: ref.trim() || `NOTE_${Date.now()}`,
      content: {
        text: noteText.trim(),
        added_at: new Date().toISOString(),
      },
    });

    setRef('');
    setNoteText('');
    setShowAddModal(false);
  };

  const getEvidenceIcon = (evType) => {
    switch (evType) {
      case 'alert':
        return '🚨';
      case 'transaction':
        return '💳';
      case 'subgraph':
        return '🕸';
      case 'note':
      default:
        return '📝';
    }
  };

  return (
    <div className="workbench-panel">
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>EVIDENTIAL EXHIBITS & ATTACHMENTS</span>
          <span className="badge badge-neutral">{evidence.length} Exhibits</span>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddModal(true)}
        >
          + Attach Evidence...
        </button>
      </div>

      <div className="panel-body" style={{ padding: 0 }}>
        {evidence.length === 0 ? (
          <div className="empty-state">
            <h3>No Evidence Attached</h3>
            <p>Attach suspicious alerts, transaction records, graph snapshots, or forensic notes.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="analyst-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>Type</th>
                  <th>Reference / ID</th>
                  <th>Evidential Substance</th>
                  <th style={{ width: '140px' }}>Attached At</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((ev) => (
                  <tr key={ev.id}>
                    <td style={{ fontSize: '16px', textAlign: 'center' }}>
                      <span title={ev.type}>{getEvidenceIcon(ev.type)}</span>
                    </td>
                    <td>
                      <div className="mono" style={{ fontWeight: 600 }}>{ev.ref}</div>
                      <span className="badge badge-outline-dark" style={{ fontSize: '12px', textTransform: 'uppercase' }}>
                        {ev.type}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {ev.type === 'note' && (
                        <span>{ev.content.text}</span>
                      )}
                      {ev.type === 'alert' && (
                        <div>
                          <strong>{ev.content.rule_id}</strong>: {ev.content.description || `Risk score: ${ev.content.score}`}
                        </div>
                      )}
                      {ev.type === 'subgraph' && (
                        <div>
                          <span>Captured Subgraph Snapshot for {ev.content.entity_id}</span>
                          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                            {ev.content.notes || `${ev.content.node_ids?.length || ev.content.nodes_count || 0} nodes preserved`}
                          </div>
                        </div>
                      )}
                      {ev.type === 'transaction' && (
                        <div className="mono">
                          {ev.content.from} → {ev.content.to} (₹{Number(ev.content.amount || 0).toLocaleString('en-IN')})
                        </div>
                      )}
                    </td>
                    <td className="mono" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                      {ev.created_at}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Evidence Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              width: '460px',
              padding: '20px',
              boxShadow: 'var(--shadow-panel)',
            }}
          >
            <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Attach Evidential Exhibit to Case</h3>
            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="ev-type">
                  Evidence Category:
                </label>
                <select
                  id="ev-type"
                  className="select"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="note">Investigator Note / Commentary</option>
                  <option value="alert">System Alert ID</option>
                  <option value="transaction">Transaction ID</option>
                  <option value="subgraph">Graph Topology Snapshot</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ev-ref">
                  Reference Identifier:
                </label>
                <input
                  id="ev-ref"
                  type="text"
                  className="input mono"
                  placeholder="e.g. ALT-2026-0091 or TXN_7701"
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  required={type !== 'note'}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ev-notes">
                  Forensic Notes / Observation:
                </label>
                <textarea
                  id="ev-notes"
                  className="textarea"
                  rows="3"
                  placeholder="Document why this item constitutes evidence of coordinated laundering or mule activity..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Attaching...' : 'Attach Exhibit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
