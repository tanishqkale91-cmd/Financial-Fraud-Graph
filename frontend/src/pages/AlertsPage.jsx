import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { client } from '../api/client';
import ExplainPanel from '../components/ExplainPanel';

export default function AlertsPage() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [ruleFilter, setRuleFilter] = useState('');
  const [minScoreFilter, setMinScoreFilter] = useState('');

  // Selected for split-pane ExplainPanel
  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const [selectedAlertDetail, setSelectedAlertDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Batch selection for Case creation
  const [checkedAlertIds, setCheckedAlertIds] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const data = await client.getAlerts({
        status: statusFilter,
        rule_id: ruleFilter,
        min_score: minScoreFilter,
        limit: 50,
      });
      setAlerts(data.items || []);
      setTotal(data.total || 0);

      // Auto-select first alert if none selected and items exist
      if (!selectedAlertId && data.items && data.items.length > 0) {
        handleSelectRow(data.items[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [statusFilter, ruleFilter, minScoreFilter]);

  const handleSelectRow = async (alertId) => {
    setSelectedAlertId(alertId);
    setLoadingDetail(true);
    try {
      const detail = await client.getAlert(alertId);
      setSelectedAlertDetail(detail);
    } catch (err) {
      console.error('Failed to load alert detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleToggleCheck = (e, alertId) => {
    e.stopPropagation();
    setCheckedAlertIds((prev) => {
      const next = new Set(prev);
      if (next.has(alertId)) {
        next.delete(alertId);
      } else {
        next.add(alertId);
      }
      return next;
    });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setCheckedAlertIds(new Set(alerts.map((a) => a.id)));
    } else {
      setCheckedAlertIds(new Set());
    }
  };

  const handleFeedback = async (id, verdict, note) => {
    setIsSubmitting(true);
    try {
      await client.postAlertFeedback(id, verdict, note);
      // Refresh list and selected
      await fetchAlerts();
      if (selectedAlertId === id) {
        const updated = await client.getAlert(id);
        setSelectedAlertDetail(updated);
      }
    } catch (err) {
      console.error('Feedback error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCaseFromAlerts = async (singleAlertId = null) => {
    const alertIdsToUse = singleAlertId ? [singleAlertId] : Array.from(checkedAlertIds);
    if (alertIdsToUse.length === 0) return;

    setIsSubmitting(true);
    try {
      const newCase = await client.createCase({
        title: `Investigation on ${alertIdsToUse.join(', ')}`,
        alert_ids: alertIdsToUse,
        priority: 'high',
      });
      navigate(`/cases/${newCase.id}`);
    } catch (err) {
      console.error('Failed to create case:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getScoreBadge = (score) => {
    if (score >= 90) return <span className="badge badge-risk-critical num mono">{score} Critical</span>;
    if (score >= 75) return <span className="badge badge-risk-high num mono">{score} High</span>;
    if (score >= 50) return <span className="badge badge-risk-watch num mono">{score} Watch</span>;
    return <span className="badge badge-risk-normal num mono">{score} Low</span>;
  };

  return (
    <div className="page-container">
      {/* Top Banner */}
      <div className="dark-console-card row-layout">
        <div>
          <div className="console-headline-box">
            <h2>SUSPICIOUS TRANSACTION ALERTS QUEUE</h2>
          </div>
          <p style={{ color: 'var(--text-dark-secondary)', fontSize: '13px', maxWidth: '68ch' }}>
            Multi-rule detection pipeline with IsolationForest anomaly scoring. Click any alert to inspect
            the complete explainability breakdown, structural graph topology, and transaction evidence.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', borderLeft: '1px solid var(--bg-dark-border)', paddingLeft: '24px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-dark-muted)', fontFamily: 'var(--font-mono)' }}>
            QUEUE VOLUME: {total} ALERTS
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-gold btn-sm"
              disabled={checkedAlertIds.size === 0 || isSubmitting}
              onClick={() => handleCreateCaseFromAlerts()}
            >
              📂 CREATE CASE FROM SELECTED ({checkedAlertIds.size})
            </button>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="workbench-panel"
        style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
            <label htmlFor="filter-status" className="form-label" style={{ marginBottom: 0 }}>
              Status:
            </label>
            <select
              id="filter-status"
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ fontSize: '12px', minHeight: '30px' }}
            >
              <option value="">All Statuses</option>
              <option value="open">Open (Unreviewed)</option>
              <option value="confirmed">Confirmed Fraud</option>
              <option value="false_positive">False Positive</option>
            </select>
          </div>

          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
            <label htmlFor="filter-rule" className="form-label" style={{ marginBottom: 0 }}>
              Rule:
            </label>
            <select
              id="filter-rule"
              className="select"
              value={ruleFilter}
              onChange={(e) => setRuleFilter(e.target.value)}
              style={{ fontSize: '12px', minHeight: '30px' }}
            >
              <option value="">All Detection Rules</option>
              <option value="cycles">Circular Routing (Cycles)</option>
              <option value="shared_infra">Shared Device / IP</option>
              <option value="fan_in_out">Fan-In / Fan-Out Hubs</option>
              <option value="rapid_movement">Rapid Pass-Through</option>
            </select>
          </div>

          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
            <label htmlFor="filter-score" className="form-label" style={{ marginBottom: 0 }}>
              Min Score:
            </label>
            <input
              id="filter-score"
              type="number"
              className="input num"
              placeholder="e.g. 80"
              value={minScoreFilter}
              onChange={(e) => setMinScoreFilter(e.target.value)}
              style={{ width: '80px', fontSize: '12px', minHeight: '30px' }}
            />
          </div>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          SORT: RISK SCORE DESCENDING
        </div>
      </div>

      {/* Split-Pane Layout: Left Table + Right ExplainPanel */}
      <div className="split-pane-layout">
        <div className="split-pane-main">
          <div className="workbench-panel">
            <div className="panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>TRIAGE ALERT QUEUE</span>
                <span className="badge badge-neutral">{alerts.length} Displayed</span>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Click row to inspect forensic evidence
              </span>
            </div>

            <div className="panel-body" style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="skeleton" style={{ height: '36px' }} />
                  <div className="skeleton" style={{ height: '36px' }} />
                  <div className="skeleton" style={{ height: '36px' }} />
                </div>
              ) : alerts.length === 0 ? (
                <div className="empty-state">
                  <h3>No Alerts Matching Filters</h3>
                  <p>Reset filter controls or upload a new transaction batch to detect anomalies.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="analyst-table">
                    <thead>
                      <tr>
                        <th style={{ width: '36px' }}>
                          <input
                            type="checkbox"
                            checked={checkedAlertIds.size === alerts.length && alerts.length > 0}
                            onChange={handleSelectAll}
                            aria-label="Select all alerts"
                          />
                        </th>
                        <th style={{ width: '130px' }}>Risk Score</th>
                        <th>Alert ID</th>
                        <th>Rule ID</th>
                        <th>Flagged Reason</th>
                        <th>Primary Entity</th>
                        <th>Status</th>
                        <th style={{ width: '120px' }}>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.map((alt) => {
                        const isSelected = selectedAlertId === alt.id;
                        const isChecked = checkedAlertIds.has(alt.id);

                        return (
                          <tr
                            key={alt.id}
                            className={isSelected ? 'selected' : ''}
                            onClick={() => handleSelectRow(alt.id)}
                          >
                            <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => handleToggleCheck(e, alt.id)}
                                aria-label={`Select alert ${alt.id}`}
                              />
                            </td>
                            <td>{getScoreBadge(alt.score)}</td>
                            <td className="mono" style={{ fontWeight: 600 }}>{alt.id}</td>
                            <td>
                              <span className="badge badge-neutral mono" style={{ fontSize: '12px' }}>
                                {alt.rule_id}
                              </span>
                            </td>
                            <td style={{ fontSize: '12px', maxWidth: '340px' }}>
                              {alt.reason}
                            </td>
                            <td className="mono" style={{ fontSize: '12px' }}>
                              {alt.entity_id}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  alt.status === 'confirmed'
                                    ? 'badge-risk-critical'
                                    : alt.status === 'false_positive'
                                    ? 'badge-risk-normal'
                                    : 'badge-neutral'
                                }`}
                                style={{ textTransform: 'uppercase', fontSize: '11px' }}
                              >
                                {alt.status}
                              </span>
                            </td>
                            <td className="mono" style={{ fontSize: '12px', whiteSpace: 'nowrap', color: 'var(--text-tertiary)' }}>
                              {alt.created_at}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ExplainPanel Side Drawer */}
        {selectedAlertDetail && (
          <ExplainPanel
            alert={selectedAlertDetail}
            onClose={() => {
              setSelectedAlertId(null);
              setSelectedAlertDetail(null);
            }}
            onFeedback={handleFeedback}
            onCreateCase={(id) => handleCreateCaseFromAlerts(id)}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}
