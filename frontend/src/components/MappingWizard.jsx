import React, { useState } from 'react';

const CANONICAL_FIELDS = [
  { key: 'timestamp', label: 'Timestamp', required: true, desc: 'Transaction execution datetime' },
  { key: 'from_account', label: 'From Account (Remitter)', required: true, desc: 'Originator account or VPA' },
  { key: 'to_account', label: 'To Account (Beneficiary)', required: true, desc: 'Destination account or VPA' },
  { key: 'amount', label: 'Amount', required: true, desc: 'Transaction monetary value' },
  { key: 'currency', label: 'Currency', required: true, desc: 'ISO currency code (INR, USD, etc.)' },
  { key: 'payment_format', label: 'Payment Format', required: false, desc: 'UPI, NEFT, IMPS, RTGS, Wire' },
  { key: 'device_id', label: 'Device ID', required: false, desc: 'Hardware UUID / Mobile fingerprint' },
  { key: 'phone', label: 'Phone', required: false, desc: 'Registered mobile number' },
  { key: 'ip', label: 'IP Address', required: false, desc: 'Client network IP' },
  { key: 'beneficiary_name', label: 'Beneficiary Name', required: false, desc: 'Reported payee string' },
  { key: 'is_laundering', label: 'Is Laundering (Ground Truth)', required: false, desc: 'Supervised flag for evaluation' },
];

export default function MappingWizard({
  columns = [],
  suggestedMapping = {},
  templates = [],
  onApplyMapping,
  onSaveTemplate,
  isSubmitting = false,
}) {
  const [mapping, setMapping] = useState({ ...suggestedMapping });
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showSaveTpl, setShowSaveTpl] = useState(false);

  const handleFieldChange = (canonicalKey, sourceCol) => {
    setMapping((prev) => ({
      ...prev,
      [canonicalKey]: sourceCol,
    }));
  };

  const handleTemplateSelect = (e) => {
    const tplId = e.target.value;
    setSelectedTemplate(tplId);
    if (!tplId) return;
    const tpl = templates.find((t) => t.id === tplId);
    if (tpl && tpl.mapping) {
      setMapping({ ...tpl.mapping });
    }
  };

  const handleSaveTemplateSubmit = (e) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;
    onSaveTemplate(newTemplateName.trim(), mapping);
    setNewTemplateName('');
    setShowSaveTpl(false);
  };

  // Check required fields
  const missingRequired = CANONICAL_FIELDS.filter(
    (f) => f.required && !mapping[f.key]
  );

  return (
    <div className="workbench-panel">
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>SCHEMA MAPPING WIZARD</span>
          <span className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)' }}>
            {columns.length} CSV Columns Detected
          </span>
        </div>

        {/* Templates Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="tpl-select" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            TEMPLATE:
          </label>
          <select
            id="tpl-select"
            className="select"
            value={selectedTemplate}
            onChange={handleTemplateSelect}
            style={{ fontSize: '12px', padding: '3px 8px', minHeight: '28px' }}
          >
            <option value="">-- Load Saved Template --</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowSaveTpl(!showSaveTpl)}
          >
            Save as Template...
          </button>
        </div>
      </div>

      {showSaveTpl && (
        <form
          onSubmit={handleSaveTemplateSubmit}
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--bg-surface-subtle)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600 }}>Save Current Mapping:</span>
          <input
            type="text"
            className="input"
            placeholder="Template name (e.g. Core Banking CSV)"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            style={{ flex: 1, minHeight: '28px', fontSize: '12px' }}
            required
          />
          <button type="submit" className="btn btn-primary btn-sm">
            Save
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowSaveTpl(false)}
          >
            Cancel
          </button>
        </form>
      )}

      <div className="panel-body" style={{ padding: 0 }}>
        <table className="analyst-table">
          <thead>
            <tr>
              <th style={{ width: '25%' }}>Canonical Attribute</th>
              <th style={{ width: '30%' }}>Description</th>
              <th style={{ width: '30%' }}>Source CSV Column</th>
              <th style={{ width: '15%' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {CANONICAL_FIELDS.map((field) => {
              const mappedCol = mapping[field.key] || '';
              const isMapped = Boolean(mappedCol);
              return (
                <tr key={field.key}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                        {field.key}
                      </strong>
                      {field.required && (
                        <span
                          style={{ color: 'var(--risk-critical)', fontWeight: 700 }}
                          title="Mandatory canonical field"
                        >
                          *
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {field.desc}
                  </td>
                  <td>
                    <select
                      className="select"
                      value={mappedCol}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      style={{
                        width: '100%',
                        fontSize: '12px',
                        borderColor: field.required && !isMapped ? 'var(--risk-critical)' : 'var(--border-default)',
                      }}
                    >
                      <option value="">-- Unmapped --</option>
                      {columns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {isMapped ? (
                      <span className="badge badge-risk-normal">✓ Mapped</span>
                    ) : field.required ? (
                      <span className="badge badge-risk-critical">Required</span>
                    ) : (
                      <span className="badge badge-neutral">Optional</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--bg-surface-subtle)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {missingRequired.length > 0 ? (
              <span style={{ color: 'var(--risk-critical)', fontWeight: 600 }}>
                ⚠ {missingRequired.length} mandatory field(s) unmapped ({missingRequired.map((f) => f.key).join(', ')})
              </span>
            ) : (
              <span style={{ color: 'var(--risk-normal-text)', fontWeight: 600 }}>
                ✓ All mandatory fields successfully mapped
              </span>
            )}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            disabled={missingRequired.length > 0 || isSubmitting}
            onClick={() => onApplyMapping(mapping)}
          >
            {isSubmitting ? 'Submitting Mapping...' : 'Confirm Mapping & Run Ingestion →'}
          </button>
        </div>
      </div>
    </div>
  );
}
