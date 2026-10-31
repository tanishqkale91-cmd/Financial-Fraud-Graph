import React, { useState, useEffect } from 'react';
import { client } from '../api/client';

export default function RulesPage() {
  const [rules, setRules] = useState([]);
  const [stats, setStats] = useState({ by_rule: [] });
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);
  const [editWeight, setEditWeight] = useState(0.4);
  const [editEnabled, setEditEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRulesAndStats = async () => {
    setLoading(true);
    try {
      const [rList, sData] = await Promise.all([
        client.getRules(),
        client.getFeedbackStats(),
      ]);
      setRules(rList || []);
      setStats(sData || { by_rule: [] });
    } catch (err) {
      console.error('Failed to load rules & feedback stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRulesAndStats();
  }, []);

  const handleStartEdit = (rule) => {
    setEditingRule(rule);
    setEditWeight(rule.weight);
    setEditEnabled(rule.enabled);
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!editingRule) return;

    setIsSubmitting(true);
    try {
      await client.patchRule(editingRule.rule_id, {
        weight: parseFloat(editWeight),
        enabled: editEnabled,
      });
      setEditingRule(null);
      await fetchRulesAndStats();
    } catch (err) {
      console.error('Failed to patch rule:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      {/* Top Banner */}
      <div className="dark-console-card row-layout">
        <div>
          <div className="console-headline-box">
            <h2>DETECTION RULES & FALSE-POSITIVE FEEDBACK LOOP</h2>
          </div>
          <p style={{ color: 'var(--text-dark-secondary)', fontSize: '13px', maxWidth: '68ch' }}>
            Configure detector weights and threshold parameters. Track analyst disposition feedback to observe
            false-positive rates per rule and calibrate the model to suppress noise while preserving recall.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', borderLeft: '1px solid var(--bg-dark-border)', paddingLeft: '24px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-dark-muted)', fontFamily: 'var(--font-mono)' }}>
            FEEDBACK LOOP: REAL-TIME ACTIVE
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dark-primary)' }}>
            Active Rules: <strong>{rules.filter((r) => r.enabled).length} / {rules.length}</strong>
          </div>
        </div>
      </div>

      {/* Rules Table */}
      <div className="workbench-panel">
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>DETECTOR RULE CONFIGURATION</span>
            <span className="badge badge-neutral">{rules.length} Rules Registered</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            PATCH /api/rules/:id updates runtime scoring weights
          </span>
        </div>

        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="skeleton" style={{ height: '36px' }} />
              <div className="skeleton" style={{ height: '36px' }} />
            </div>
          ) : (
            <div className="table-container">
              <table className="analyst-table">
                <thead>
                  <tr>
                    <th>Rule Identifier</th>
                    <th>Version</th>
                    <th className="num">Scoring Weight</th>
                    <th>Status</th>
                    <th>Runtime Parameters</th>
                    <th style={{ width: '100px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.rule_id}>
                      <td>
                        <strong className="mono" style={{ fontSize: '13px' }}>
                          {rule.rule_id}
                        </strong>
                      </td>
                      <td className="mono" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        {rule.version}
                      </td>
                      <td className="num mono" style={{ fontWeight: 600 }}>
                        {(rule.weight * 100).toFixed(0)}%
                      </td>
                      <td>
                        <span
                          className={`badge ${rule.enabled ? 'badge-risk-normal' : 'badge-neutral'}`}
                        >
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {Object.entries(rule.params || {}).map(([pk, pv]) => (
                            <span key={pk} className="badge badge-neutral mono" style={{ fontSize: '12px' }}>
                              {pk}: {String(pv)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleStartEdit(rule)}
                        >
                          Configure
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Stats Standalone Section (Unboxed, no nested cards) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              FALSE-POSITIVE FEEDBACK ANALYTICS (GET /api/feedback/stats)
            </span>
            <span className="badge badge-risk-watch">Analyst Calibrated</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Reflects analyst review outcomes recorded from the Alerts queue
          </span>
        </div>

        <div className="stat-grid" style={{ marginBottom: '16px' }}>
          {stats.by_rule.map((s) => {
            const fpRatePct = (s.fp_rate * 100).toFixed(1);
            const isHighFp = s.fp_rate >= 0.12;

            return (
              <div key={s.rule_id} className="dark-stat-card">
                <div className="stat-header">
                  <span className="mono" style={{ fontWeight: 600, fontSize: '12px' }}>
                    {s.rule_id}
                  </span>
                  <span
                    className={`badge ${
                      isHighFp ? 'badge-risk-high' : 'badge-risk-normal'
                    } num mono`}
                    style={{ fontSize: '12px' }}
                  >
                    {fpRatePct}% FP Rate
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div>
                    <div className="stat-value">{s.false_positives}</div>
                    <div className="stat-sublabel">False Positives</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="stat-value" style={{ fontSize: '1.25rem', opacity: 0.8 }}>
                      {s.alerts}
                    </div>
                    <div className="stat-sublabel">Total Reviewed</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '12px', maxWidth: '75ch', textWrap: 'pretty' }}>
          <strong>💡 Closed-Loop Mechanism:</strong> When investigators mark alerts as false positives on the Alerts page,
          the telemetry is immediately recorded in PostgreSQL. The backend recalculates rule precision, and the weight
          slider allows analysts to dynamically reduce the influence of noisier rules while investigation proceeds.
        </div>
      </div>

      {/* Edit Rule Weight / Params Modal */}
      {editingRule && (
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
              width: '420px',
              padding: '20px',
              boxShadow: 'var(--shadow-panel)',
            }}
          >
            <h3 style={{ fontSize: '15px', marginBottom: '8px' }}>
              Configure Detector: {editingRule.rule_id}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Modify scoring weight and runtime activation status.
            </p>

            <form onSubmit={handleSaveRule} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-weight">
                  Scoring Weight (0.0 to 1.0):
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    id="edit-weight"
                    type="range"
                    min="0.05"
                    max="1.0"
                    step="0.05"
                    value={editWeight}
                    onChange={(e) => setEditWeight(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <span className="mono num" style={{ width: '45px', fontWeight: 600 }}>
                    {Number(editWeight).toFixed(2)}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  id="edit-enabled"
                  type="checkbox"
                  checked={editEnabled}
                  onChange={(e) => setEditEnabled(e.target.checked)}
                />
                <label htmlFor="edit-enabled" style={{ fontSize: '13px', cursor: 'pointer' }}>
                  Rule Active in Realtime Ingestion Pipeline
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setEditingRule(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Update Rule Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
