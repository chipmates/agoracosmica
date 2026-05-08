// Agora Cosmica — Dashboard HTML Template (V2)
// Self-contained: all CSS + JS + HTML inline. Zero external deps except Google Fonts.

export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Agora Cosmica — Analytics</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230D1338'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-family='system-ui' font-weight='700' font-size='16' fill='%23E6BC5C'%3EAC%3C/text%3E%3C/svg%3E">
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg-void: #0D1338;
  --bg-primary: #151C47;
  --bg-card: #1C245C;
  --bg-highlight: #2A3374;
  --gold: #E6BC5C;
  --gold-subtle: #D4A539;
  --gold-deep: #B38B30;
  --ok: #68C397;
  --warn: #F5A623;
  --err: #E97451;
  --s-wisdom: #9D83CD;
  --s-freetalk: #68C397;
  --s-quest: #E97451;
  --s-prism: #5B8BD4;
  --s-story: #E6BC5C;
  --tx: #D2D2D2;
  --tx2: #CACACA;
  --dim: #8A8A8A;
  --radius: 16px;
  --radius-sm: 8px;
  --sidebar-w: 160px;
  --sidebar-c: 56px;
  --bar-h: 56px;
  --status-h: 0px;
}

body {
  font-family: 'Space Grotesk', system-ui, sans-serif;
  background: var(--bg-void);
  color: var(--tx);
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
}

/* === STATUS BAR === */
#status-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  height: 0; overflow: hidden;
  display: flex; align-items: center; gap: 8px;
  padding: 0 16px;
  font-size: 0.8125rem; font-weight: 500;
  transition: height 0.3s ease, background 0.3s ease;
}
#status-bar.visible {
  height: 36px;
}
#status-bar.s-ok { background: color-mix(in srgb, var(--ok) 12%, var(--bg-void)); color: var(--ok); }
#status-bar.s-warn { background: color-mix(in srgb, var(--warn) 12%, var(--bg-void)); color: var(--warn); }
#status-bar.s-err { background: color-mix(in srgb, var(--err) 12%, var(--bg-void)); color: var(--err); }
.status-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  background: currentColor;
}
.status-dot.pulse { animation: pulse 2s infinite; }
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.2); }
}

/* === APP SHELL === */
#app {
  display: flex;
  height: 100vh; height: 100dvh;
  padding-top: var(--status-h);
  transition: padding-top 0.3s ease;
}

/* === SIDEBAR (desktop + tablet) === */
#sidebar {
  width: var(--sidebar-w);
  background: var(--bg-primary);
  border-right: 1px solid color-mix(in srgb, var(--gold-deep) 15%, transparent);
  display: flex; flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
  z-index: 50;
}
.sidebar-brand {
  padding: 20px 16px 4px;
  font-size: 0.8125rem; font-weight: 600; color: var(--gold);
  letter-spacing: 0.03em;
  white-space: nowrap; overflow: hidden;
}
.sidebar-since {
  padding: 0 16px 12px;
  font-size: 0.6875rem; color: var(--dim);
  letter-spacing: 0.02em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sidebar-since:empty { display: none; }
.sidebar-nav { flex: 1; padding: 4px 0; }
.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 0 12px; height: 44px;
  color: var(--dim); font-size: 0.8125rem; font-weight: 500;
  cursor: pointer; border: none; background: none; width: 100%;
  text-align: left; font-family: inherit;
  border-left: 3px solid transparent;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  white-space: nowrap; overflow: hidden;
}
.nav-item:hover { background: var(--bg-highlight); color: var(--tx2); }
.nav-item.active {
  border-left-color: var(--gold);
  background: color-mix(in srgb, var(--gold) 8%, transparent);
  color: var(--gold);
}
.nav-item svg { width: 20px; height: 20px; flex-shrink: 0; }
.nav-item .nav-label { overflow: hidden; text-overflow: ellipsis; }

/* Sidebar: time range */
.sidebar-section {
  padding: 16px 12px 8px;
  border-top: 1px solid color-mix(in srgb, var(--gold-deep) 10%, transparent);
}
.sidebar-section-label {
  font-size: 0.625rem; font-weight: 600; color: var(--dim);
  text-transform: uppercase; letter-spacing: 0.08em;
  margin-bottom: 8px; padding-left: 3px;
}
.range-pills-v {
  display: flex; flex-direction: column; gap: 4px;
}
.range-pill {
  display: block; width: 100%; padding: 6px 12px;
  font-family: inherit; font-size: 0.75rem; font-weight: 500;
  border: 1px solid color-mix(in srgb, var(--gold-deep) 15%, transparent);
  border-radius: 999px; background: transparent;
  color: var(--dim); cursor: pointer;
  transition: all 0.15s; text-align: left;
}
.range-pill:hover { border-color: var(--gold-deep); color: var(--tx2); }
.range-pill.active {
  background: color-mix(in srgb, var(--gold) 12%, transparent);
  border-color: var(--gold-deep); color: var(--gold);
}

/* Sidebar footer */
.sidebar-footer {
  padding: 12px; font-size: 0.6875rem; color: var(--dim);
  border-top: 1px solid color-mix(in srgb, var(--gold-deep) 10%, transparent);
  white-space: nowrap; overflow: hidden;
}

/* === BOTTOM TAB BAR (mobile) === */
#mobile-tabs {
  display: none;
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
  height: var(--bar-h);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: var(--bg-primary);
  backdrop-filter: blur(12px);
  border-top: 1px solid color-mix(in srgb, var(--gold-deep) 15%, transparent);
}
.mobile-tabs-inner {
  display: flex; height: var(--bar-h);
}
.mob-tab {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 3px;
  background: none; border: none; color: var(--dim);
  font-family: inherit; font-size: 0.5625rem; font-weight: 500;
  cursor: pointer; padding: 0;
  border-top: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
  min-width: 0;
}
.mob-tab svg { width: 22px; height: 22px; }
.mob-tab.active { color: var(--gold); border-top-color: var(--gold); }

/* Mobile time range (sticky top) */
.mobile-range {
  display: none;
  position: sticky; top: 0; z-index: 10;
  padding: 8px 12px;
  background: var(--bg-void);
  border-bottom: 1px solid color-mix(in srgb, var(--gold-deep) 10%, transparent);
  overflow-x: auto; -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.mobile-range::-webkit-scrollbar { display: none; }
.mobile-range-inner {
  display: flex; gap: 6px; white-space: nowrap;
}
.range-pill-h {
  padding: 8px 14px; font-family: inherit; font-size: 0.75rem; font-weight: 500;
  border: 1px solid color-mix(in srgb, var(--gold-deep) 15%, transparent);
  border-radius: 999px; background: transparent;
  color: var(--dim); cursor: pointer; transition: all 0.15s;
  flex-shrink: 0;
}
.range-pill-h:hover { border-color: var(--gold-deep); color: var(--tx2); }
.range-pill-h.active {
  background: color-mix(in srgb, var(--gold) 12%, transparent);
  border-color: var(--gold-deep); color: var(--gold);
}

/* === MAIN CONTENT === */
#content {
  flex: 1; overflow-y: auto; overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 20px;
}
.tab-section { display: none; max-width: 1400px; margin: 0 auto; }
.tab-section.active { display: block; animation: fadeIn 0.2s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

.tab-header {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 16px;
}
.tab-title {
  font-size: 1.125rem; font-weight: 600; color: var(--gold);
}
.tab-updated {
  font-size: 0.6875rem; color: var(--dim);
}

/* === BENTO GRID === */
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

/* === CARDS === */
.card {
  background: color-mix(in srgb, var(--bg-card) 85%, transparent);
  backdrop-filter: blur(8px) saturate(120%);
  border: 1px solid color-mix(in srgb, var(--gold-deep) 12%, transparent);
  border-radius: var(--radius);
  padding: 1.125rem;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--gold) 5%, transparent),
    0 2px 12px color-mix(in srgb, #000 12%, transparent);
  position: relative;
  transition: opacity 0.15s ease;
}
.card-hero { padding: 1.25rem; }
.card-wide { grid-column: span 2; }
.card-full { grid-column: 1 / -1; }
.card-interactive { cursor: pointer; }
.card-interactive:hover {
  border-color: color-mix(in srgb, var(--gold-deep) 30%, transparent);
}
.card-interactive:focus-visible {
  outline: 2px solid var(--gold); outline-offset: 2px;
}

/* KPI card internals */
.kpi-top { display: flex; justify-content: space-between; align-items: flex-start; }
.kpi-label {
  font-size: 0.6875rem; font-weight: 500; color: var(--dim);
  text-transform: uppercase; letter-spacing: 0.06em;
}
.kpi-spark { flex-shrink: 0; margin-left: 8px; }
.kpi-value {
  font-size: 1.75rem; font-weight: 700; color: var(--gold);
  line-height: 1.1; margin-top: 6px;
  transition: opacity 0.15s ease;
}
.card-hero .kpi-value { font-size: 2.25rem; }
.kpi-bottom { display: flex; align-items: center; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
.kpi-delta {
  font-size: 0.75rem; font-weight: 500;
  display: inline-flex; align-items: center; gap: 2px;
}
.kpi-delta.up { color: var(--ok); }
.kpi-delta.down { color: var(--err); }
.kpi-delta.flat { color: var(--dim); }
.kpi-sub { font-size: 0.75rem; color: var(--dim); }

/* Section dividers */
.section-divider {
  font-size: 0.6875rem; font-weight: 600; color: var(--dim);
  text-transform: uppercase; letter-spacing: 0.06em;
  margin: 24px 0 12px;
  padding-left: 2px;
  display: flex; align-items: center; gap: 10px;
}
.section-divider::after {
  content: ''; flex: 1; height: 1px;
  background: color-mix(in srgb, var(--gold-deep) 15%, transparent);
}

/* Limits config grid */
.limits-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
  margin-top: 10px;
}
.limits-grid > div { text-align: center; }
.lim-val {
  display: block; font-size: 1.125rem; font-weight: 700; color: var(--gold);
  line-height: 1.2;
}
.lim-key {
  display: block; font-size: 0.625rem; color: var(--dim);
  text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px;
}
@media (max-width: 640px) {
  .limits-grid { grid-template-columns: repeat(3, 1fr); gap: 10px; }
}

/* === CHARTS === */

/* Bar chart (horizontal) */
.bar-chart { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
.bar-row { display: flex; align-items: center; gap: 8px; }
.bar-label {
  font-size: 0.75rem; color: var(--tx2); min-width: 90px;
  text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  flex-shrink: 0;
}
.bar-track {
  flex: 1; height: 22px; background: var(--bg-primary);
  border-radius: var(--radius-sm); overflow: hidden;
}
.bar-fill {
  height: 100%; border-radius: var(--radius-sm);
  transition: width 0.5s ease; min-width: 2px;
}
.bar-val {
  font-size: 0.75rem; color: var(--dim); min-width: 36px;
  text-align: right; flex-shrink: 0;
}

/* Donut chart */
.donut-wrap { display: flex; align-items: center; gap: 14px; margin-top: 6px; }
.donut-legend { display: flex; flex-direction: column; gap: 4px; }
.donut-item { display: flex; align-items: center; gap: 6px; font-size: 0.8125rem; }
.donut-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

/* Data table */
.tbl-wrap { overflow-x: auto; margin-top: 6px; -webkit-overflow-scrolling: touch; }
table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
th {
  text-align: left; color: var(--dim); font-weight: 500;
  padding: 6px 10px;
  border-bottom: 1px solid var(--bg-highlight);
  white-space: nowrap;
}
td {
  padding: 6px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--bg-highlight) 40%, transparent);
  white-space: nowrap;
}

/* Gauge (server tab) */
.gauge-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}
.gauge-card {
  background: var(--bg-card); border-radius: var(--radius);
  padding: 14px; text-align: center;
  border: 1px solid color-mix(in srgb, var(--gold-deep) 10%, transparent);
}
.gauge-label {
  font-size: 0.625rem; font-weight: 600; color: var(--dim);
  text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px;
}
.gauge-val { font-size: 1.375rem; font-weight: 700; line-height: 1; }
.gauge-detail { font-size: 0.6875rem; color: var(--dim); margin-top: 4px; }
.gauge-bar {
  height: 4px; background: var(--bg-primary);
  border-radius: 2px; margin-top: 8px; overflow: hidden;
}
.gauge-bar-fill { height: 100%; border-radius: 2px; transition: width 1s ease; }
.c-ok { color: var(--ok); } .c-warn { color: var(--warn); } .c-err { color: var(--err); }
.b-ok { background: var(--ok); } .b-warn { background: var(--warn); } .b-err { background: var(--err); }

/* Service badges */
.svc-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.svc-badge {
  font-size: 0.6875rem; padding: 3px 8px; border-radius: 999px;
  background: color-mix(in srgb, var(--ok) 12%, transparent);
  color: var(--ok);
  border: 1px solid color-mix(in srgb, var(--ok) 25%, transparent);
}
.svc-badge.down {
  background: color-mix(in srgb, var(--err) 12%, transparent);
  color: var(--err);
  border-color: color-mix(in srgb, var(--err) 25%, transparent);
}

/* Server panel */
.server-panel { margin-bottom: 20px; }
.server-panel-title {
  font-size: 0.875rem; font-weight: 600; color: var(--tx2);
  margin-bottom: 10px; display: flex; align-items: center; gap: 8px;
}
.server-panel-title .status-dot { width: 8px; height: 8px; border-radius: 50%; }
.server-freshness { font-size: 0.6875rem; color: var(--dim); margin-top: 8px; }

/* Alert card */
.alert-card {
  padding: 10px 14px; border-radius: var(--radius-sm);
  font-size: 0.8125rem; font-weight: 500;
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 8px;
}
.alert-card.a-warn {
  background: color-mix(in srgb, var(--warn) 10%, transparent);
  border-left: 3px solid var(--warn); color: var(--warn);
}
.alert-card.a-err {
  background: color-mix(in srgb, var(--err) 10%, transparent);
  border-left: 3px solid var(--err); color: var(--err);
}

/* Placeholder (Ad Grants tab) */
.placeholder {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 60px 20px; text-align: center;
  color: var(--dim);
}
.placeholder svg { width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.4; }
.placeholder h3 { font-size: 1rem; color: var(--tx2); margin-bottom: 8px; }
.placeholder p { font-size: 0.875rem; max-width: 360px; line-height: 1.5; }

/* Skeleton loading */
.skeleton {
  background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-highlight) 50%, var(--bg-card) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 6px;
}
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.skel-label { height: 10px; width: 60px; margin-bottom: 10px; }
.skel-value { height: 28px; width: 100px; margin-bottom: 6px; }
.skel-sub { height: 10px; width: 80px; }

/* Empty / error states */
.empty-state {
  padding: 24px; text-align: center;
  color: var(--dim); font-size: 0.8125rem;
}
.hint-banner {
  padding: 10px 14px; border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--s-prism) 8%, transparent);
  color: var(--tx2); font-size: 0.8125rem; margin-bottom: 14px;
}
.hint-banner a { color: var(--gold); cursor: pointer; text-decoration: underline; }

/* Insight text */
.insight {
  font-size: 0.8125rem; color: var(--dim); font-style: italic;
  padding: 6px 0 0;
}

/* Correlation chart */
.corr-chart { position: relative; margin-top: 8px; }
.corr-bars { display: flex; align-items: flex-end; gap: 2px; height: 100px; }
.corr-bar {
  flex: 1; border-radius: 3px 3px 0 0;
  background: color-mix(in srgb, var(--s-prism) 60%, transparent);
  transition: height 0.3s ease; min-height: 1px;
}
.corr-labels {
  display: flex; justify-content: space-between;
  font-size: 0.625rem; color: var(--dim); margin-top: 4px;
}
.corr-gpu-line {
  position: absolute; left: 0; right: 0;
  border-top: 2px dashed var(--warn); opacity: 0.5;
  pointer-events: none;
}
.corr-gpu-label {
  position: absolute; right: 0; font-size: 0.5625rem;
  color: var(--warn); opacity: 0.7; transform: translateY(-14px);
}

/* SVG Graph charts */
.graph-wrap { margin-top: 8px; width: 100%; overflow: hidden; }
.graph-wrap svg { width: 100%; height: auto; display: block; }
.graph-wrap svg text { font-family: 'Space Grotesk', system-ui, sans-serif; }
.graph-tooltip {
  position: absolute; padding: 4px 8px; border-radius: 6px;
  background: var(--bg-primary); border: 1px solid var(--gold-deep);
  color: var(--tx); font-size: 0.6875rem; pointer-events: none;
  white-space: nowrap; z-index: 10; opacity: 0; transition: opacity 0.15s;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bg-highlight); border-radius: 3px; }
html { scrollbar-color: var(--bg-highlight) transparent; scrollbar-width: thin; }

/* === RESPONSIVE === */

/* Tablet */
@media (max-width: 1024px) {
  #sidebar { width: var(--sidebar-c); }
  .sidebar-brand { padding: 16px 0; text-align: center; font-size: 1rem; }
  .nav-item { justify-content: center; padding: 0; }
  .nav-item .nav-label { display: none; }
  .sidebar-section { padding: 12px 8px 8px; }
  .sidebar-section-label { display: none; }
  .range-pill { text-align: center; padding: 6px 4px; font-size: 0.6875rem; }
  .sidebar-footer { display: none; }
  .grid { grid-template-columns: repeat(2, 1fr); }
  #content { padding: 16px; }
}

/* Mobile */
@media (max-width: 640px) {
  #sidebar { display: none; }
  #mobile-tabs { display: block; }
  .mobile-range { display: block; }
  #content {
    padding: 0 12px 12px;
    padding-bottom: calc(var(--bar-h) + env(safe-area-inset-bottom, 0px) + 12px);
  }
  .grid { grid-template-columns: 1fr; }
  .card-wide, .card-full { grid-column: span 1; }
  .card-hero .kpi-value { font-size: 1.75rem; }
  .kpi-spark { display: none; }
  .bar-label { min-width: 70px; font-size: 0.6875rem; }
  .tab-header { flex-direction: column; gap: 2px; margin-bottom: 12px; }
  .tab-updated { align-self: flex-start; }
  .corr-bars { height: 70px; }
}

/* === PRINT === */
@media print {
  #sidebar, #mobile-tabs, #status-bar, .mobile-range, .sidebar-section { display: none !important; }
  body { background: white; color: #222; }
  #app { display: block; }
  #content { padding: 0; overflow: visible; }
  .tab-section { display: block !important; page-break-after: always; }
  .card {
    background: white; border: 1px solid #ccc; box-shadow: none;
    backdrop-filter: none; break-inside: avoid;
  }
  .kpi-value { color: #222; }
  .tab-title { color: #222; }
  .grid { grid-template-columns: repeat(3, 1fr); }
}

/* === REDUCED MOTION === */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  .tab-section.active { animation: none; }
}
</style>
</head>
<body>

<!-- Status Bar -->
<div id="status-bar" role="status" aria-live="assertive"></div>

<!-- App Shell -->
<div id="app">

<!-- Sidebar (desktop/tablet) -->
<nav id="sidebar" aria-label="Dashboard navigation">
  <div class="sidebar-brand">Agora Cosmica</div>
  <div class="sidebar-since" id="since-label" aria-live="polite"></div>
  <div class="sidebar-nav">
    <button class="nav-item active" data-tab="overview" aria-current="page">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
      <span class="nav-label">Overview</span>
    </button>
    <button class="nav-item" data-tab="servers">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></svg>
      <span class="nav-label">Servers</span>
    </button>
    <button class="nav-item" data-tab="product">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      <span class="nav-label">Product</span>
    </button>
    <button class="nav-item" data-tab="adgrants">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><line x1="12" y1="6" x2="12" y2="18"/><path d="M5 21h14"/></svg>
      <span class="nav-label">Ad Grants</span>
    </button>
  </div>
  <div class="sidebar-section">
    <div class="sidebar-section-label">Period</div>
    <div class="range-pills-v" id="range-desktop"></div>
  </div>
  <div class="sidebar-footer" id="sidebar-footer">v2.0</div>
</nav>

<!-- Main Content -->
<main id="content">

<!-- Mobile time range (sticky) -->
<div class="mobile-range"><div class="mobile-range-inner" id="range-mobile"></div></div>

<!-- Tab: Overview -->
<section class="tab-section active" id="tab-overview" aria-labelledby="title-overview">
  <div class="tab-header">
    <h2 class="tab-title" id="title-overview">Overview</h2>
    <span class="tab-updated" id="updated-overview"></span>
  </div>
  <div id="alerts-overview"></div>
  <div class="grid" id="grid-overview">
    <div class="card card-hero"><div class="skel-label skeleton"></div><div class="skel-value skeleton"></div><div class="skel-sub skeleton"></div></div>
    <div class="card card-hero"><div class="skel-label skeleton"></div><div class="skel-value skeleton"></div><div class="skel-sub skeleton"></div></div>
    <div class="card"><div class="skel-label skeleton"></div><div class="skel-value skeleton"></div><div class="skel-sub skeleton"></div></div>
  </div>
</section>

<!-- Tab: Servers -->
<section class="tab-section" id="tab-servers" aria-labelledby="title-servers">
  <div class="tab-header">
    <h2 class="tab-title" id="title-servers">Servers</h2>
    <span class="tab-updated" id="updated-servers"></span>
  </div>
  <div id="content-servers"><div class="empty-state">Loading server data...</div></div>
</section>

<!-- Tab: Product -->
<section class="tab-section" id="tab-product" aria-labelledby="title-product">
  <div class="tab-header">
    <h2 class="tab-title" id="title-product">Product</h2>
    <span class="tab-updated" id="updated-product"></span>
  </div>
  <div id="alerts-product"></div>
  <div id="grid-product">
    <div class="card card-hero"><div class="skel-label skeleton"></div><div class="skel-value skeleton"></div><div class="skel-sub skeleton"></div></div>
    <div class="card"><div class="skel-label skeleton"></div><div class="skel-value skeleton"></div><div class="skel-sub skeleton"></div></div>
    <div class="card"><div class="skel-label skeleton"></div><div class="skel-value skeleton"></div><div class="skel-sub skeleton"></div></div>
  </div>
</section>

<!-- Tab: Ad Grants -->
<section class="tab-section" id="tab-adgrants" aria-labelledby="title-adgrants">
  <div class="tab-header">
    <h2 class="tab-title" id="title-adgrants">Ad Grants Conversions</h2>
  </div>
  <div id="alerts-adgrants" class="alerts"></div>
  <div class="grid" id="grid-adgrants"></div>
</section>

</main>
</div>

<!-- Bottom Tab Bar (mobile) -->
<nav id="mobile-tabs" aria-label="Tab navigation">
<div class="mobile-tabs-inner">
  <button class="mob-tab active" data-tab="overview">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
    Overview
  </button>
  <button class="mob-tab" data-tab="servers">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></svg>
    Servers
  </button>
  <button class="mob-tab" data-tab="product">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
    Product
  </button>
  <button class="mob-tab" data-tab="adgrants">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="17 11 12 6 7 11"/><line x1="12" y1="6" x2="12" y2="18"/><path d="M5 21h14"/></svg>
    Ad Grants
  </button>
</div>
</nav>

<script>
// ═══════════════════════════════════════════════════════════
// Agora Cosmica Dashboard — Client Logic
// ═══════════════════════════════════════════════════════════

// --- Config ---
const COLORS = {
  modes: { seed_conversation: '#9D83CD', free_conversation: '#68C397', seed_challenge: '#E97451', council: '#5B8BD4', summary: '#E6BC5C' },
  lang: { de: '#E6BC5C', en: '#5B8BD4' },
  servers: { fsn1: '#68C397', nbg1: '#9D83CD' },
  models: { 'qwen3-tts': '#9D83CD', kokoro: '#68C397', 'f5-tts': '#5B8BD4', whisper: '#E6BC5C' },
  rl: { gpu_capacity_german: '#E97451', daily_limit: '#F5A623', burst_limit: '#9D83CD', daily: '#F5A623', global: '#E97451', council: '#5B8BD4', summary: '#E6BC5C' },
};
const MODE_LABELS = { seed_conversation: 'Wisdom', free_conversation: 'Freetalk', seed_challenge: 'Quest' };
const RANGE_OPTS = [
  { val: 1, label: 'Today' },
  { val: 7, label: '7 days' },
  { val: 30, label: '30 days' },
  { val: 365, label: 'Year' },
  { val: 9999, label: 'All time' },
];
const RANGE_LABEL = { 1: 'today', 7: 'last 7 days', 30: 'last 30 days', 365: 'last year', 9999: 'all time' };

// Public-launch epoch (Unix seconds). Substituted by the worker at request time
// from env.LAUNCH_EPOCH_SECONDS. 0 = no floor, no label.
const LAUNCH_EPOCH_SECONDS = __LAUNCH_EPOCH_SECONDS__;

// --- State ---
let S = {
  tab: 'overview',
  range: 1,
  cache: {},
  serverData: null,
  gpuHist: { fsn1: [], nbg1: [] },
  lastServer: 0,
  lastAnalytics: 0,
  serverTimer: null,
  analyticsTimer: null,
  statusHidden: 0,
};

// --- Utility functions ---

function fmt(n) {
  if (n == null || isNaN(n)) return '0';
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

function fmtMs(n) {
  if (n == null || isNaN(n)) return '-';
  n = Math.round(n);
  if (n >= 60000) return Math.floor(n / 60000) + 'm ' + Math.round((n % 60000) / 1000) + 's';
  if (n >= 1000) return (n / 1000).toFixed(1) + 's';
  return n + 'ms';
}

function pct(a, b) { return b > 0 ? Math.round(a / b * 100) : 0; }

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function modeLabel(m) { return MODE_LABELS[m] || cap(m); }

function tier(p) { return p >= 90 ? 'err' : p >= 75 ? 'warn' : 'ok'; }

function now() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

function iv() { return String(S.range); }

// Sparkline: monotone cubic interpolation
function sparkSvg(pts, w, h, color) {
  if (!pts || pts.length < 2) return '';
  const n = pts.length;
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const range = max - min || 1;
  const px = pts.map((v, i) => ({ x: (i / (n - 1)) * w, y: h - ((v - min) / range) * (h - 4) - 2 }));

  // Build path with smooth curves
  let d = 'M' + px[0].x.toFixed(1) + ',' + px[0].y.toFixed(1);
  for (let i = 1; i < n; i++) {
    const p0 = px[Math.max(0, i - 2)];
    const p1 = px[i - 1];
    const p2 = px[i];
    const p3 = px[Math.min(n - 1, i + 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ' C' + cp1x.toFixed(1) + ',' + cp1y.toFixed(1) + ' ' + cp2x.toFixed(1) + ',' + cp2y.toFixed(1) + ' ' + p2.x.toFixed(1) + ',' + p2.y.toFixed(1);
  }

  // Area fill path
  const areaD = d + ' L' + w + ',' + h + ' L0,' + h + ' Z';

  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="display:block">' +
    '<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + color + '" stop-opacity="0.25"/><stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + areaD + '" fill="url(#sg)"/>' +
    '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round"/>' +
    '</svg>';
}

// Delta HTML
function deltaHtml(cur, prev) {
  if (prev == null || prev === 0 && cur === 0) return '<span class="kpi-delta flat">-</span>';
  const diff = cur - prev;
  const pctVal = prev > 0 ? Math.round((diff / prev) * 100) : (diff > 0 ? 100 : 0);
  const abs = Math.abs(pctVal);
  if (abs <= 2 && Math.abs(diff) <= 1) return '<span class="kpi-delta flat">~0</span>';
  const cls = diff > 0 ? 'up' : 'down';
  const arrow = diff > 0 ? '&#9650;' : '&#9660;';
  const sign = diff > 0 ? '+' : '';
  return '<span class="kpi-delta ' + cls + '">' + arrow + ' ' + sign + fmt(diff) + ' (' + sign + pctVal + '%)</span>';
}

// Donut SVG
function donutSvg(items, cMap, lFn, size) {
  size = size || 76;
  const total = items.reduce(function(s, r) { return s + Number(r.c); }, 0);
  if (total === 0) return '<div class="empty-state">No data</div>';
  const cx = size / 2, cy = size / 2, r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  let offset = 0, paths = '', legend = '';

  items.forEach(function(row) {
    const p = row.c / total;
    const color = cMap[row.key] || '#8A8A8A';
    const dash = p * circ;
    paths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="10" stroke-dasharray="' + dash.toFixed(2) + ' ' + (circ - dash).toFixed(2) + '" stroke-dashoffset="' + (-offset).toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
    offset += dash;
    const label = lFn ? lFn(row.key) : row.key;
    const pc = Math.round(p * 100);
    legend += '<div class="donut-item"><span class="donut-dot" style="background:' + color + '"></span>' + label + ' ' + pc + '% (' + row.c + ')</div>';
  });

  return '<div class="donut-wrap">' +
    '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + items.map(function(r) { return (lFn ? lFn(r.key) : r.key) + ' ' + Math.round(r.c / total * 100) + '%'; }).join(', ') + '">' + paths + '</svg>' +
    '<div class="donut-legend">' + legend + '</div></div>';
}

// KPI Card HTML
function kpi(label, value, opts) {
  opts = opts || {};
  const heroClass = opts.hero ? ' card-hero' : '';
  const interClass = opts.click ? ' card-interactive' : '';
  const clickAttr = opts.click ? ' onclick="' + opts.click + '" tabindex="0" role="button"' : '';
  const sparkHtml = opts.spark ? '<div class="kpi-spark">' + sparkSvg(opts.spark, 72, 28, opts.sparkColor || '#D4A539') + '</div>' : '';
  const deltaStr = opts.delta !== undefined ? deltaHtml(value, opts.delta) : '';
  const subStr = opts.sub ? '<span class="kpi-sub">' + opts.sub + '</span>' : '';
  const valStr = typeof value === 'string' ? value : fmt(value);
  const valColor = opts.valColor ? ' style="color:' + opts.valColor + '"' : '';

  return '<div class="card' + heroClass + interClass + '"' + clickAttr + '>' +
    '<div class="kpi-top"><span class="kpi-label">' + label + '</span>' + sparkHtml + '</div>' +
    '<div class="kpi-value"' + valColor + '>' + valStr + '</div>' +
    '<div class="kpi-bottom">' + deltaStr + subStr + '</div></div>';
}

// Chart card wrapper
function chartCard(title, body, cls) {
  return '<div class="card ' + (cls || '') + '"><div class="kpi-label" style="margin-bottom:6px">' + title + '</div>' + body + '</div>';
}

// Horizontal bar chart
function barsHtml(items, color) {
  if (!items || items.length === 0) return '<div class="empty-state">No data for this period</div>';
  const max = Math.max(...items.map(function(r) { return r.c; }));
  let html = '<div class="bar-chart">';
  items.forEach(function(row) {
    const w = max > 0 ? (row.c / max * 100) : 0;
    html += '<div class="bar-row"><span class="bar-label">' + row.label + '</span>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + w.toFixed(1) + '%;background:' + (row.color || color) + '"></div></div>' +
      '<span class="bar-val">' + fmt(row.c) + '</span></div>';
  });
  return html + '</div>';
}

// Table HTML
function tableHtml(headers, rows) {
  if (!rows || rows.length === 0) return '<div class="empty-state">No data for this period</div>';
  let html = '<div class="tbl-wrap"><table><tr>';
  headers.forEach(function(h) { html += '<th>' + h + '</th>'; });
  html += '</tr>';
  rows.forEach(function(r) {
    html += '<tr>';
    r.forEach(function(cell) { html += '<td>' + cell + '</td>'; });
    html += '</tr>';
  });
  return html + '</table></div>';
}

// SVG vertical bar chart (proper graph with axes)
function svgBarGraph(data, opts) {
  if (!data || data.length === 0) return '<div class="empty-state">No data for this period</div>';
  opts = opts || {};
  var color = opts.color || '#5B8BD4';
  var h = opts.height || 160;
  var padL = 40, padR = 10, padT = 10, padB = 28;
  var w = 600; // viewBox width, scales responsively
  var plotW = w - padL - padR;
  var plotH = h - padT - padB;
  var n = data.length;
  var maxVal = Math.max.apply(null, data.map(function(d) { return d.c; }));
  if (maxVal === 0) maxVal = 1;
  var barW = Math.max(2, (plotW / n) - 2);
  var gap = (plotW - barW * n) / Math.max(n - 1, 1);

  // Y-axis: 4 grid lines
  var ySteps = 4;
  var stepVal = Math.ceil(maxVal / ySteps);
  // Round step to nice numbers
  if (stepVal > 10) stepVal = Math.ceil(stepVal / 5) * 5;
  if (stepVal > 100) stepVal = Math.ceil(stepVal / 50) * 50;
  var yMax = stepVal * ySteps;

  var svg = '<div class="graph-wrap"><svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + (opts.ariaLabel || 'Bar chart') + '">';

  // Grid lines + Y labels
  for (var i = 0; i <= ySteps; i++) {
    var yVal = stepVal * i;
    var yPos = padT + plotH - (yVal / yMax) * plotH;
    svg += '<line x1="' + padL + '" y1="' + yPos.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + yPos.toFixed(1) + '" stroke="#2A3374" stroke-width="0.5" stroke-dasharray="' + (i === 0 ? '0' : '3,3') + '"/>';
    if (i > 0) {
      svg += '<text x="' + (padL - 6) + '" y="' + (yPos + 3).toFixed(1) + '" text-anchor="end" fill="#8A8A8A" font-size="9">' + fmt(yVal) + '</text>';
    }
  }

  // Bars + X labels
  var labelInterval = Math.max(1, Math.ceil(n / 12)); // Show max ~12 labels
  data.forEach(function(d, i) {
    var x = padL + i * (barW + gap);
    var barH = (d.c / yMax) * plotH;
    var y = padT + plotH - barH;
    svg += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + Math.max(barH, 0.5).toFixed(1) + '" rx="2" fill="' + color + '" opacity="0.75"><title>' + d.label + ': ' + d.c + '</title></rect>';

    // X-axis label
    if (i % labelInterval === 0 || i === n - 1) {
      svg += '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (h - 4) + '" text-anchor="middle" fill="#8A8A8A" font-size="8">' + d.label + '</text>';
    }
  });

  svg += '</svg></div>';
  return svg;
}

// SVG area chart (line graph with filled area)
function svgAreaGraph(data, opts) {
  if (!data || data.length < 2) return '<div class="empty-state">No data for this period</div>';
  opts = opts || {};
  var color = opts.color || '#68C397';
  var h = opts.height || 160;
  var padL = 40, padR = 10, padT = 10, padB = 28;
  var w = 600;
  var plotW = w - padL - padR;
  var plotH = h - padT - padB;
  var n = data.length;
  var maxVal = Math.max.apply(null, data.map(function(d) { return d.c; }));
  if (maxVal === 0) maxVal = 1;

  // Y-axis
  var ySteps = 4;
  var stepVal = Math.ceil(maxVal / ySteps);
  if (stepVal > 10) stepVal = Math.ceil(stepVal / 5) * 5;
  if (stepVal > 100) stepVal = Math.ceil(stepVal / 50) * 50;
  var yMax = stepVal * ySteps;

  // Compute points
  var pts = data.map(function(d, i) {
    return {
      x: padL + (i / (n - 1)) * plotW,
      y: padT + plotH - (d.c / yMax) * plotH,
      label: d.label,
      c: d.c
    };
  });

  var svg = '<div class="graph-wrap"><svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + (opts.ariaLabel || 'Area chart') + '">';

  // Gradient
  svg += '<defs><linearGradient id="ag-' + color.replace('#', '') + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + color + '" stop-opacity="0.3"/><stop offset="100%" stop-color="' + color + '" stop-opacity="0.02"/></linearGradient></defs>';

  // Grid lines + Y labels
  for (var i = 0; i <= ySteps; i++) {
    var yVal = stepVal * i;
    var yPos = padT + plotH - (yVal / yMax) * plotH;
    svg += '<line x1="' + padL + '" y1="' + yPos.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + yPos.toFixed(1) + '" stroke="#2A3374" stroke-width="0.5" stroke-dasharray="' + (i === 0 ? '0' : '3,3') + '"/>';
    if (i > 0) {
      svg += '<text x="' + (padL - 6) + '" y="' + (yPos + 3).toFixed(1) + '" text-anchor="end" fill="#8A8A8A" font-size="9">' + fmt(yVal) + '</text>';
    }
  }

  // Build smooth path (monotone cubic)
  var lineD = 'M' + pts[0].x.toFixed(1) + ',' + pts[0].y.toFixed(1);
  for (var i = 1; i < n; i++) {
    var p0 = pts[Math.max(0, i - 2)];
    var p1 = pts[i - 1];
    var p2 = pts[i];
    var p3 = pts[Math.min(n - 1, i + 1)];
    var cp1x = p1.x + (p2.x - p0.x) / 6;
    var cp1y = p1.y + (p2.y - p0.y) / 6;
    var cp2x = p2.x - (p3.x - p1.x) / 6;
    var cp2y = p2.y - (p3.y - p1.y) / 6;
    lineD += ' C' + cp1x.toFixed(1) + ',' + cp1y.toFixed(1) + ' ' + cp2x.toFixed(1) + ',' + cp2y.toFixed(1) + ' ' + p2.x.toFixed(1) + ',' + p2.y.toFixed(1);
  }

  // Area fill (close path along bottom)
  var areaD = lineD + ' L' + pts[n - 1].x.toFixed(1) + ',' + (padT + plotH) + ' L' + pts[0].x.toFixed(1) + ',' + (padT + plotH) + ' Z';
  svg += '<path d="' + areaD + '" fill="url(#ag-' + color.replace('#', '') + ')"/>';
  svg += '<path d="' + lineD + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round"/>';

  // Data dots
  pts.forEach(function(p) {
    svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3" fill="' + color + '" opacity="0.8"><title>' + p.label + ': ' + p.c + '</title></circle>';
  });

  // X labels
  var labelInterval = Math.max(1, Math.ceil(n / 10));
  pts.forEach(function(p, i) {
    if (i % labelInterval === 0 || i === n - 1) {
      svg += '<text x="' + p.x.toFixed(1) + '" y="' + (h - 4) + '" text-anchor="middle" fill="#8A8A8A" font-size="8">' + p.label + '</text>';
    }
  });

  svg += '</svg></div>';
  return svg;
}

// --- Query helpers ---

function sparkBucket() {
  if (S.range <= 1) return "'1' HOUR";
  if (S.range <= 30) return "'1' DAY";
  return "'30' DAY";
}

function sparkPoints() {
  if (S.range <= 1) return 12;
  if (S.range <= 7) return 7;
  if (S.range <= 30) return 30;
  return 12;
}

function prevRange() {
  // Previous equivalent period for delta comparison
  return "BETWEEN NOW() - INTERVAL '" + (S.range * 2) + "' DAY AND NOW() - INTERVAL '" + S.range + "' DAY";
}

async function batch(queries) {
  try {
    const res = await fetch('/api/query-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: queries }),
    });
    if (!res.ok) return queries.map(function() { return { data: [] }; });
    const json = await res.json();
    return json.results || queries.map(function() { return { data: [] }; });
  } catch (e) {
    return queries.map(function() { return { data: [] }; });
  }
}

function val(result) { return Number(result && result.data && result.data[0] ? result.data[0].c : 0); }
function rows(result) {
  return ((result && result.data) || []).map(function(r) {
    var out = Object.assign({}, r);
    if (out.c !== undefined) out.c = Number(out.c);
    if (out.avg_ms !== undefined) out.avg_ms = Number(out.avg_ms);
    return out;
  });
}

// --- Status Bar ---

function updateStatus() {
  var el = document.getElementById('status-bar');
  var msgs = [];
  var level = 'ok';

  if (S.serverData) {
    var d = S.serverData;
    ['fsn1', 'nbg1'].forEach(function(id) {
      var s = d[id];
      if (!s || s.error) {
        msgs.push(id.toUpperCase() + ' unreachable');
        level = 'err';
      } else if (s.gpu && s.gpu.utilization_percent >= 90) {
        msgs.push(id.toUpperCase() + ' GPU high (' + Math.round(s.gpu.utilization_percent) + '%)');
        if (level !== 'err') level = 'warn';
      }
    });
  }

  var serverAge = Date.now() - S.lastServer;
  if (S.lastServer > 0 && serverAge > 30000) {
    msgs.push('Server data stale (' + Math.round(serverAge / 1000) + 's ago)');
    if (level !== 'err') level = 'warn';
  }

  if (msgs.length === 0) {
    // Hide status bar after 5 seconds of "all OK"
    if (!S.statusHidden) S.statusHidden = Date.now();
    if (Date.now() - S.statusHidden > 5000) {
      el.className = '';
      el.innerHTML = '';
      document.documentElement.style.setProperty('--status-h', '0px');
      return;
    }
    el.className = 'visible s-ok';
    el.innerHTML = '<span class="status-dot"></span> All systems operational';
  } else {
    S.statusHidden = 0;
    el.className = 'visible s-' + level;
    var dotClass = level === 'err' ? ' pulse' : '';
    el.innerHTML = '<span class="status-dot' + dotClass + '"></span> ' + msgs.join(' · ');
  }
  document.documentElement.style.setProperty('--status-h', '36px');
}

// --- Server Health ---

async function loadServerHealth() {
  try {
    var res = await fetch('/api/server-stats');
    if (!res.ok) throw new Error('fetch failed');
    S.serverData = await res.json();
    S.lastServer = Date.now();

    // Track GPU history (for sparklines)
    ['fsn1', 'nbg1'].forEach(function(id) {
      var s = S.serverData[id];
      if (s && s.gpu && typeof s.gpu.utilization_percent === 'number') {
        S.gpuHist[id].push(s.gpu.utilization_percent);
        if (S.gpuHist[id].length > 60) S.gpuHist[id].shift();
      }
    });
  } catch (e) {
    // Keep old data, status bar will show stale warning
  }

  updateStatus();

  if (S.tab === 'servers') renderServers();
  if (S.tab === 'overview') updateOverviewServers();

  clearTimeout(S.serverTimer);
  S.serverTimer = setTimeout(loadServerHealth, 10000);
}

// --- Tab: Overview ---

async function loadOverview() {
  var grid = document.getElementById('grid-overview');
  var alertsEl = document.getElementById('alerts-overview');

  var queries = [
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'session' AND blob5 = '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'session' AND blob5 = '200' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'chat' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'chat' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'council' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'summary' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_audio WHERE blob5 = 'speech' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_audio' },
    { sql: "SELECT COUNT() as c FROM agora_audio WHERE blob5 = 'speech' AND timestamp " + prevRange(), dataset: 'agora_audio' },
    { sql: "SELECT COUNT() as c FROM agora_audio WHERE blob5 = 'transcriptions' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_audio' },
    // LLM errors (non-200 chat/council/summary)
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 IN ('chat','council','summary') AND blob5 != '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    // Audio errors
    { sql: "SELECT COUNT() as c FROM agora_audio WHERE blob5 IN ('speech','transcriptions') AND blob4 != '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_audio' },
    // Rate limits
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'ratelimit' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_audio WHERE blob5 = 'ratelimit' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_audio' },
    // Sparkline: sessions
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE blob1 = 'session' AND blob5 = '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
    // Sparkline: chats
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE blob1 = 'chat' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
    // Sparkline: TTS
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_audio WHERE blob5 = 'speech' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_audio' },
    // Hourly chat (for correlation chart)
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL '1' HOUR) as t, COUNT() as c FROM agora_llm WHERE blob1 = 'chat' AND timestamp > NOW() - INTERVAL '" + Math.min(S.range, 7) + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
    // Daily trend (for range > 1)
    S.range > 1
      ? { sql: "SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) as t, COUNT() as c FROM agora_llm WHERE blob1 = 'session' AND blob5 = '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' }
      : { sql: "SELECT 1 as c", dataset: 'agora_llm' },
    // Top figure
    { sql: "SELECT blob2 as figure, COUNT() as c FROM agora_llm WHERE blob1 = 'chat' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY figure ORDER BY c DESC LIMIT 1", dataset: 'agora_llm' },
    // Language split (for insight)
    { sql: "SELECT blob4 as lang, COUNT() as c FROM agora_llm WHERE blob1 = 'chat' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY lang ORDER BY c DESC", dataset: 'agora_llm' },
    // Channel sources — Phase 1 marketing attribution (blob6 = marketing_source)
    { sql: "SELECT blob6 as source, COUNT() as c FROM agora_llm WHERE blob1 IN ('chat','council','summary') AND blob5 = '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY source ORDER BY c DESC", dataset: 'agora_llm' },
    // Top countries — Phase 0d geographic breakdown (blob7 = country)
    { sql: "SELECT blob7 as country, COUNT() as c FROM agora_llm WHERE blob1 IN ('chat','council','summary') AND blob5 = '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY country ORDER BY c DESC LIMIT 8", dataset: 'agora_llm' },
  ];

  var r = await batch(queries);
  S.lastAnalytics = Date.now();

  var sessions = val(r[0]), sessionsPrev = val(r[1]);
  var chats = val(r[2]), chatsPrev = val(r[3]);
  var councils = val(r[4]), summaries = val(r[5]);
  var tts = val(r[6]), ttsPrev = val(r[7]);
  var stt = val(r[8]);
  var llmErrors = val(r[9]), audioErrors = val(r[10]);
  var totalErrors = llmErrors + audioErrors;
  var rlLlm = val(r[11]), rlAudio = val(r[12]);
  var totalRl = rlLlm + rlAudio;
  var totalLlm = chats + councils + summaries;
  var voicePct = totalLlm > 0 ? Math.round(tts / totalLlm * 100) : 0;

  var sparkSessions = rows(r[13]).map(function(r) { return r.c; });
  var sparkChats = rows(r[14]).map(function(r) { return r.c; });
  var sparkTts = rows(r[15]).map(function(r) { return r.c; });
  var hourlyChat = rows(r[16]);
  var dailyTrend = S.range > 1 ? rows(r[17]) : [];
  var topFigure = rows(r[18]);
  var langSplit = rows(r[19]);
  var channelSources = rows(r[20]);
  var topCountries = rows(r[21]);

  // Alerts
  var alerts = '';
  if (totalRl > 0) alerts += '<div class="alert-card a-warn">' + totalRl + ' users hit rate limits ' + RANGE_LABEL[S.range] + '</div>';
  if (S.serverData) {
    ['fsn1', 'nbg1'].forEach(function(id) {
      var s = S.serverData[id];
      if (!s || s.error) alerts += '<div class="alert-card a-err">' + id.toUpperCase() + ' unreachable: ' + (s ? s.error : 'offline') + '</div>';
    });
  }
  alertsEl.innerHTML = alerts;

  // Smart empty state
  // Hint banner (above grid, not inside)
  if (S.range === 1 && sessions < 3 && chats < 3) {
    alertsEl.innerHTML += '<div class="hint-banner">Quiet day so far. <a onclick="setRange(7)">Switch to 7 days</a> for more context.</div>';
  }

  var html = '';

  // Hero KPIs
  // "Sessions" counts JWT issuance events (free-tier path only, post-lazy-refresh = roughly per real engagement window).
  // Phase 0a (SESSION_LAST_SEEN KV gating, deferred) will tighten this to "fresh devices".
  html += kpi('Sessions', sessions, { hero: true, spark: sparkSessions, delta: sessionsPrev, sub: 'engagement windows' });
  html += kpi('Conversations', totalLlm, { hero: true, spark: sparkChats, sparkColor: '#5B8BD4', delta: chatsPrev, sub: chats + ' chat · ' + councils + ' council · ' + summaries + ' summary' });

  // Secondary KPIs
  html += kpi('Chat Messages', chats, { spark: sparkChats, delta: chatsPrev });
  html += kpi('TTS Requests', tts, { spark: sparkTts, sparkColor: '#68C397', delta: ttsPrev });
  var voiceDisplay = totalLlm > 0 ? voicePct + '%' : '--';
  var voiceSub = totalLlm > 0 ? tts + ' TTS / ' + totalLlm + ' LLM' : 'no LLM sessions yet';
  html += kpi('Voice Adoption', voiceDisplay, { sub: voiceSub });
  html += kpi('Errors', totalErrors, { sub: totalErrors > 0 ? llmErrors + ' LLM + ' + audioErrors + ' audio' : 'all clear', valColor: totalErrors > 0 ? '#E97451' : '#68C397' });

  // Mini server health
  html += '<div class="card card-interactive" onclick="switchTab(\\\'servers\\\')" tabindex="0" role="button" id="mini-servers"><div class="kpi-label">Server Health</div><div id="mini-servers-inner" style="margin-top:8px">Loading...</div></div>';

  // Chat activity graph (always visible)
  if (hourlyChat.length > 1) {
    var chatItems = hourlyChat.slice(-24).map(function(row) {
      return { label: new Date(row.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), c: row.c };
    });
    html += chartCard('Chat Activity', svgBarGraph(chatItems, { color: '#5B8BD4', height: 140, ariaLabel: 'Chat messages per hour' }), 'card-wide');
  } else {
    html += chartCard('Chat Activity', '<div class="empty-state" style="padding:40px 0">No chat data yet ' + RANGE_LABEL[S.range] + '</div>', 'card-wide');
  }

  // Channel Sources panel (Phase 1 — marketing attribution)
  var channelItems = channelSources.map(function(r) {
    return { label: r.source || 'direct', c: r.c };
  }).filter(function(r) { return r.label && r.c > 0; });
  html += chartCard('Channel Sources', barsHtml(channelItems, '#E6BC5C'), 'card-half');

  // Geographic Breakdown panel (Phase 0d — country dimension)
  var countryItems = topCountries.map(function(r) {
    return { label: r.country || 'XX', c: r.c };
  }).filter(function(r) { return r.label && r.c > 0; });
  html += chartCard('Top Countries', barsHtml(countryItems, '#9D83CD'), 'card-half');

  // Computed insight
  var insights = [];
  if (hourlyChat.length > 0) {
    var busiest = hourlyChat.reduce(function(a, b) { return b.c > a.c ? b : a; }, hourlyChat[0]);
    if (busiest.c > 0) {
      var bTime = new Date(busiest.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      insights.push('Busiest hour: ' + bTime + ' (' + busiest.c + ' chats)');
    }
  }
  if (topFigure.length > 0 && chats > 0) {
    insights.push('Top figure: ' + cap(topFigure[0].figure) + ' (' + pct(topFigure[0].c, chats) + '% of chats)');
  }
  if (langSplit.length >= 2) {
    var de = langSplit.find(function(r) { return r.lang === 'de'; });
    var en = langSplit.find(function(r) { return r.lang === 'en'; });
    if (de && en) {
      var totalLang = de.c + en.c;
      insights.push('DE:EN ' + pct(de.c, totalLang) + ':' + pct(en.c, totalLang));
    }
  }
  if (insights.length > 0) {
    html += '<div class="card card-full" style="padding:10px 14px"><div class="insight">' + insights.slice(0, 3).join(' · ') + '</div></div>';
  }

  // Daily trend (area graph) or TTS activity graph
  if (dailyTrend.length > 1) {
    var trendItems = dailyTrend.map(function(row) {
      return { label: new Date(row.t).toLocaleDateString([], { month: 'short', day: 'numeric' }), c: row.c };
    });
    html += chartCard('Daily Sessions', svgAreaGraph(trendItems, { color: '#68C397', ariaLabel: 'Daily sessions trend' }), 'card-full');
  } else if (sparkTts.length > 1) {
    // Show TTS activity as area graph when no daily session trend
    var ttsItems = sparkTts.map(function(v, i) { return { label: String(i), c: v }; });
    html += chartCard('TTS Activity', svgAreaGraph(ttsItems, { color: '#68C397', height: 120, ariaLabel: 'TTS requests over time' }), 'card-full');
  }

  grid.innerHTML = html;
  var ts = now();
  document.getElementById('updated-overview').textContent = 'Updated ' + ts;
  document.getElementById('sidebar-footer').textContent = 'Updated ' + ts;
  updateOverviewServers();
}

function updateOverviewServers() {
  var el = document.getElementById('mini-servers-inner');
  if (!el) return;
  if (!S.serverData) { el.innerHTML = '<span style="color:var(--dim);font-size:0.8125rem">Waiting for data...</span>'; return; }
  var html = '<div style="display:flex;gap:12px;flex-wrap:wrap">';
  ['fsn1', 'nbg1'].forEach(function(id) {
    var s = S.serverData[id];
    if (!s || s.error) {
      html += '<div style="flex:1;min-width:120px"><span class="status-dot" style="background:var(--err);display:inline-block;margin-right:6px"></span><span style="color:var(--err);font-size:0.8125rem">' + id.toUpperCase() + ' offline</span></div>';
    } else {
      var gpu = s.gpu ? Math.round(s.gpu.utilization_percent) : 0;
      var vram = s.gpu ? (s.gpu.vram_used_gb / s.gpu.vram_total_gb * 100).toFixed(0) : 0;
      var t = tier(gpu);
      html += '<div style="flex:1;min-width:120px"><span class="status-dot" style="background:var(--' + t + ');display:inline-block;margin-right:6px"></span><span style="font-size:0.8125rem;color:var(--tx2)">' + id.toUpperCase() + '</span><div style="font-size:0.75rem;color:var(--dim);margin-top:2px">GPU ' + gpu + '% · VRAM ' + vram + '%</div></div>';
    }
  });
  html += '</div>';
  el.innerHTML = html;
}

// --- Tab: Servers ---

function renderServers() {
  var el = document.getElementById('content-servers');
  if (!S.serverData) {
    el.innerHTML = '<div class="empty-state">Waiting for server data...</div>';
    return;
  }

  var html = '';
  ['fsn1', 'nbg1'].forEach(function(id) {
    var s = S.serverData[id];
    var label = id === 'fsn1' ? 'FSN1 Falkenstein' : 'NBG1 Nurnberg';

    if (!s || s.error) {
      html += '<div class="server-panel"><div class="server-panel-title"><span class="status-dot" style="background:var(--err)"></span>' + label + '</div><div class="empty-state">' + (s ? s.error : 'Offline') + '</div></div>';
      return;
    }

    var gpu = s.gpu || {};
    var cpu = s.cpu || {};
    var ram = s.ram || {};
    var disk = s.disk || {};
    var net = s.network || {};
    var svcs = s.services || {};

    var gpuPct = gpu.utilization_percent || 0;
    var vramPct = gpu.vram_total_gb > 0 ? (gpu.vram_used_gb / gpu.vram_total_gb * 100) : 0;
    var ramPct = ram.total_gb > 0 ? (ram.used_gb / ram.total_gb * 100) : 0;
    var cpuPct = cpu.usage_percent || 0;
    var diskPct = disk.usage_percent || 0;
    var t = tier(gpuPct);

    html += '<div class="server-panel">';
    html += '<div class="server-panel-title"><span class="status-dot" style="background:var(--' + t + ')"></span>' + label + '</div>';

    // GPU gauge (SVG arc)
    var arcSize = 110;
    var arcR = 42;
    var arcCirc = 2 * Math.PI * arcR;
    var arcFill = (gpuPct / 100) * arcCirc;
    var arcColor = 'var(--' + t + ')';
    var gpuSparkColor = t === 'ok' ? '#68C397' : t === 'warn' ? '#F5A623' : '#E97451';
    var gpuSpark = S.gpuHist[id].length > 2 ? '<div style="margin-top:10px">' + sparkSvg(S.gpuHist[id], 160, 32, gpuSparkColor) + '</div>' : '';

    html += '<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">';
    html += '<div style="text-align:center">';
    html += '<svg width="' + arcSize + '" height="' + arcSize + '" viewBox="0 0 ' + arcSize + ' ' + arcSize + '">';
    html += '<circle cx="' + arcSize/2 + '" cy="' + arcSize/2 + '" r="' + arcR + '" fill="none" stroke="var(--bg-highlight)" stroke-width="8" opacity="0.3"/>';
    if (gpuPct > 0) {
      html += '<circle cx="' + arcSize/2 + '" cy="' + arcSize/2 + '" r="' + arcR + '" fill="none" stroke="' + arcColor + '" stroke-width="8" stroke-dasharray="' + arcFill.toFixed(1) + ' ' + (arcCirc - arcFill).toFixed(1) + '" stroke-dashoffset="0" transform="rotate(-90 ' + arcSize/2 + ' ' + arcSize/2 + ')" stroke-linecap="round" style="transition:stroke-dasharray 1s ease"/>';
    }
    html += '<text x="' + arcSize/2 + '" y="' + (arcSize/2 + 2) + '" text-anchor="middle" font-family="Space Grotesk,system-ui" font-size="22" font-weight="700" fill="' + arcColor + '">' + Math.round(gpuPct) + '%</text>';
    html += '<text x="' + arcSize/2 + '" y="' + (arcSize/2 + 18) + '" text-anchor="middle" font-family="Space Grotesk,system-ui" font-size="10" fill="var(--dim)">GPU</text>';
    html += '</svg>';
    html += '<div style="font-size:0.6875rem;color:var(--dim)">' + (gpu.temperature_celsius || '?') + 'C · ' + (gpu.power_watts || '?') + 'W</div>';
    html += '</div>';
    html += '<div style="flex:1;min-width:180px;max-width:360px">';
    html += '<div style="font-size:0.75rem;color:var(--dim);margin-bottom:4px">VRAM ' + (gpu.vram_used_gb || 0).toFixed(1) + ' / ' + (gpu.vram_total_gb || 48) + ' GB</div>';
    html += '<div class="gauge-bar"><div class="gauge-bar-fill b-' + tier(vramPct) + '" style="width:' + Math.min(vramPct, 100).toFixed(0) + '%"></div></div>';
    html += gpuSpark;
    html += '</div></div>';

    // System resources
    html += '<div class="gauge-grid" style="margin-top:12px">';

    function gaugeCard(label, pctVal, detail) {
      var t2 = tier(pctVal);
      return '<div class="gauge-card"><div class="gauge-label">' + label + '</div><div class="gauge-val c-' + t2 + '">' + Math.round(pctVal) + '%</div><div class="gauge-bar"><div class="gauge-bar-fill b-' + t2 + '" style="width:' + Math.min(pctVal, 100) + '%"></div></div><div class="gauge-detail">' + detail + '</div></div>';
    }

    html += gaugeCard('CPU', cpuPct, (cpu.cores || '?') + ' cores');
    html += gaugeCard('RAM', ramPct, (ram.used_gb || 0).toFixed(0) + ' / ' + (ram.total_gb || 128).toFixed(0) + ' GB');
    html += gaugeCard('Disk', diskPct, '');
    html += '<div class="gauge-card"><div class="gauge-label">Network</div><div class="gauge-val c-ok" style="font-size:0.875rem">' + (net.bandwidth_in_mbps || 0).toFixed(0) + ' / ' + (net.bandwidth_out_mbps || 0).toFixed(0) + '</div><div class="gauge-detail">in / out Mbit/s</div></div>';
    html += '</div>';

    // Services
    var svcHtml = '';
    Object.keys(svcs).forEach(function(name) {
      var info = svcs[name];
      var ok = info.healthy === info.total;
      svcHtml += '<span class="svc-badge' + (ok ? '' : ' down') + '">' + name + ' ' + info.healthy + '/' + info.total + '</span>';
    });
    if (svcHtml) html += '<div class="svc-row">' + svcHtml + '</div>';

    // Freshness
    var age = Math.round((Date.now() - S.lastServer) / 1000);
    var freshClass = age > 60 ? 'color:var(--err)' : age > 30 ? 'color:var(--warn)' : '';
    html += '<div class="server-freshness" style="' + freshClass + '">Updated ' + age + 's ago' + (age > 30 ? ' (stale)' : '') + '</div>';

    html += '</div>';
  });

  el.innerHTML = html;
  document.getElementById('updated-servers').textContent = 'Updated ' + now();
}

// --- Tab: Product ---

async function loadProduct() {
  var grid = document.getElementById('grid-product');
  var alertsEl = document.getElementById('alerts-product');

  var queries = [
    // Engagement KPIs
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'session' AND blob5 = '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'session' AND blob5 = '200' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'chat' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'chat' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'council' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'council' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'summary' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'summary' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    // Sparklines
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE blob1 = 'session' AND blob5 = '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE blob1 = 'chat' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
    // Figure popularity
    { sql: "SELECT blob2 as figure, COUNT() as c FROM agora_llm WHERE blob1 = 'chat' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY figure ORDER BY c DESC LIMIT 10", dataset: 'agora_llm' },
    // Mode distribution
    { sql: "SELECT blob3 as mode, COUNT() as c FROM agora_llm WHERE blob1 = 'chat' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY mode ORDER BY c DESC", dataset: 'agora_llm' },
    // Language split
    { sql: "SELECT blob4 as lang, COUNT() as c FROM agora_llm WHERE blob1 = 'chat' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY lang ORDER BY c DESC", dataset: 'agora_llm' },
    // Figure x Mode
    { sql: "SELECT blob2 as figure, blob3 as mode, COUNT() as c FROM agora_llm WHERE blob1 = 'chat' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY figure, mode ORDER BY c DESC LIMIT 15", dataset: 'agora_llm' },
    // Chat activity timeline
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE blob1 = 'chat' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
    // Audio KPIs
    { sql: "SELECT COUNT() as c FROM agora_audio WHERE blob5 = 'speech' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_audio' },
    { sql: "SELECT COUNT() as c FROM agora_audio WHERE blob5 = 'speech' AND timestamp " + prevRange(), dataset: 'agora_audio' },
    { sql: "SELECT COUNT() as c FROM agora_audio WHERE blob5 = 'transcriptions' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_audio' },
    { sql: "SELECT COUNT() as c FROM agora_audio WHERE blob5 = 'transcriptions' AND timestamp " + prevRange(), dataset: 'agora_audio' },
    // Sparkline TTS
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_audio WHERE blob5 = 'speech' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_audio' },
    // Avg TTS latency
    { sql: "SELECT AVG(double1) as avg_ms FROM agora_audio WHERE blob5 = 'speech' AND blob4 = '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_audio' },
    // Audio errors
    { sql: "SELECT COUNT() as c FROM agora_audio WHERE blob5 IN ('speech','transcriptions') AND blob4 != '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_audio' },
    // TTS models
    { sql: "SELECT blob2 as model, COUNT() as c, AVG(double1) as avg_ms FROM agora_audio WHERE blob5 = 'speech' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY model ORDER BY c DESC", dataset: 'agora_audio' },
    // Server distribution
    { sql: "SELECT blob3 as server, COUNT() as c FROM agora_audio WHERE blob5 IN ('speech','transcriptions') AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY server ORDER BY c DESC", dataset: 'agora_audio' },
    // Audio language split
    { sql: "SELECT blob1 as lang, COUNT() as c FROM agora_audio WHERE blob5 = 'speech' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY lang ORDER BY c DESC", dataset: 'agora_audio' },
    // Rate limits
    { sql: "SELECT blob3 as reason, COUNT() as c FROM agora_llm WHERE blob1 = 'ratelimit' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY reason ORDER BY c DESC", dataset: 'agora_llm' },
    { sql: "SELECT blob4 as reason, COUNT() as c FROM agora_audio WHERE blob5 = 'ratelimit' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY reason ORDER BY c DESC", dataset: 'agora_audio' },
  ];

  var r = await batch(queries);
  S.lastAnalytics = Date.now();

  var sessions = val(r[0]), sessionsPrev = val(r[1]);
  var chats = val(r[2]), chatsPrev = val(r[3]);
  var councils = val(r[4]), councilsPrev = val(r[5]);
  var summaries = val(r[6]), summariesPrev = val(r[7]);
  var sparkSessions = rows(r[8]).map(function(x) { return x.c; });
  var sparkChats = rows(r[9]).map(function(x) { return x.c; });
  var figures = rows(r[10]);
  var modes = rows(r[11]);
  var langs = rows(r[12]);
  var figMode = rows(r[13]);
  var chatTimeline = rows(r[14]);
  var tts = val(r[15]), ttsPrev = val(r[16]);
  var stt = val(r[17]), sttPrev = val(r[18]);
  var sparkTts = rows(r[19]).map(function(x) { return x.c; });
  var avgLatency = r[20] && r[20].data && r[20].data[0] ? Number(r[20].data[0].avg_ms) : 0;
  var audioErrors = val(r[21]);
  var ttsModels = rows(r[22]);
  var serverDist = rows(r[23]);
  var audioLangs = rows(r[24]);
  var rlLlm = rows(r[25]);
  var rlAudio = rows(r[26]);
  var totalLlm = chats + councils + summaries;
  var chatsPerSession = sessions > 0 ? (chats / sessions).toFixed(1) : '-';
  var totalRlLlm = rlLlm.reduce(function(s, r) { return s + r.c; }, 0);
  var totalRlAudio = rlAudio.reduce(function(s, r) { return s + r.c; }, 0);

  var html = '';

  // === ENGAGEMENT SECTION ===
  html += '<div class="section-divider">Engagement</div>';
  html += '<div class="grid">';
  html += kpi('Sessions', sessions, { hero: true, spark: sparkSessions, delta: sessionsPrev });
  html += kpi('Chat Messages', chats, { spark: sparkChats, sparkColor: '#5B8BD4', delta: chatsPrev });
  html += kpi('Councils', councils, { delta: councilsPrev });
  html += kpi('Summaries', summaries, { delta: summariesPrev });
  html += kpi('Chats / Session', chatsPerSession, { sub: 'avg engagement depth' });

  // Figure popularity
  if (figures.length > 0) {
    html += chartCard('Most Popular Figures', barsHtml(figures.map(function(r) { return { label: cap(r.figure), c: r.c }; }), '#E6BC5C'), 'card-wide');
  }

  // Mode + Lang donuts
  if (modes.length > 0) {
    html += chartCard('Mode Distribution', donutSvg(modes.map(function(r) { return { key: r.mode, c: r.c }; }), COLORS.modes, modeLabel), '');
  }
  if (langs.length > 0) {
    html += chartCard('Language Split', donutSvg(langs.map(function(r) { return { key: r.lang, c: r.c }; }), COLORS.lang, function(l) { return l === 'de' ? 'Deutsch' : 'English'; }), '');
  }

  // Figure x Mode table
  if (figMode.length > 0) {
    var fmRows = figMode.map(function(r) {
      var mc = COLORS.modes[r.mode] || 'var(--dim)';
      return ['<span>' + cap(r.figure) + '</span>', '<span style="color:' + mc + '">' + modeLabel(r.mode) + '</span>', r.c];
    });
    html += chartCard('Figure x Mode', tableHtml(['Figure', 'Mode', 'Chats'], fmRows), 'card-wide');
  }

  // Chat activity graph (always visible)
  if (chatTimeline.length > 1) {
    var timeItems = chatTimeline.map(function(row) {
      var d = new Date(row.t);
      var label = S.range <= 1
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return { label: label, c: row.c };
    });
    html += chartCard('Chat Activity', svgBarGraph(timeItems, { color: '#5B8BD4', ariaLabel: 'Chat messages over time' }), 'card-full');
  } else {
    html += chartCard('Chat Activity', '<div class="empty-state" style="padding:30px 0">No chat data yet ' + RANGE_LABEL[S.range] + '</div>', 'card-full');
  }
  html += '</div>';

  // === AUDIO SECTION ===
  html += '<div class="section-divider">Audio</div>';
  html += '<div class="grid">';
  html += kpi('TTS Requests', tts, { hero: true, spark: sparkTts, sparkColor: '#68C397', delta: ttsPrev });
  html += kpi('STT Requests', stt, { delta: sttPrev });
  html += kpi('Avg TTS Latency', fmtMs(avgLatency), {});
  html += kpi('Audio Errors', audioErrors, { sub: audioErrors > 0 ? 'non-200 responses' : 'all clear', valColor: audioErrors > 0 ? '#E97451' : '#68C397' });

  // TTS models table
  if (ttsModels.length > 0) {
    var mRows = ttsModels.map(function(r) {
      var mc = COLORS.models[r.model] || 'var(--dim)';
      return ['<span style="color:' + mc + '">' + r.model + '</span>', fmt(r.c), fmtMs(r.avg_ms)];
    });
    html += chartCard('TTS Models', tableHtml(['Model', 'Requests', 'Avg Latency'], mRows), 'card-wide');
  }

  // TTS latency area graph
  if (sparkTts.length > 1) {
    var ttsGraphItems = rows(r[19]).map(function(row) {
      var d = new Date(row.t);
      var label = S.range <= 1
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return { label: label, c: row.c };
    });
    html += chartCard('TTS Volume Over Time', svgAreaGraph(ttsGraphItems, { color: '#68C397', height: 130, ariaLabel: 'TTS requests over time' }), 'card-full');
  }

  // Server distribution + audio language donuts
  if (serverDist.length > 0) {
    html += chartCard('Server Distribution', donutSvg(serverDist.map(function(r) { return { key: r.server, c: r.c }; }), COLORS.servers, function(s) { return s.toUpperCase(); }), '');
  }
  if (audioLangs.length > 0) {
    html += chartCard('Audio Language', donutSvg(audioLangs.map(function(r) { return { key: r.lang, c: r.c }; }), COLORS.lang, function(l) { return l === 'de' ? 'Deutsch' : 'English'; }), '');
  }
  // TTS backend distribution — visual at-a-glance split of Qwen3-TTS / F5-TTS / Kokoro.
  // Qwen vs F5 split is the load-balancing signal for DE session-sticky routing.
  if (ttsModels.length > 0) {
    var modelLabels = { 'qwen3-tts': 'Qwen3', 'qwen-tts': 'Qwen', 'kokoro': 'Kokoro', 'f5-tts': 'F5' };
    html += chartCard('TTS Backend', donutSvg(ttsModels.map(function(r) { return { key: r.model, c: r.c }; }), COLORS.models, function(m) { return modelLabels[m] || m; }), '');
  }
  html += '</div>';

  // === CAPACITY SECTION ===
  html += '<div class="section-divider">Capacity</div>';
  html += '<div class="grid">';

  // Rate limit KPIs with donuts
  if (totalRlLlm > 0 || totalRlAudio > 0) {
    var llmDonut = totalRlLlm > 0 ? donutSvg(rlLlm.map(function(r) { return { key: r.reason, c: r.c }; }), COLORS.rl, function(r) { return r === 'daily' ? 'Daily' : r === 'global' ? 'Global' : cap(r); }, 60) : '<span style="color:var(--ok);font-size:0.8125rem">None</span>';
    html += chartCard('LLM Rate Limits (' + totalRlLlm + ')', llmDonut, '');

    var audioRlLabels = { gpu_capacity_german: 'GPU RED (DE)', daily_limit: 'Daily cap', burst_limit: 'Burst' };
    var audioDonut = totalRlAudio > 0 ? donutSvg(rlAudio.map(function(r) { return { key: r.reason, c: r.c }; }), COLORS.rl, function(r) { return audioRlLabels[r] || r; }, 60) : '<span style="color:var(--ok);font-size:0.8125rem">None</span>';
    html += chartCard('Audio Rate Limits (' + totalRlAudio + ')', audioDonut, '');
  } else {
    html += '<div class="card"><div class="kpi-label">Rate Limits</div><div style="margin-top:8px;font-size:0.8125rem;color:var(--ok)">No rate limit hits ' + RANGE_LABEL[S.range] + '</div></div>';
  }

  // Config reference (horizontal layout on desktop)
  html += '<div class="card card-wide"><div class="kpi-label">Current Limits</div><div class="limits-grid">' +
    '<div><span class="lim-val">30</span><span class="lim-key">Chat / day / IP</span></div>' +
    '<div><span class="lim-val">1</span><span class="lim-key">Council / day</span></div>' +
    '<div><span class="lim-val">2</span><span class="lim-key">Summary / day</span></div>' +
    '<div><span class="lim-val">500</span><span class="lim-key">Audio / day / IP</span></div>' +
    '<div><span class="lim-val">60</span><span class="lim-key">Audio burst / min</span></div>' +
    '<div><span class="lim-val">15K</span><span class="lim-key">LLM global / day</span></div>' +
    '</div></div>';
  html += '</div>';

  grid.innerHTML = html;
  alertsEl.innerHTML = '';
  document.getElementById('updated-product').textContent = 'Updated ' + now();
}

// --- Navigation ---

// ─── Ad Grants Conversions ───

async function loadAdGrants() {
  var grid = document.getElementById('grid-adgrants');
  var alertsEl = document.getElementById('alerts-adgrants');

  // Query Analytics Engine for conversion events
  var queries = [
    // Total profile_created conversions
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'profile_created' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    // Previous period profile_created
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'profile_created' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    // Total audio_played_30s conversions
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'audio_played_30s' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    // Previous period audio
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'audio_played_30s' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    // Daily conversions sparkline
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE index1 = 'profile_created' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
    // Daily audio sparkline
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE index1 = 'audio_played_30s' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
    // Conversions by figure (which pages drive signups)
    { sql: "SELECT blob2 as figure, COUNT() as c FROM agora_llm WHERE index1 = 'profile_created' AND blob2 != '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY figure ORDER BY c DESC LIMIT 10", dataset: 'agora_llm' },
    // Audio plays by figure
    { sql: "SELECT blob2 as figure, COUNT() as c FROM agora_llm WHERE index1 = 'audio_played_30s' AND blob2 != '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY figure ORDER BY c DESC LIMIT 10", dataset: 'agora_llm' },
    // Total sessions for conversion rate calculation
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'session' AND blob5 = '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    // Phase 1 channel attribution — conversations by marketing_source (blob6)
    { sql: "SELECT blob6 as source, COUNT() as c FROM agora_llm WHERE blob1 IN ('chat','council','summary') AND blob5 = '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY source ORDER BY c DESC", dataset: 'agora_llm' },
    // Channel attribution — sessions by marketing_source
    { sql: "SELECT blob6 as source, COUNT() as c FROM agora_llm WHERE blob1 = 'session' AND blob5 = '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY source ORDER BY c DESC", dataset: 'agora_llm' },
    // Phase 0d geographic — top countries on conversations
    { sql: "SELECT blob7 as country, COUNT() as c FROM agora_llm WHERE blob1 IN ('chat','council','summary') AND blob5 = '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY country ORDER BY c DESC LIMIT 10", dataset: 'agora_llm' },
  ];

  var r = await batch(queries);

  var profileConv = val(r[0]), profilePrev = val(r[1]);
  var audioConv = val(r[2]), audioPrev = val(r[3]);
  var sparkProfile = rows(r[4]).map(function(r) { return r.c; });
  var sparkAudio = rows(r[5]).map(function(r) { return r.c; });
  var profileByFigure = rows(r[6]);
  var audioByFigure = rows(r[7]);
  var totalSessions = val(r[8]);
  var convRate = totalSessions > 0 ? ((profileConv / totalSessions) * 100).toFixed(1) : '--';
  var convoByChannel = rows(r[9]);
  var sessionsByChannel = rows(r[10]);
  var topCountriesAdgrants = rows(r[11]);

  // Alerts
  var alerts = '';
  if (profileConv === 0 && audioConv === 0) {
    alerts += '<div class="hint-banner">No Ad Grants conversions yet ' + RANGE_LABEL[S.range] + '. This is normal before campaigns go live.</div>';
  }
  alertsEl.innerHTML = alerts;

  var html = '';

  // Hero KPIs
  html += kpi('Profile Conversions', profileConv, {
    hero: true, spark: sparkProfile, sparkColor: '#68C397',
    delta: profilePrev, sub: 'from Google Ads clicks'
  });
  html += kpi('Audio Engagement', audioConv, {
    hero: true, spark: sparkAudio, sparkColor: '#5B8BD4',
    delta: audioPrev, sub: 'listened 30s+'
  });

  // Secondary KPIs
  html += kpi('Conversion Rate', convRate + '%', {
    sub: profileConv + ' conversions / ' + fmt(totalSessions) + ' sessions'
  });
  html += kpi('Total Ad Events', profileConv + audioConv, {
    sub: 'profile + audio combined'
  });

  // Phase 1 channel attribution — Conversations by Source
  var convoChannelItems = convoByChannel.map(function(r) {
    return { label: r.source || 'direct', c: r.c };
  }).filter(function(r) { return r.label && r.c > 0; });
  html += chartCard('Conversations by Channel',
    barsHtml(convoChannelItems, '#E6BC5C'),
    'card-half'
  );

  // Channel attribution — Sessions by Source
  var sessionChannelItems = sessionsByChannel.map(function(r) {
    return { label: r.source || 'direct', c: r.c };
  }).filter(function(r) { return r.label && r.c > 0; });
  html += chartCard('Sessions by Channel',
    barsHtml(sessionChannelItems, '#9D83CD'),
    'card-half'
  );

  // Phase 0d — Top countries
  var countryItemsAdgrants = topCountriesAdgrants.map(function(r) {
    return { label: r.country || 'XX', c: r.c };
  }).filter(function(r) { return r.label && r.c > 0; });
  html += chartCard('Top Countries (Conversations)',
    barsHtml(countryItemsAdgrants, '#5B8BD4'),
    'card-half'
  );

  // Conversions by figure
  if (profileByFigure.length > 0) {
    html += chartCard('Top Converting Figures',
      barsHtml(profileByFigure.map(function(r) { return { label: cap(r.figure), c: r.c }; }), '#68C397'),
      'card-wide'
    );
  }

  // Audio engagement by figure
  if (audioByFigure.length > 0) {
    html += chartCard('Audio Engagement by Figure',
      barsHtml(audioByFigure.map(function(r) { return { label: cap(r.figure), c: r.c }; }), '#5B8BD4'),
      'card-wide'
    );
  }

  // Pipeline status
  html += chartCard('Conversion Pipeline',
    '<div style="display:flex;flex-direction:column;gap:8px;font-size:0.875rem">' +
    '<div style="display:flex;justify-content:space-between"><span style="color:var(--dim)">gclid Capture</span><span style="color:var(--ok)">Active</span></div>' +
    '<div style="display:flex;justify-content:space-between"><span style="color:var(--dim)">Profile Event</span><span style="color:var(--ok)">Active</span></div>' +
    '<div style="display:flex;justify-content:space-between"><span style="color:var(--dim)">Audio Event</span><span style="color:var(--ok)">Active</span></div>' +
    '<div style="display:flex;justify-content:space-between"><span style="color:var(--dim)">CF Worker Endpoint</span><span style="color:var(--ok)">Active</span></div>' +
    '<div style="display:flex;justify-content:space-between"><span style="color:var(--dim)">Google Ads API</span><span style="color:var(--warn)">Pending (manual setup)</span></div>' +
    '</div>',
    ''
  );

  grid.innerHTML = html;
}

function switchTab(tab) {
  S.tab = tab;
  location.hash = tab;

  // Update sidebar
  document.querySelectorAll('.nav-item').forEach(function(el) {
    el.classList.toggle('active', el.dataset.tab === tab);
    el.removeAttribute('aria-current');
    if (el.dataset.tab === tab) el.setAttribute('aria-current', 'page');
  });
  document.querySelectorAll('.mob-tab').forEach(function(el) {
    el.classList.toggle('active', el.dataset.tab === tab);
  });

  // Show active tab section
  document.querySelectorAll('.tab-section').forEach(function(el) {
    el.classList.toggle('active', el.id === 'tab-' + tab);
  });

  // Scroll to top
  document.getElementById('content').scrollTop = 0;

  // Load data
  loadTab(tab);
}

function loadTab(tab) {
  if (tab === 'overview') loadOverview();
  else if (tab === 'servers') renderServers();
  else if (tab === 'product') loadProduct();
  else if (tab === 'adgrants') loadAdGrants();
}

function setRange(days) {
  S.range = days;
  S.cache = {};

  // Update pills
  document.querySelectorAll('.range-pill, .range-pill-h').forEach(function(el) {
    el.classList.toggle('active', Number(el.dataset.range) === days);
  });

  // Reload active tab
  loadTab(S.tab);
}

// --- Range pill rendering ---

function renderRangePills() {
  var desktopEl = document.getElementById('range-desktop');
  var mobileEl = document.getElementById('range-mobile');
  var dHtml = '', mHtml = '';

  RANGE_OPTS.forEach(function(opt) {
    var active = opt.val === S.range ? ' active' : '';
    dHtml += '<button class="range-pill' + active + '" data-range="' + opt.val + '" onclick="setRange(' + opt.val + ')">' + opt.label + '</button>';
    mHtml += '<button class="range-pill-h' + active + '" data-range="' + opt.val + '" onclick="setRange(' + opt.val + ')">' + opt.label + '</button>';
  });

  desktopEl.innerHTML = dHtml;
  mobileEl.innerHTML = mHtml;
}

// --- Init ---

function init() {
  // Render "Stats since" label from injected launch epoch
  if (LAUNCH_EPOCH_SECONDS > 0) {
    var label = new Date(LAUNCH_EPOCH_SECONDS * 1000).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
    var el = document.getElementById('since-label');
    if (el) el.textContent = 'Stats since ' + label;
  }

  // Read hash
  var hash = location.hash.replace('#', '');
  if (['overview', 'servers', 'product', 'adgrants'].indexOf(hash) >= 0) {
    S.tab = hash;
  }

  renderRangePills();

  // Activate correct tab
  document.querySelectorAll('.nav-item').forEach(function(el) {
    el.classList.toggle('active', el.dataset.tab === S.tab);
    if (el.dataset.tab === S.tab) el.setAttribute('aria-current', 'page');
  });
  document.querySelectorAll('.mob-tab').forEach(function(el) {
    el.classList.toggle('active', el.dataset.tab === S.tab);
  });
  document.querySelectorAll('.tab-section').forEach(function(el) {
    el.classList.toggle('active', el.id === 'tab-' + S.tab);
  });

  // Sidebar + mobile tab click handlers
  document.querySelectorAll('.nav-item, .mob-tab').forEach(function(el) {
    el.addEventListener('click', function() { switchTab(el.dataset.tab); });
  });

  // Hash change
  window.addEventListener('hashchange', function() {
    var h = location.hash.replace('#', '');
    if (h && h !== S.tab && ['overview', 'servers', 'product', 'adgrants'].indexOf(h) >= 0) {
      switchTab(h);
    }
  });

  // Start loading
  loadServerHealth();
  loadTab(S.tab);

  // Analytics auto-refresh (60s)
  setInterval(function() {
    loadTab(S.tab);
  }, 60000);
}

init();
</script>
</body>
</html>`;
