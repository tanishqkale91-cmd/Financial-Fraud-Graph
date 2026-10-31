import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { client } from '../api/client';

export default function CasesPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('high');
  const [newAlertsInput, setNewAlertsInput] = useState('ALT-2026-0091, ALT-2026-0084');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [caseError, setCaseError] = useState(null);

  const fetchCases = async () => {
    setLoading(true);
    setCaseError(null);
    try {
      const data = await client.getCases({ status: statusFilter });
      setCases(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch cases:', err);
      setCaseError(err.message || 'Failed to load investigation cases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [statusFilter]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    setCaseError(null);
    try {
      const alertIds = newAlertsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const created = await client.createCase({
        title: newTitle.trim(),
        alert_ids: alertIds,
        priority: newPriority,
      });

      setShowCreateModal(false);
      setNewTitle('');
      navigate(`/cases/${created.id}`);
    } catch (err) {
      console.error('Create case failed:', err);
      setCaseError(err.message || 'Failed to create new investigation case.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityBadge = (p) => {
    if (p === 'high') return <span className="badge badge-risk-critical" style={{ textTransform: 'uppercase' }}>High Priority</span>;
    if (p === 'medium') return <span className="badge badge-risk-high" style={{ textTransform: 'uppercase' }}>Medium Priority</span>;
    return <span className="badge badge-risk-watch" style={{ textTransform: 'uppercase' }}>Low Priority</span>;
  };

  return (
    <div className="page-container">
      {/* Evidential Header */}
      <div className="dark-console-card row-layout">
        <div>
          <div className="console-headline-box">
            <h2>AML INVESTIGATION CASE MANAGEMENT</h2>
          </div>
          <p style={{ color: 'var(--text-dark-secondary)', fontSize: '13px', maxWidth: '68ch', textWrap: 'pretty' }}>
            Structured dossiers assembling multi-alert patterns, counterparty graph topologies, and forensic
            exhibits. Enforce accountability with task management, verifiable audit logs, and formalized decisions.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', borderLeft: '1px solid var(--bg-dark-border)', paddingLeft: '24px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-dark-muted)', fontFamily: 'var(--font-mono)' }}>
            ACTIVE PORTFOLIO: {total} CASES
          </div>
          <button
            type="button"
            className="btn btn-gold btn-sm"
            onClick={() => setShowCreateModal(true)}
          >
            + NEW INVESTIGATION CASE
          </button>
        </div>
      </div>

      {/* Case Error Banner */}
      {caseError && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--risk-critical-bg)',
            border: '1px solid var(--risk-critical-border)',
            color: 'var(--risk-critical-text)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>⚠ {caseError}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setCaseError(null)}
            style={{ fontSize: '11px', padding: '2px 8px' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div
        className="workbench-panel"
        style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label htmlFor="case-status-filter" className="form-label" style={{ marginBottom: 0 }}>
            Filter Status:
          </label>
          <select
            id="case-status-filter"
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ fontSize: '12px', minHeight: '30px' }}
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_review">In Review</option>
            <option value="closed">Closed / Formalized</option>
          </select>
        </div>

        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          DISCIPLINE: HUMAN-LED ADJUDICATION MANDATED
        </span>
      </div>

      {/* Cases Table */}
      <div className="workbench-panel">
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>OPEN & ADJUDICATED INVESTIGATION DOSSIERS</span>
            <span className="badge badge-neutral">{cases.length} Records</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Click case row to open dossier
          </span>
        </div>

        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="skeleton" style={{ height: '36px' }} />
              <div className="skeleton" style={{ height: '36px' }} />
            </div>
          ) : cases.length === 0 ? (
            <div className="empty-state">
              <h3>No Investigation Cases Found</h3>
              <p>Create a case from an alert in the Alerts Queue or click "New Investigation Case".</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="analyst-table">
                <thead>
                  <tr>
                    <th style={{ width: '130px' }}>Case ID</th>
                    <th>Investigation Title</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Lead Investigator</th>
                    <th>Linked Alerts</th>
                    <th style={{ width: '130px' }}>Opened Date</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/cases/${c.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="mono" style={{ fontWeight: 600 }}>{c.id}</td>
                      <td>
                        <strong style={{ fontSize: '13px' }}>{c.title}</strong>
                      </td>
                      <td>{getPriorityBadge(c.priority)}</td>
                      <td>
                        <span
                          className={`badge ${
                            c.status === 'closed'
                              ? 'badge-risk-normal'
                              : c.status === 'in_review'
                              ? 'badge-risk-high'
                              : 'badge-risk-watch'
                          }`}
                          style={{ textTransform: 'uppercase', fontSize: '12px' }}
                        >
                          {c.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px' }}>{c.assignee}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {(c.alert_ids || []).map((aid) => (
                            <span key={aid} className="badge badge-neutral mono" style={{ fontSize: '12px' }}>
                              {aid}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="mono" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        {c.created_at}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* New Case Modal */}
      {showCreateModal && (
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
              width: '480px',
              padding: '24px',
              boxShadow: 'var(--shadow-panel)',
            }}
          >
            <h3 style={{ fontSize: '15px', marginBottom: '8px' }}>Open New Investigation Case</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Create an evidential case dossier for regulatory reporting and forensic collaboration.
            </p>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="case-title">
                  Case Title / Focus:
                </label>
                <input
                  id="case-title"
                  type="text"
                  className="input"
                  placeholder="e.g. Operation Cyclone: Coordinated Mule Ring"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="case-priority">
                  Triage Priority:
                </label>
                <select
                  id="case-priority"
                  className="select"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                >
                  <option value="high">High (Urgent SAR Filing Required)</option>
                  <option value="medium">Medium (Enhanced Due Diligence)</option>
                  <option value="low">Low (Routine Monitoring)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="case-alerts">
                  Seed Alert IDs (comma separated):
                </label>
                <input
                  id="case-alerts"
                  type="text"
                  className="input mono"
                  value={newAlertsInput}
                  onChange={(e) => setNewAlertsInput(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating Case...' : 'Create Case Dossier →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
