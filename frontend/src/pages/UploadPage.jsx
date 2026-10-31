import React, { useState, useEffect, useRef } from 'react';
import { client, INGESTION_STAGES } from '../api/client';
import MappingWizard from '../components/MappingWizard';
import ValidationReport from '../components/ValidationReport';
import Timeline from '../components/Timeline';

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [fileDetails, setFileDetails] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadData, setUploadData] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [batchId, setBatchId] = useState(null);

  // Ingestion Asynchronous Task & Progress State
  const [taskId, setTaskId] = useState(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionProgress, setIngestionProgress] = useState(0);
  const [currentStageKey, setCurrentStageKey] = useState('uploading');
  const [currentStageLabel, setCurrentStageLabel] = useState('Uploading');
  const [ingestionStatus, setIngestionStatus] = useState(null);
  const [ingestionError, setIngestionError] = useState(null);

  // Results State
  const [provenanceSteps, setProvenanceSteps] = useState([]);
  const [selectedTxn, setSelectedTxn] = useState('TXN_7701');
  const [entities, setEntities] = useState([]);
  const [activeTab, setActiveTab] = useState('validation'); // 'validation' | 'provenance' | 'entities'

  const intervalRef = useRef(null);

  // Cleanup polling intervals on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Restore active or completed batch session on mount
  useEffect(() => {
    async function restoreSession() {
      try {
        const tpls = await client.getMappingTemplates();
        setTemplates(tpls || []);

        const active = client.getActiveIngestion();
        if (active.batch) {
          setBatchId(active.batch.batch_id);
          setUploadData({
            batch_id: active.batch.batch_id,
            filename: active.batch.filename,
            file_size: active.batch.file_size,
            columns: active.batch.columns,
            suggested_mapping: active.batch.suggested_mapping,
            sample_rows: active.batch.sample_rows,
          });
          setFileDetails({
            name: active.batch.filename,
            sizeFormatted: formatBytes(active.batch.file_size || 14829100),
            lastModified: active.batch.created_at || 'Existing Session',
          });

          if (active.batch.ingestionStatus) {
            setIngestionStatus(active.batch.ingestionStatus);
            setIngestionProgress(100);
            setCurrentStageKey('completed');
            setCurrentStageLabel('Ingestion Completed Successfully');

            // Restore provenance and entities
            const [prov, entList] = await Promise.all([
              client.getProvenance(active.batch.batch_id, 'transaction', selectedTxn),
              client.getBatchEntities(active.batch.batch_id),
            ]);
            setProvenanceSteps(prov || []);
            setEntities(entList || []);
          }
        }
      } catch (err) {
        console.error('Failed to initialize session:', err);
      }
    }
    restoreSession();
  }, []);

  // File Validation Handler
  const validateAndSelectFile = (selected) => {
    setFileError(null);
    if (!selected) return;

    // Validate extension
    const hasValidExt = selected.name.toLowerCase().endsWith('.csv');
    const isCsvType =
      selected.type === 'text/csv' ||
      selected.type === 'application/vnd.ms-excel' ||
      selected.type === 'text/plain';

    if (!hasValidExt && !isCsvType) {
      setFileError('Invalid file type. Only standard RFC 4180 CSV files (.csv) are supported.');
      return;
    }

    // Validate size (max 100MB)
    const MAX_SIZE = 100 * 1024 * 1024;
    if (selected.size > MAX_SIZE) {
      setFileError(
        `File size (${formatBytes(selected.size)}) exceeds maximum allowable limit of 100 MB.`
      );
      return;
    }

    if (selected.size === 0) {
      setFileError('The selected file is empty (0 bytes). Please select a valid transaction dataset.');
      return;
    }

    setFile(selected);
    setFileDetails({
      name: selected.name,
      sizeFormatted: formatBytes(selected.size),
      lastModified: new Date(selected.lastModified).toLocaleString('en-GB'),
    });
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    validateAndSelectFile(selected);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    validateAndSelectFile(dropped);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file && !uploadData) {
      setFileError('Please select a CSV file before inspecting.');
      return;
    }

    setIsUploading(true);
    setFileError(null);
    try {
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      }
      const res = await client.uploadFile(formData);
      setUploadData(res);
      setBatchId(res.batch_id);
    } catch (err) {
      setFileError(err.message || 'Failed to inspect transaction CSV file.');
    } finally {
      setIsUploading(false);
    }
  };

  // Pre-load default 50k mock file without submitting empty FormData
  const handleLoadDemoDataset = async () => {
    if (isUploading || isIngesting) return;
    setIsUploading(true);
    setFileError(null);
    try {
      const demoFormData = new FormData();
      demoFormData.append('is_demo', 'true');
      const res = await client.uploadFile(demoFormData);
      setUploadData(res);
      setBatchId(res.batch_id);
      setFile(null);
      setFileDetails({
        name: 'HI-Small_50k_enriched.csv',
        sizeFormatted: '14.8 MB',
        lastModified: 'Pre-processed Synthetic Benchmark',
      });
    } catch (err) {
      setFileError('Failed to load demo dataset: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setFileDetails(null);
    setFileError(null);
  };

  const handleResetSession = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    client.resetIngestion();
    setFile(null);
    setFileDetails(null);
    setFileError(null);
    setUploadData(null);
    setBatchId(null);
    setTaskId(null);
    setIsIngesting(false);
    setIngestionProgress(0);
    setIngestionStatus(null);
    setProvenanceSteps([]);
    setEntities([]);
  };

  const handleSaveTemplate = async (name, mapping) => {
    try {
      const newTpl = await client.saveMappingTemplate(name, mapping);
      setTemplates((prev) => [...prev, newTpl]);
    } catch (err) {
      console.error('Save template error:', err);
    }
  };

  // Execute Asynchronous Ingestion with Deterministic Multi-Stage Progression
  const handleApplyMapping = async (mapping) => {
    if (!batchId || isIngesting) return;

    // Prevent duplicate polling loops
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsIngesting(true);
    setIngestionError(null);
    setIngestionProgress(15);
    setCurrentStageKey('uploading');
    setCurrentStageLabel('Uploading Transaction Batch');

    try {
      await client.saveMapping(batchId, mapping);
      const runRes = await client.runIngestion(batchId);
      setTaskId(runRes.task_id);

      // Start multi-stage polling simulation
      intervalRef.current = setInterval(async () => {
        try {
          const statusRes = await client.getIngestionStatus(batchId);
          setIngestionProgress(statusRes.progress || 0);
          setCurrentStageKey(statusRes.status);
          setCurrentStageLabel(statusRes.stage_label || statusRes.status);

          if (statusRes.is_done || statusRes.status === 'completed') {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setIngestionStatus(statusRes);
            setIsIngesting(false);

            // Fetch resulting provenance steps and entity clusters
            const [prov, entList] = await Promise.all([
              client.getProvenance(batchId, 'transaction', selectedTxn),
              client.getBatchEntities(batchId),
            ]);
            setProvenanceSteps(prov || []);
            setEntities(entList || []);
          }
        } catch (pollErr) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsIngesting(false);
          setIngestionError(pollErr.message || 'Error occurred while tracking ingestion task.');
        }
      }, 700);
    } catch (err) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsIngesting(false);
      setIngestionError(err.message || 'Failed to initialize ingestion task.');
    }
  };

  const handleTxnChange = async (txnId) => {
    setSelectedTxn(txnId);
    if (!batchId) return;
    try {
      const prov = await client.getProvenance(batchId, 'transaction', txnId);
      setProvenanceSteps(prov || []);
    } catch (err) {
      console.error('Failed to fetch txn provenance:', err);
    }
  };

  const isLocked = isUploading || isIngesting;

  return (
    <div className="page-container">
      {/* Evidential Top Header */}
      <div className="dark-console-card row-layout">
        <div>
          <div className="console-headline-box">
            <h2>BATCH INGESTION & DATA PROVENANCE</h2>
          </div>
          <p style={{ color: 'var(--text-dark-secondary)', fontSize: '13px', maxWidth: '68ch', textWrap: 'pretty' }}>
            Import raw transaction journals, map heterogeneous columns to the canonical forensic
            schema, enforce integrity validation, and track the end-to-end transformation lineage.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', borderLeft: '1px solid var(--bg-dark-border)', paddingLeft: '24px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-dark-muted)', fontFamily: 'var(--font-mono)' }}>
            STATUS: {batchId ? `ACTIVE BATCH (${batchId})` : 'AWAITING BATCH'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dark-primary)' }}>
            Canonical Schema: <strong>11 Attributes</strong>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-gold btn-sm"
              onClick={handleLoadDemoDataset}
              disabled={isLocked}
              style={{ width: 'fit-content' }}
            >
              {isUploading ? 'Loading...' : '→ LOAD 50K DEMO BATCH (ENRICHED)'}
            </button>
            {batchId && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleResetSession}
                disabled={isLocked}
                title="Clear current batch and start fresh"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Validation or Ingestion Error Banner */}
      {(fileError || ingestionError) && (
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700 }}>⚠ Error:</span>
            <span>{fileError || ingestionError}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setFileError(null);
              setIngestionError(null);
            }}
            style={{ fontSize: '11px', padding: '2px 8px' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Step 1: File Upload / Picker */}
      <div className="workbench-panel">
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>STEP 1: SELECT RAW TRANSACTION CSV</span>
            {batchId && <span className="badge badge-risk-normal mono">Batch: {batchId}</span>}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Accepts CSV with banking or UPI fields (Max 100MB)
          </span>
        </div>

        <div className="panel-body">
          <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                border: isDragging ? '2px dashed var(--accent-gold)' : '1px dashed var(--border-strong)',
                padding: '28px',
                textAlign: 'center',
                backgroundColor: isDragging ? 'var(--accent-gold-bg)' : 'var(--bg-surface-subtle)',
                transition: 'border-color 150ms ease-out, background-color 150ms ease-out',
                cursor: isLocked ? 'not-allowed' : 'pointer',
              }}
              onDragEnter={handleDragOver}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                id="file-upload"
                type="file"
                accept=".csv,text/csv,application/vnd.ms-excel"
                onChange={handleFileChange}
                disabled={isLocked}
                style={{ display: 'none' }}
              />
              <label
                htmlFor="file-upload"
                style={{
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '28px' }} aria-hidden="true">📁</span>
                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                  {fileDetails ? fileDetails.name : 'Click to select CSV file or drag and drop here'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  Supported formats: RFC 4180 CSV with headers (Max 100MB)
                </span>
              </label>
            </div>

            {/* Selected File Dossier Details Card */}
            {fileDetails && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <span className="mono" style={{ fontWeight: 600, fontSize: '13px' }}>
                    {fileDetails.name}
                  </span>
                  <span className="badge badge-neutral mono" style={{ fontSize: '11px' }}>
                    SIZE: {fileDetails.sizeFormatted}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Modified: {fileDetails.lastModified}
                  </span>
                  <span className="badge badge-risk-normal" style={{ fontSize: '11px' }}>
                    ✓ Format Validated
                  </span>
                </div>
                {!isLocked && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleClearFile}
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {uploadData ? (
                  <span>
                    Loaded <strong>{uploadData.filename}</strong> ({uploadData.columns.length} columns detected)
                  </span>
                ) : (
                  <span>Ready to parse headers and sample rows.</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLocked || (!file && !uploadData)}
                >
                  {isUploading ? 'Inspecting CSV...' : 'Inspect & Generate Mapping →'}
                </button>
              </div>
            </div>
          </form>

          {/* Sample Rows Preview */}
          {uploadData && uploadData.sample_rows && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Raw Sample Preview (First {uploadData.sample_rows.length} Rows)
              </div>
              <div className="table-container" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                <table className="analyst-table">
                  <thead>
                    <tr>
                      {uploadData.columns.slice(0, 8).map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {uploadData.sample_rows.map((row, i) => (
                      <tr key={i}>
                        {uploadData.columns.slice(0, 8).map((col) => (
                          <td key={col} className="mono" style={{ fontSize: '12px' }}>
                            {String(row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Mapping Wizard */}
      {uploadData && (
        <MappingWizard
          columns={uploadData.columns}
          suggestedMapping={uploadData.suggested_mapping}
          templates={templates}
          onApplyMapping={handleApplyMapping}
          onSaveTemplate={handleSaveTemplate}
          isSubmitting={isIngesting}
        />
      )}

      {/* Asynchronous Ingestion Multi-Stage Progress Stepper */}
      {(isIngesting || ingestionStatus) && (
        <div className="workbench-panel">
          <div className="panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>ASYNC INGESTION PIPELINE EXECUTION</span>
              {taskId && <span className="badge badge-outline-dark mono">{taskId}</span>}
            </div>
            <span className="mono" style={{ fontSize: '12px', fontWeight: 600 }}>
              PROGRESS: {ingestionProgress}%
            </span>
          </div>

          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Progress Bar Container */}
            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'var(--bg-dark-panel)',
                borderRadius: '9999px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${ingestionProgress}%`,
                  backgroundColor: ingestionProgress === 100 ? 'var(--risk-normal)' : 'var(--accent-gold)',
                  transition: 'width 300ms ease-out',
                }}
              />
            </div>

            {/* Stage Indicators */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '8px',
              }}
            >
              {INGESTION_STAGES.map((stg, idx) => {
                const currentStageIndex = INGESTION_STAGES.findIndex((s) => s.key === currentStageKey);
                const isPassed = idx < currentStageIndex || ingestionProgress === 100;
                const isCurrent = idx === currentStageIndex && ingestionProgress < 100;

                return (
                  <div
                    key={stg.key}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isPassed
                        ? 'var(--risk-normal-bg)'
                        : isCurrent
                        ? 'var(--accent-gold-bg)'
                        : 'var(--bg-surface-subtle)',
                      border: isPassed
                        ? '1px solid var(--risk-normal-border)'
                        : isCurrent
                        ? '1px solid var(--accent-gold)'
                        : '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        backgroundColor: isPassed
                          ? 'var(--risk-normal)'
                          : isCurrent
                          ? 'var(--accent-gold)'
                          : 'var(--border-default)',
                        color: '#ffffff',
                      }}
                    >
                      {isPassed ? '✓' : idx + 1}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {stg.label}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                        {isPassed ? 'Completed' : isCurrent ? 'Processing...' : 'Pending'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span>
                Current Task Stage: <strong>{currentStageLabel}</strong>
              </span>
              {isIngesting && (
                <span className="mono" style={{ color: 'var(--accent-gold)' }}>
                  Processing batch in background...
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Ingestion Execution & Results */}
      {ingestionStatus && ingestionStatus.is_done && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* View Tab Selector */}
          <div className="pill-tab-group" style={{ width: 'fit-content' }}>
            <button
              type="button"
              className={`pill-tab ${activeTab === 'validation' ? 'active' : ''}`}
              onClick={() => setActiveTab('validation')}
            >
              1. Validation Report
            </button>
            <button
              type="button"
              className={`pill-tab ${activeTab === 'provenance' ? 'active' : ''}`}
              onClick={() => setActiveTab('provenance')}
            >
              2. Transformation Provenance
            </button>
            <button
              type="button"
              className={`pill-tab ${activeTab === 'entities' ? 'active' : ''}`}
              onClick={() => setActiveTab('entities')}
            >
              3. Resolved Entities ({entities.length})
            </button>
          </div>

          {/* Tab 1: Validation Report */}
          {activeTab === 'validation' && (
            <ValidationReport report={ingestionStatus.report} />
          )}

          {/* Tab 2: Provenance Viewer */}
          {activeTab === 'provenance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label htmlFor="txn-picker" style={{ fontSize: '12px', fontWeight: 600 }}>
                  CHOOSE RECORD TO AUDIT:
                </label>
                <select
                  id="txn-picker"
                  className="select mono"
                  value={selectedTxn}
                  onChange={(e) => handleTxnChange(e.target.value)}
                  style={{ width: '320px' }}
                >
                  <option value="TXN_7701">TXN_7701 (8000EBD30 → PLANTCYC1 ₹4,50,000)</option>
                  <option value="TXN_7702">TXN_7702 (PLANTCYC1 → PLANTCYC2 ₹4,46,000)</option>
                  <option value="TXN_7810">TXN_7810 (PLANTFAN01 → PLANTFAN00 ₹2,80,000)</option>
                </select>
              </div>
              <Timeline steps={provenanceSteps} transactionId={selectedTxn} />
            </div>
          )}

          {/* Tab 3: Entity Resolution View */}
          {activeTab === 'entities' && (
            <div className="workbench-panel">
              <div className="panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>RESOLVED ENTITY CLUSTERS</span>
                  <span className="badge badge-neutral">{entities.length} Clusters</span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Merged by fuzzy name, VPA identifiers, and device binding
                </span>
              </div>

              <div className="panel-body" style={{ padding: 0 }}>
                {entities.length === 0 ? (
                  <div className="empty-state">
                    <h3>No Resolved Entities Found</h3>
                    <p>Run ingestion on a batch to cluster resolved identities.</p>
                  </div>
                ) : (
                  <table className="analyst-table">
                    <thead>
                      <tr>
                        <th>Entity ID</th>
                        <th>Primary Name</th>
                        <th>Match Score</th>
                        <th>Resolution Reason</th>
                        <th>Aliases & Associated Identifiers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entities.map((ent) => (
                        <tr key={ent.id}>
                          <td className="mono">{ent.id}</td>
                          <td>
                            <strong>{ent.display_name}</strong>
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                              {ent.entity_type}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                ent.match_score >= 0.9 ? 'badge-risk-normal' : 'badge-risk-watch'
                              } num mono`}
                            >
                              {(ent.match_score * 100).toFixed(0)}% Match
                            </span>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {ent.match_reason}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {ent.aliases.map((al, idx) => (
                                <span
                                  key={idx}
                                  className="badge badge-neutral mono"
                                  style={{ fontSize: '12px' }}
                                  title={`${al.match_reason} (${(al.match_score * 100).toFixed(0)}%)`}
                                >
                                  {al.alias_value}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
