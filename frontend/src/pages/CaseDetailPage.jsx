import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { client } from '../api/client';
import EvidenceList from '../components/EvidenceList';

export default function CaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState(null);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // New Task form
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('Tomorrow 18:00');

  // Decision form
  const [decisionVerdict, setDecisionVerdict] = useState('confirmed_fraud');
  const [decisionRationale, setDecisionRationale] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  const fetchCaseDetail = async () => {
    setLoading(true);
    try {
      const data = await client.getCase(id);
      setCaseData(data);
      const sumRes = await client.getCaseSummary(id);
      setSummary(sumRes.summary || data.summary || '');
    } catch (err) {
      console.error('Failed to load case detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaseDetail();
  }, [id]);

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 3000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  const handleAddEvidence = async (payload) => {
    try {
      await client.addCaseEvidence(id, payload);
      await fetchCaseDetail();
    } catch (err) {
      console.error('Failed to attach evidence:', err);
    }
  };

  const handleAddTaskSubmit = async (e) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    try {
      await client.addCaseTask(id, {
        title: taskTitle.trim(),
        assignee: taskAssignee.trim() || 'Current Analyst',
        due_date: taskDueDate.trim(),
      });
      setShowTaskModal(false);
      setTaskTitle('');
      await fetchCaseDetail();
    } catch (err) {
      console.error('Add task failed:', err);
    }
  };

  const handleToggleTaskStatus = async (taskId, currentStatus) => {
    const nextStatus = currentStatus === 'done' ? 'open' : 'done';
    try {
      await client.patchTask(taskId, { status: nextStatus });
      await fetchCaseDetail();
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    if (!decisionRationale.trim()) return;

    setIsSubmittingDecision(true);
    try {
      await client.recordCaseDecision(id, {
        decision: decisionVerdict,
        rationale: decisionRationale.trim(),
      });
      setDecisionRationale('');
      await fetchCaseDetail();
    } catch (err) {
      console.error('Decision submission error:', err);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ height: '80px', marginBottom: '16px' }} />
        <div className="skeleton" style={{ height: '300px' }} />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h3>Case Dossier Not Found</h3>
          <button className="btn btn-primary" onClick={() => navigate('/cases')}>
            ← Back to Cases
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Top Banner */}
      <div className="dark-console-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/cases')}
                style={{ fontSize: '11px', padding: '2px 8px' }}
              >
                ← Back
              </button>
              <span className="mono" style={{ color: 'var(--text-dark-muted)', fontSize: '13px' }}>
                CASE ID: {caseData.id}
              </span>
              <span
                className={`badge ${
                  caseData.status === 'closed'
                    ? 'badge-risk-normal'
                    : caseData.status === 'in_review'
                    ? 'badge-risk-high'
                    : 'badge-risk-watch'
                }`}
                style={{ textTransform: 'uppercase' }}
              >
                {caseData.status.replace('_', ' ')}
              </span>
              <span className="badge badge-risk-critical" style={{ textTransform: 'uppercase' }}>
                {caseData.priority} Priority
              </span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-dark-primary)', letterSpacing: '-0.01em' }}>
              {caseData.title}
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-dark-secondary)', marginTop: '4px' }}>
              Lead Assignee: <strong>{caseData.assignee}</strong> · Opened: <span className="mono">{caseData.created_at}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-dark-muted)', fontFamily: 'var(--font-mono)' }}>
              LINKED ALERTS:
            </span>
            {(caseData.alert_ids || []).map((aid) => (
              <span key={aid} className="badge badge-outline-dark mono" style={{ fontSize: '12px' }}>
                {aid}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Generated Plain-Language Summary Box with Copy Button */}
      <div className="workbench-panel">
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>PLAIN-LANGUAGE FORENSIC SUMMARY</span>
            <span className="badge badge-neutral">Auto-Synthesized from Exhibits</span>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleCopySummary}
          >
            {copiedSummary ? '✓ Copied to Clipboard' : '📋 Copy Summary for SAR Filing'}
          </button>
        </div>

        <div className="panel-body" style={{ backgroundColor: 'var(--bg-surface-subtle)' }}>
          <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-primary)', fontStyle: 'italic', maxWidth: '72ch', textWrap: 'pretty' }}>
            "{summary}"
          </p>
        </div>
      </div>

      {/* Evidence Section */}
      <EvidenceList
        evidence={caseData.evidence || []}
        onAddEvidence={handleAddEvidence}
      />

      {/* Two-Column Grid: Tasks & Formal Adjudication */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
        {/* Investigative Tasks */}
        <div className="workbench-panel">
          <div className="panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>INVESTIGATIVE TASKS & SUBPOENAS</span>
              <span className="badge badge-neutral">{(caseData.tasks || []).length}</span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowTaskModal(true)}
            >
              + Add Task...
            </button>
          </div>

          <div className="panel-body" style={{ padding: 0 }}>
            {(caseData.tasks || []).length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <p>No open operational tasks for this case.</p>
              </div>
            ) : (
              <table className="analyst-table">
                <thead>
                  <tr>
                    <th style={{ width: '36px' }}>Done</th>
                    <th>Task Description</th>
                    <th>Assignee</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {(caseData.tasks || []).map((t) => (
                    <tr key={t.id}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={t.status === 'done'}
                          onChange={() => handleToggleTaskStatus(t.id, t.status)}
                          aria-label={`Toggle task ${t.title}`}
                        />
                      </td>
                      <td style={{ textDecoration: t.status === 'done' ? 'line-through' : 'none', color: t.status === 'done' ? 'var(--text-tertiary)' : 'inherit' }}>
                        <strong style={{ fontSize: '12px' }}>{t.title}</strong>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t.assignee}</td>
                      <td className="mono" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{t.due_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Human Decision Form & Recorded Adjudication */}
        <div className="workbench-panel">
          <div className="panel-header">
            <span>FORMAL CASE DETERMINATION & ADJUDICATION</span>
            <span className="badge badge-risk-high">Human Sign-off</span>
          </div>

          <div className="panel-body">
            {caseData.decisions && caseData.decisions.length > 0 && (
              <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                  Recorded Case Verdict
                </div>
                {caseData.decisions.map((dec) => (
                  <div
                    key={dec.id}
                    style={{
                      padding: '12px 14px',
                      backgroundColor:
                        dec.decision === 'confirmed_fraud'
                          ? 'var(--risk-critical-bg)'
                          : 'var(--bg-surface-subtle)',
                      borderLeft:
                        dec.decision === 'confirmed_fraud'
                          ? '4px solid var(--risk-critical-border)'
                          : '4px solid var(--border-default)',
                      marginBottom: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong style={{ textTransform: 'uppercase', fontSize: '12px', color: dec.decision === 'confirmed_fraud' ? 'var(--risk-critical-text)' : 'inherit' }}>
                        {dec.decision.replace('_', ' ')}
                      </strong>
                      <span className="mono" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        {dec.created_at}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', lineHeight: 1.4 }}>{dec.rationale}</p>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                      Adjudicated by: {dec.decider}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Decision Submission Form */}
            <form onSubmit={handleDecisionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="verdict-select">
                  Formal Determination:
                </label>
                <select
                  id="verdict-select"
                  className="select"
                  value={decisionVerdict}
                  onChange={(e) => setDecisionVerdict(e.target.value)}
                >
                  <option value="confirmed_fraud">Confirmed Fraud (File Regulatory SAR / Freeze Accounts)</option>
                  <option value="false_positive">False Positive (Benign Commercial Rebalance)</option>
                  <option value="escalate">Escalate to Specialized Financial Crime Unit</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="decision-rationale">
                  Mandatory Legal & Evidential Rationale:
                </label>
                <textarea
                  id="decision-rationale"
                  className="textarea"
                  rows="3"
                  placeholder="Detail the conclusive findings, counterparty relationships, or exculpatory evidence supporting this determination..."
                  value={decisionRationale}
                  onChange={(e) => setDecisionRationale(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className={`btn ${decisionVerdict === 'confirmed_fraud' ? 'btn-danger' : 'btn-primary'}`}
                disabled={isSubmittingDecision}
              >
                {isSubmittingDecision ? 'Recording Decision...' : 'Formalize Case Decision →'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Chronological Audit Trail */}
      <div className="workbench-panel">
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>IMMUTABLE AUDIT TRAIL</span>
            <span className="badge badge-neutral mono">{(caseData.audit || []).length} Events</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Compliance & Chain of Custody
          </span>
        </div>

        <div className="panel-body" style={{ padding: 0 }}>
          <table className="analyst-table">
            <thead>
              <tr>
                <th style={{ width: '160px' }}>Timestamp</th>
                <th>Operator</th>
                <th>Action</th>
                <th>Event Detail</th>
              </tr>
            </thead>
            <tbody>
              {(caseData.audit || []).map((log, index) => (
                <tr key={index}>
                  <td className="mono" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    {log.ts}
                  </td>
                  <td style={{ fontSize: '12px', fontWeight: 600 }}>{log.user}</td>
                  <td>
                    <span className="badge badge-outline-dark mono" style={{ fontSize: '12px' }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px' }}>{log.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Task Modal */}
      {showTaskModal && (
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
              width: '440px',
              padding: '20px',
              boxShadow: 'var(--shadow-panel)',
            }}
          >
            <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Assign Investigative Task</h3>
            <form onSubmit={handleAddTaskSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="task-title">
                  Task Title:
                </label>
                <input
                  id="task-title"
                  type="text"
                  className="input"
                  placeholder="e.g. Request bank statement from beneficiary"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="task-assignee">
                  Assignee:
                </label>
                <input
                  id="task-assignee"
                  type="text"
                  className="input"
                  placeholder="e.g. A. Menon (Senior AML Lead)"
                  value={taskAssignee}
                  onChange={(e) => setTaskAssignee(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="task-due">
                  Due Datetime:
                </label>
                <input
                  id="task-due"
                  type="text"
                  className="input mono"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowTaskModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
