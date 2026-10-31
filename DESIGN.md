# Design System: Financial Fraud Graph & Transaction Anomaly Workbench

Derived directly from `docs/frontend/design/Design.png` and calibrated for anti-money laundering forensic intelligence.

## 1. Visual World & Color Palette

### Base Substrates
- `--bg-canvas`: `#f5f3ec` (Warm cream/paper ground)
- `--bg-surface`: `#ffffff` (Card & pane surface)
- `--bg-surface-subtle`: `#ede9df` (Subtle warm contrast)
- `--border-subtle`: `#e3ded3` (Warm neutral border)
- `--border-strong`: `#c9c2b3` (Contrasting divider)

### Dark Evidential Consoles (from Design.png)
- `--bg-dark-panel`: `#121927` (Deep slate navy container)
- `--bg-dark-surface`: `#182234` (Dark card elevated surface)
- `--bg-dark-border`: `#232f46` (Dark card border)
- `--text-dark-primary`: `#f8fafc` (High contrast pure light text)
- `--text-dark-muted`: `#94a3b8` (Muted secondary metadata)

### Light Neutral Text
- `--text-primary`: `#0f172a` (Deep slate black)
- `--text-secondary`: `#475569` (Muted charcoal)
- `--text-tertiary`: `#64748b` (Caption/hint text)

### Accent & Interaction
- `--accent-navy`: `#0f172a` (Primary button and active nav state)
- `--accent-gold`: `#f59e0b` (Action highlight & primary CTA border from Design.png)
- `--accent-gold-bg`: `rgba(245, 158, 11, 0.08)`

### Semantic Risk Signals (ALWAYS with text label + number)
- `--risk-normal`: `#10b981` (Emerald green; Normal / Validated)
- `--risk-normal-bg`: `rgba(16, 185, 129, 0.12)`
- `--risk-watch`: `#0284c7` (Sky blue; Watch / Info)
- `--risk-watch-bg`: `rgba(2, 132, 199, 0.12)`
- `--risk-high`: `#d97706` (Amber gold; High Risk / Suspicious)
- `--risk-high-bg`: `rgba(217, 119, 6, 0.12)`
- `--risk-critical`: `#dc2626` (Crimson red; Critical / Confirmed Fraud)
- `--risk-critical-bg`: `rgba(220, 38, 38, 0.12)`

## 2. Typography & Numbers
- **System Stack**: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Monospace Stack**: `"JetBrains Mono", SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`
- **Numeric Discipline**: All currency figures, amounts, counts, and percentages use `font-variant-numeric: tabular-nums` and right alignment.
- **Identifiers**: All transaction hashes, account IDs, IP addresses, and device IDs rendered in Monospace.

## 3. Elevation & Radius
- `--radius-sm`: `4px`
- `--radius-md`: `6px`
- `--radius-lg`: `8px`
- `--shadow-card`: `0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)`
- `--shadow-panel`: `0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)`

## 4. Components Rules
- **Header & HealthBadge**: Capsule pill with live health indicator dot (`#10b981` for connected, `#dc2626` for offline/mock).
- **Navigation Tabs**: Pill buttons with clear active state (`--accent-navy` fill or strong border), index prefix (`1 Overview`, etc.), no bounce animations.
- **Tables**: Crisp border grids, right-aligned monetary values, sticky header, row click selection with clear highlight.
- **ExplainPanel**: Right-side drawer/split-pane with 200ms ease-out slide; tabs for plain-English reason, evidence matrix, ML score breakdown, linked transactions, and raw JSON payload.
- **Graph Nodes**:
  - `account`: Circular node (`#1e293b` fill, risk border)
  - `device`: Diamond node (`#0284c7` border)
  - `phone`: Hexagonal node (`#d97706` border)
  - `merchant`: Square node (`#64748b` border)
  - Edge thickness mapped to transfer volume.
- **Anti-slop Compliance**: Zero glowing shadows, zero purple gradients, zero emojis as icons, zero placeholder copy.
