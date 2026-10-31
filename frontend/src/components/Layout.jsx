import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import HealthBadge from './HealthBadge';

const NAV_ITEMS = [
  { path: '/upload', index: '1', label: 'Ingestion & Mapping' },
  { path: '/alerts', index: '2', label: 'Alerts & Explain' },
  { path: '/graph', index: '3', label: 'Graph Explorer' },
  { path: '/cases', index: '4', label: 'Investigation Cases' },
  { path: '/rules', index: '5', label: 'Rules & Feedback' },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="app-container">
      {/* Sidebar Left Nav */}
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="brand-section">
            <div className="brand-shield" aria-hidden="true">
              ⛨
            </div>
            <div>
              <div className="brand-title">FRAUD INTEL</div>
              <div className="brand-subtitle">Anomaly Workbench</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main Navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                isActive || (item.path === '/cases' && location.pathname.startsWith('/cases'))
                  ? 'nav-link active'
                  : 'nav-link'
              }
            >
              <span className="nav-index">0{item.index}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          <div>ENVIRONMENT: AML-PROD-IN</div>
          <div>MODEL: ISO-FOREST + GRAPHS</div>
          <div style={{ marginTop: '4px', opacity: 0.85 }}>DESK ID: FIU-IND-77</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="app-main">
        {/* Top Header */}
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Transaction Forensic Terminal
            </span>
            <span style={{ height: '14px', width: '1px', backgroundColor: 'var(--border-default)' }} />
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              CORE DATASET: IBM AML ENRICHED (50K TXNS)
            </span>
          </div>

          <div className="header-badges">
            <HealthBadge />
          </div>
        </header>

        {/* Routed Page Content */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
