import React, { useEffect, useState } from 'react';
import { client } from '../api/client';

export default function HealthBadge() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  const fetchHealth = async () => {
    try {
      const data = await client.getHealth();
      setHealth(data);
    } catch (err) {
      setHealth({ status: 'error', postgres: false, neo4j: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const timer = setInterval(fetchHealth, 30000);
    return () => clearInterval(timer);
  }, []);

  const isMock = client.isMockMode();
  const isHealthy = health && health.status === 'ok' && health.postgres && health.neo4j;

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 12px',
          borderRadius: '9999px',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          border: isHealthy
            ? isMock
              ? '1px solid var(--accent-gold)'
              : '1px solid var(--risk-normal)'
            : '1px solid var(--risk-critical)',
          backgroundColor: isHealthy
            ? isMock
              ? 'var(--accent-gold-bg)'
              : 'var(--risk-normal-bg)'
            : 'var(--risk-critical-bg)',
          color: isHealthy
            ? isMock
              ? 'var(--accent-gold-border)'
              : 'var(--risk-normal-text)'
            : 'var(--risk-critical-text)',
          cursor: 'pointer',
        }}
        title="Click to view backend and services diagnostic details"
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isHealthy
              ? isMock
                ? 'var(--accent-gold)'
                : 'var(--risk-normal)'
              : 'var(--risk-critical)',
          }}
        />
        <span>
          {loading
            ? 'CHECKING SERVICES...'
            : isMock
            ? 'MOCK MODE ACTIVE'
            : isHealthy
            ? 'BACKEND CONNECTED'
            : 'BACKEND OFFLINE'}
        </span>
      </button>

      {showDetails && (
        <div
          style={{
            position: 'absolute',
            top: '36px',
            right: 0,
            width: '280px',
            backgroundColor: 'var(--bg-dark-panel)',
            border: '1px solid var(--bg-dark-border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            color: 'var(--text-dark-primary)',
            boxShadow: 'var(--shadow-panel)',
            zIndex: 100,
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid var(--bg-dark-border)', paddingBottom: '4px' }}>
            <span style={{ color: 'var(--text-dark-muted)' }}>SERVICE HEALTH</span>
            <button
              onClick={() => setShowDetails(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-dark-muted)', cursor: 'pointer', fontSize: '12px' }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
            <span>Data Mode:</span>
            <span style={{ color: isMock ? 'var(--accent-gold)' : 'var(--risk-normal)' }}>
              {isMock ? 'VITE_USE_MOCKS=true' : 'LIVE API'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
            <span>PostgreSQL:</span>
            <span style={{ color: health?.postgres ? 'var(--risk-normal)' : 'var(--risk-critical)' }}>
              {health?.postgres ? 'HEALTHY' : 'DOWN'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
            <span>Neo4j Graph:</span>
            <span style={{ color: health?.neo4j ? 'var(--risk-normal)' : 'var(--risk-critical)' }}>
              {health?.neo4j ? 'HEALTHY' : 'DOWN'}
            </span>
          </div>
          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--bg-dark-border)', textAlign: 'right' }}>
            <button
              onClick={fetchHealth}
              className="btn btn-sm btn-gold"
              style={{ padding: '2px 8px', fontSize: '11px' }}
            >
              ↻ RE-CHECK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
