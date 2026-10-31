import React, { useState, useEffect } from 'react';
import { client } from '../api/client';
import MappingWizard from '../components/MappingWizard';
import ValidationReport from '../components/ValidationReport';
import Timeline from '../components/Timeline';

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadData, setUploadData] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [batchId, setBatchId] = useState(null);
  const [ingestionStatus, setIngestionStatus] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [provenanceSteps, setProvenanceSteps] = useState([]);
  const [selectedTxn, setSelectedTxn] = useState('TXN_7701');
  const [entities, setEntities] = useState([]);
  const [activeTab, setActiveTab] = useState('validation'); // 'validation' | 'provenance' | 'entities'

  // Load initial templates and default mock state
  useEffect(() => {
    async function init() {
      try {
        const tpls = await client.getMappingTemplates();
        setTemplates(tpls || []);
      } catch (err) {
        console.error('Failed to fetch templates:', err);
      }
    }
    init();
  }, []);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      const res = await client.uploadFile(formData);
      setUploadData(res);
      setBatchId(res.batch_id);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // Pre-load default mock file for instant zero-friction analyst testing
  const handleLoadDemoDataset = async () => {
    setIsUploading(true);
    try {
      const res = await client.uploadFile(new FormData());
      setUploadData(res);
      setBatchId(res.batch_id);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveTemplate = async (name, mapping) => {
    try {
      const newTpl = await client.saveMappingTemplate(name, mapping);
      setTemplates((prev) => [...prev, newTpl]);
    } catch (err) {
      console.error('Save template error:', err);
    }
  };

  const handleApplyMapping = async (mapping) => {
    if (!batchId) return;
    setIsPolling(true);
    try {
      await client.saveMapping(batchId, mapping);
      await client.runIngestion(batchId);
      // Poll ingestion status
      const statusRes = await client.getIngestionStatus(batchId);
      setIngestionStatus(statusRes);
      // Also fetch provenance and resolved entities
      const prov = await client.getProvenance(batchId, 'transaction', selectedTxn);
      setProvenanceSteps(prov || []);
      const entList = await client.getBatchEntities(batchId);
      setEntities(entList || []);
    } catch (err) {
      console.error('Ingestion run failed:', err);
    } finally {
      setIsPolling(false);
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
          <button
            type="button"
            className="btn btn-gold btn-sm"
            onClick={handleLoadDemoDataset}
            style={{ width: 'fit-content' }}
          >
            → LOAD 50K DEMO BATCH (ENRICHED)
          </button>
        </div>
      </div>

      {/* Step 1: File Upload / Picker */}
      <div className="workbench-panel">
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>STEP 1: SELECT RAW TRANSACTION CSV</span>
            {batchId && <span className="badge badge-risk-normal mono">Batch: {batchId}</span>}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Accepts CSV with banking or UPI fields
          </span>
        </div>

        <div className="panel-body">
          <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                border: '1px dashed var(--border-strong)',
                padding: '28px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-surface-subtle)',
                cursor: 'pointer',
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
              }}
            >
              <input
                id="file-upload"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '24px' }}>📁</span>
                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                  {file ? file.name : 'Click to select CSV file or drag and drop here'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  Supported formats: RFC 4180 CSV with headers (Max 100MB)
                </span>
              </label>
            </div>

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
                  disabled={isUploading || (!file && !uploadData)}
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
          isSubmitting={isPolling}
        />
      )}

      {/* Step 3: Ingestion Execution & Results */}
      {ingestionStatus && (
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
                  style={{ width: '260px' }}
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
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
