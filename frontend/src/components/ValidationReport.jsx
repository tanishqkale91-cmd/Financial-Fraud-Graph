import React, { useState } from 'react';

export default function ValidationReport({ report }) {
  const [activeRule, setActiveRule] = useState('self_transfer_detected');

  if (!report) {
    return (
      <div className="empty-state">
        <h3>No Validation Run Yet</h3>
        <p>Upload a transaction batch and complete mapping to inspect validation metrics.</p>
      </div>
    );
  }

  const { total = 0, valid = 0, invalid = 0, by_rule = {}, examples = {} } = report;
  const validRate = total > 0 ? ((valid / total) * 100).toFixed(1) : 0;
  const invalidRate = total > 0 ? ((invalid / total) * 100).toFixed(1) : 0;

  const ruleKeys = Object.keys(by_rule);
  const currentExamples = examples[activeRule] || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Metric Cards Summary */}
      <div className="stat-grid">
        <div className="dark-stat-card">
          <div className="stat-header">
            <span className="badge badge-outline-dark">TOTAL RECORDS</span>
            <span className="stat-sublabel">100.0%</span>
          </div>
          <div className="stat-value">{total.toLocaleString()}</div>
          <div className="stat-sublabel">Raw Ingested Rows</div>
        </div>

        <div className="dark-stat-card">
          <div className="stat-header">
            <span className="badge badge-risk-normal">✓ VALIDATED</span>
            <span className="stat-sublabel">{validRate}%</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--risk-normal)' }}>
            {valid.toLocaleString()}
          </div>
          <div className="stat-sublabel">Ready for Graph Ingestion</div>
        </div>

        <div className="dark-stat-card">
          <div className="stat-header">
            <span className="badge badge-risk-critical">⚠ FLAGGED / INVALID</span>
            <span className="stat-sublabel">{invalidRate}%</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--risk-critical)' }}>
            {invalid.toLocaleString()}
          </div>
          <div className="stat-sublabel">Excluded or Quarantine Flagged</div>
        </div>
      </div>

      {/* Rules Breakdown & Concrete Examples */}
      <div className="workbench-panel">
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>DATA INTEGRITY RULES BREAKDOWN</span>
            <span className="badge badge-neutral">{ruleKeys.length} Rules Triggered</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Self-transfers and formatting anomalies explicitly isolated
          </span>
        </div>

        <div className="panel-body" style={{ padding: 0 }}>
          {/* Rule Selector Tabs */}
          <div
            style={{
              display: 'flex',
              overflowX: 'auto',
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface-subtle)',
              padding: '6px 12px',
              gap: '6px',
            }}
          >
            {ruleKeys.map((rule) => {
              const count = by_rule[rule];
              const isSelected = activeRule === rule;
              return (
                <button
                  key={rule}
                  type="button"
                  onClick={() => setActiveRule(rule)}
                  className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                  }}
                >
                  <span>{rule.replace(/_/g, ' ')}</span>
                  <span
                    style={{
                      marginLeft: '6px',
                      padding: '1px 6px',
                      borderRadius: '9999px',
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--border-default)',
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Example Rows Table for selected rule */}
          <div style={{ padding: '16px' }}>
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: '13px', textTransform: 'uppercase' }}>
                  Rule: {activeRule.replace(/_/g, ' ')}
                </strong>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {activeRule === 'self_transfer_detected'
                    ? 'Originator account is identical to destination account (common in test transactions or internal rebalances; must not create cyclic loops in graph detection).'
                    : `Showing concrete row instances flagged by ${activeRule}.`}
                </p>
              </div>
              <span className="badge badge-risk-high">
                {by_rule[activeRule] || 0} Affected Rows
              </span>
            </div>

            {currentExamples.length > 0 ? (
              <div className="table-container" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                <table className="analyst-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Row #</th>
                      <th>From Account</th>
                      <th>To Account</th>
                      <th className="num">Amount (INR)</th>
                      <th>Flagged Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentExamples.map((ex, idx) => (
                      <tr key={idx}>
                        <td className="mono">{ex.row_index}</td>
                        <td className="mono">{ex.from_account}</td>
                        <td className="mono">
                          <span
                            style={{
                              backgroundColor:
                                ex.from_account === ex.to_account
                                  ? 'rgba(217, 119, 6, 0.15)'
                                  : 'transparent',
                              padding: '2px 4px',
                              borderRadius: '2px',
                            }}
                          >
                            {ex.to_account}
                          </span>
                        </td>
                        <td className="num mono">
                          ₹{Number(ex.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ color: 'var(--risk-critical-text)', fontSize: '12px' }}>
                          {ex.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                No example rows serialized for this rule category.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
