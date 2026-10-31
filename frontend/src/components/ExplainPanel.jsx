import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ExplainPanel({
  alert,
  onClose,
  onFeedback,
  onCreateCase,
  isSubmitting = false,
}) {
  const navigate = useNavigate();
  const [showRawJson, setShowRawJson] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [pendingVerdict, setPendingVerdict] = useState(null);

  if (!alert) return null;

  const { id, rule_id, rule_version, score, reason, status, evidence = {}, score_breakdown = {}, transactions = [] } = alert;

  const handleOpenFeedback = (verdict) => {
    setPendingVerdict(verdict);
    setShowNoteModal(true);
  };

  const handleConfirmFeedback = (e) => {
    e.preventDefault();
    onFeedback(id, pendingVerdict, feedbackNote);
    setShowNoteModal(false);
    setFeedbackNote('');
  };

  const handleOpenInGraph = () => {
    const targetEntity = alert.entity_id || evidence.cycle_path?.[0] || '8000EBD30';
    navigate(`/graph?entity_id=${encodeURIComponent(targetEntity)}&rule=${encodeURIComponent(rule_id)}`);
  };

  const getScoreColor = (sc) => {
    if (sc >= 85) return 'var(--risk-critical)';
    if (sc >= 70) return 'var(--risk-high)';
    if (sc >= 50) return 'var(--risk-watch)';
    return 'var(--risk-normal)';
  };

  return (
    <aside className="split-pane-side" aria-label="Alert Explainability Dossier">
      {/* Panel Header */}
      <div className="panel-header" style={{ padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="mono" style={{ fontWeight: 700, fontSize: '13px' }}>{id}</span>
          <span className="badge badge-risk-high num mono">Score {score}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '16px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '2px 6px',
          }}
          aria-label="Close explain panel"
        >
          ✕
        </button>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Evidential Status & Plain-English Reason */}
        <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '14px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>
              Algorithmic Detection Verdict
            </span>
            <span className="mono" style={{ fontSize: '12px' }}>
              RULE: {rule_id} ({rule_version})
            </span>
          </div>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {reason}
          </p>
        </div>

        {/* Action Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenInGraph}
          >
            🕸 Open in Graph
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onCreateCase(id)}
          >
            📂 Create Case
          </button>
        </div>

        {/* Section: Evidence Breakdown (Flattened, unboxed) */}
        <section style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Evidence Breakdown</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowRawJson(!showRawJson)}
              style={{ fontSize: '12px' }}
            >
              {showRawJson ? 'Formatted View' : 'Raw JSON'}
            </button>
          </div>

          {showRawJson ? (
            <pre
              className="mono"
              style={{
                backgroundColor: 'var(--bg-dark-panel)',
                color: 'var(--text-dark-primary)',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                overflowX: 'auto',
                maxHeight: '240px',
              }}
            >
              {JSON.stringify(evidence, null, 2)}
            </pre>
          ) : (
            <div>
              {/* Cycle Evidence */}
              {rule_id === 'cycles' && evidence.cycle_path && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span>Hops: <strong>{evidence.hop_count}</strong></span>
                    <span>Duration: <strong>{evidence.cycle_duration_minutes} Minutes</strong></span>
                  </div>

                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Directed Ring Path:
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px',
                        marginTop: '6px',
                        padding: '8px',
                        backgroundColor: 'var(--bg-surface-subtle)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      {evidence.cycle_path.map((acc, i) => (
                        <React.Fragment key={i}>
                          <span className="mono" style={{ fontWeight: 600, fontSize: '12px' }}>
                            {acc}
                          </span>
                          {i < evidence.cycle_path.length - 1 && (
                            <span style={{ color: 'var(--accent-gold)' }}>→</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {evidence.accounts && (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Identified Entities:
                      </span>
                      <ul style={{ listStyle: 'none', padding: 0, marginTop: '4px', fontSize: '12px' }}>
                        {evidence.accounts.map((ac, idx) => (
                          <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                            <span className="mono">{ac.account_id} ({ac.holder})</span>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{ac.role}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Shared Infra Evidence */}
              {rule_id === 'shared_infra' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Device ID: <strong className="mono">{evidence.device_id}</strong></span>
                    <span className="badge badge-risk-high">{evidence.shared_account_count} Accounts</span>
                  </div>
                  <div>Model: <strong>{evidence.device_model}</strong></div>
                  <div>IP Subnet: <strong className="mono">{evidence.ip_address}</strong></div>

                  {evidence.accounts && (
                    <div style={{ marginTop: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Linked Accounts:
                      </span>
                      <ul style={{ listStyle: 'none', padding: 0, marginTop: '4px' }}>
                        {evidence.accounts.map((acc, idx) => (
                          <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                            <span className="mono">{acc.account_id} - {acc.holder}</span>
                            <span className="mono" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                              {acc.last_active}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Fan In / Fan Out Evidence */}
              {rule_id === 'fan_in_out' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Hub Account: <strong className="mono">{evidence.hub_account}</strong></span>
                    <span>Holder: <strong>{evidence.hub_holder}</strong></span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Counterparties Count: <strong>{evidence.inbound_counterparties_count}</strong></span>
                    <span>Baseline Avg: <strong>{evidence.inbound_baseline_average}</strong></span>
                  </div>
                  <div style={{ padding: '6px 8px', backgroundColor: 'var(--risk-high-bg)', borderRadius: 'var(--radius-sm)', color: 'var(--risk-high-text)' }}>
                    Spike: <strong>{evidence.counterparty_ratio_vs_baseline}x</strong> higher than historical account baseline
                  </div>
                </div>
              )}

              {/* Rapid Movement Evidence */}
              {rule_id === 'rapid_movement' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Account: <strong className="mono">{evidence.account_id}</strong></span>
                    <span>Pass-Through: <strong>{(evidence.inflow_outflow_ratio * 100).toFixed(0)}%</strong></span>
                  </div>
                  <div>
                    Holding Time: <strong>{evidence.delta_minutes} Minutes</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span>Inflow: ₹{Number(evidence.inflow_amount).toLocaleString('en-IN')}</span>
                    <span>Outflow: ₹{Number(evidence.outflow_amount).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Section: Score Breakdown (Flattened, unboxed) */}
        {score_breakdown && (
          <section style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Score Model Breakdown</span>
              <span className="mono" style={{ fontSize: '12px' }}>Total {score}</span>
            </div>

            {/* Rules */}
            <div style={{ marginBottom: '10px' }}>
              <table className="analyst-table" style={{ fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th className="num">Weight</th>
                    <th className="num">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {(score_breakdown.rules || []).map((r, i) => (
                    <tr key={i}>
                      <td className="mono">{r.rule_id}</td>
                      <td className="num mono">{(r.weight * 100).toFixed(0)}%</td>
                      <td className="num mono" style={{ color: getScoreColor(r.score), fontWeight: 700 }}>
                        {r.score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ML Features */}
            {score_breakdown.ml && (
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  IsolationForest ML (Score {score_breakdown.ml.score})
                </span>
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(score_breakdown.ml.top_features || []).map((feat, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        padding: '4px 6px',
                        backgroundColor: 'var(--bg-surface-subtle)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <span className="mono">{feat.name}</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span className="mono num">{feat.value}</span>
                        <span className="badge badge-risk-high num mono" style={{ padding: '0 6px', fontSize: '12px' }}>
                          +{(feat.contribution * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Section: Linked Transactions (Flattened, unboxed) */}
        {transactions && transactions.length > 0 && (
          <section style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Linked Transactions</span>
              <span className="badge badge-neutral">{transactions.length} Records</span>
            </div>

            <div className="table-container">
              <table className="analyst-table" style={{ fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th>Txn ID</th>
                    <th>Time</th>
                    <th>From → To</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="mono">{tx.id}</td>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{tx.txn_ts}</td>
                      <td className="mono">{tx.from_entity_id} → {tx.to_entity_id}</td>
                      <td className="num mono">
                        ₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Disposition Actions */}
        <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '14px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>
            Investigator Disposition
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-danger"
              style={{ flex: 1 }}
              onClick={() => handleOpenFeedback('confirmed')}
            >
              Confirm Fraud
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => handleOpenFeedback('false_positive')}
            >
              Mark False Positive
            </button>
          </div>
        </div>
      </div>

      {/* Note modal */}
      {showNoteModal && (
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
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              width: '460px',
              padding: '20px',
              boxShadow: 'var(--shadow-panel)',
            }}
          >
            <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>
              Record Feedback: {pendingVerdict === 'confirmed' ? 'Confirm Fraud Ring' : 'Mark False Positive'}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Your determination will update alert disposition and calibrate detector threshold metrics.
            </p>

            <form onSubmit={handleConfirmFeedback} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="feedback-note">
                  Investigator Rationale / Notes:
                </label>
                <textarea
                  id="feedback-note"
                  className="textarea"
                  rows="3"
                  placeholder="Explain evidential grounds for this disposition..."
                  value={feedbackNote}
                  onChange={(e) => setFeedbackNote(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowNoteModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn btn-sm ${pendingVerdict === 'confirmed' ? 'btn-danger' : 'btn-primary'}`}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Recording...' : 'Save Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}
