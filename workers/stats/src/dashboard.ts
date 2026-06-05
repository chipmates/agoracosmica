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

/* Funnel: horizontal flow on desktop, vertical on mobile.
   Each stage is a tile with label + value + small sub. Between stages,
   an arrow tile shows the conversion percentage from prev → next. */
.funnel-row {
  display: flex; align-items: stretch; gap: 6px;
  margin-top: 10px; flex-wrap: nowrap;
  overflow-x: auto; -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.funnel-row::-webkit-scrollbar { display: none; }
.funnel-stage {
  flex: 1 1 0; min-width: 110px;
  padding: 10px 8px;
  background: color-mix(in srgb, var(--gold) 5%, transparent);
  border: 1px solid color-mix(in srgb, var(--gold-deep) 12%, transparent);
  border-radius: var(--radius-sm);
  text-align: center;
  display: flex; flex-direction: column; justify-content: center;
}
.funnel-stage-label {
  font-size: 0.625rem; color: var(--dim);
  text-transform: uppercase; letter-spacing: 0.06em;
  line-height: 1.2;
}
.funnel-stage-value {
  font-size: 1.375rem; font-weight: 700; color: var(--gold);
  line-height: 1.1; margin: 4px 0 2px;
}
.funnel-stage-sub {
  font-size: 0.625rem; color: var(--dim); line-height: 1.2;
}
.funnel-arrow {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: var(--dim); font-size: 0.75rem;
  min-width: 38px; padding: 0 2px;
  flex-shrink: 0;
}
.funnel-arrow-icon { font-size: 1rem; line-height: 1; }
.funnel-arrow-pct {
  font-size: 0.75rem; font-weight: 600;
  color: var(--tx2); margin-top: 2px; white-space: nowrap;
}
.funnel-arrow-pct.weak { color: var(--err); }
.funnel-arrow-pct.warn { color: var(--warn); }
.funnel-arrow-pct.ok { color: var(--ok); }

/* Parallel-engagement label sits between the sequential funnel and the
   parallel branches. Subtle text indicating the flow forks. */
.funnel-parallel-label {
  font-size: 0.6875rem; color: var(--dim);
  text-transform: uppercase; letter-spacing: 0.06em;
  margin: 12px 0 6px; padding-left: 2px;
  text-align: center; line-height: 1.3;
}
/* Parallel stages get a slightly different visual treatment — softer fill,
   wider gap — so they're clearly distinct from the sequential funnel. */
.funnel-row--parallel {
  gap: 10px;
}
.funnel-stage--parallel {
  background: color-mix(in srgb, var(--gold) 3%, transparent);
  border-style: dashed;
  border-color: color-mix(in srgb, var(--gold-deep) 18%, transparent);
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

/* === Ghost funnel bars + status strip + rate cards (period-over-period) === */
/* Funnel as horizontal bars with a faint previous-period ghost bar behind each
   stage on a shared axis: a solid bar wider than its ghost means more people
   reached this step than last period. Population-level only, no per-visitor key. */
.fbar-list { display: flex; flex-direction: column; gap: 0; margin-top: 8px; }
.fbar-row { display: flex; align-items: center; gap: 10px; }
.fbar-labelwrap {
  min-width: 96px; flex-shrink: 0; text-align: right;
  display: flex; flex-direction: column; gap: 1px; line-height: 1.15;
}
.fbar-label {
  font-size: 0.6875rem; color: var(--tx2);
  text-transform: uppercase; letter-spacing: 0.04em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fbar-sub2 {
  font-size: 0.5625rem; color: var(--dim);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fbar-track {
  flex: 1; position: relative; height: 30px;
  background: var(--bg-primary); border-radius: var(--radius-sm); overflow: hidden;
}
.fbar-ghost {
  position: absolute; left: 0; top: 0; height: 100%;
  background: color-mix(in srgb, var(--gold-deep) 22%, transparent);
  border-radius: var(--radius-sm); min-width: 1px;
}
.fbar-fill {
  position: absolute; left: 0; top: 0; height: 100%;
  background: var(--gold-subtle); border-radius: var(--radius-sm); min-width: 2px;
  transition: width 0.5s ease;
}
.fbar-num { min-width: 96px; flex-shrink: 0; display: flex; align-items: baseline; gap: 6px; justify-content: flex-end; }
.fbar-val { font-size: 1rem; font-weight: 700; color: var(--gold); }
.fbar-drop {
  margin: 3px 0 3px 106px; font-size: 0.6875rem; color: var(--dim);
  display: flex; align-items: center; gap: 6px;
}
.fbar-drop .pp { font-weight: 600; }
.fbar-drop .pp.up { color: var(--ok); }
.fbar-drop .pp.down { color: var(--err); }
.fbar-legend { font-size: 0.625rem; color: var(--dim); margin-top: 8px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.fbar-legend .swatch { width: 18px; height: 8px; border-radius: 2px; display: inline-block; }

/* Status strip: health line + momentum verdict at the top of Overview */
.status-strip { padding: 12px 16px; display: flex; flex-direction: column; gap: 7px; }
.health-line { display: flex; align-items: center; gap: 8px; font-size: 0.875rem; font-weight: 600; }
.health-line .dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; background: currentColor; }
.health-line.ok { color: var(--ok); }
.health-line.warn { color: var(--warn); }
.health-line.err { color: var(--err); }
.momentum-line { font-size: 0.9375rem; color: var(--tx); line-height: 1.4; }

/* Rate card target marker (Growth tab) */
.rate-target { font-size: 0.6875rem; color: var(--dim); margin-top: 4px; }

@media (max-width: 640px) {
  .fbar-labelwrap { min-width: 66px; }
  .fbar-num { min-width: 74px; }
  .fbar-drop { margin-left: 76px; }
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
  .card { padding: 1rem; }
  .card-hero .kpi-value { font-size: 1.875rem; }
  .kpi-spark { display: none; }
  .bar-label { min-width: 70px; font-size: 0.6875rem; }
  .section-divider { margin: 16px 0 10px; }
  .tab-header { flex-direction: column; gap: 2px; margin-bottom: 12px; }
  .tab-updated { align-self: flex-start; }
  .corr-bars { height: 70px; }
  /* Funnel + activity pool stack vertically on small screens. The sequential
     funnel keeps down-pointing arrows; the parallel activity pool has none. */
  .funnel-row { flex-direction: column; gap: 6px; overflow-x: visible; }
  .funnel-stage { min-width: 0; padding: 12px; flex-direction: row; justify-content: space-between; align-items: center; text-align: left; flex-wrap: wrap; }
  .funnel-stage-value { margin: 0; font-size: 1.25rem; }
  .funnel-stage-label { flex: 1; }
  .funnel-stage-sub { width: 100%; }
  .funnel-arrow { flex-direction: row; gap: 8px; min-width: 0; padding: 2px 0; }
  .funnel-arrow-icon { transform: rotate(90deg); font-size: 0.875rem; }
  .funnel-parallel-label { text-align: left; }
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
      <span class="nav-label">Engagement</span>
    </button>
    <button class="nav-item" data-tab="audio">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h3l3-9 4 18 3-9h5"/></svg>
      <span class="nav-label">Audio</span>
    </button>
    <button class="nav-item" data-tab="adgrants">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><line x1="12" y1="6" x2="12" y2="18"/><path d="M5 21h14"/></svg>
      <span class="nav-label">Growth</span>
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

<!-- Tab: Engagement (internal id 'product' preserved for bookmark stability) -->
<section class="tab-section" id="tab-product" aria-labelledby="title-product">
  <div class="tab-header">
    <h2 class="tab-title" id="title-product">Engagement</h2>
    <span class="tab-updated" id="updated-product"></span>
  </div>
  <div id="alerts-product"></div>
  <div id="grid-product">
    <div class="card card-hero"><div class="skel-label skeleton"></div><div class="skel-value skeleton"></div><div class="skel-sub skeleton"></div></div>
    <div class="card"><div class="skel-label skeleton"></div><div class="skel-value skeleton"></div><div class="skel-sub skeleton"></div></div>
    <div class="card"><div class="skel-label skeleton"></div><div class="skel-value skeleton"></div><div class="skel-sub skeleton"></div></div>
  </div>
</section>

<!-- Tab: Audio -->
<section class="tab-section" id="tab-audio" aria-labelledby="title-audio">
  <div class="tab-header">
    <h2 class="tab-title" id="title-audio">Audio</h2>
    <span class="tab-updated" id="updated-audio"></span>
  </div>
  <div id="alerts-audio"></div>
  <div id="grid-audio">
    <div class="card card-hero"><div class="skel-label skeleton"></div><div class="skel-value skeleton"></div><div class="skel-sub skeleton"></div></div>
    <div class="card"><div class="skel-label skeleton"></div><div class="skel-value skeleton"></div><div class="skel-sub skeleton"></div></div>
  </div>
</section>

<!-- Tab: Growth (internal id 'adgrants' preserved for bookmark + init stability) -->
<section class="tab-section" id="tab-adgrants" aria-labelledby="title-adgrants">
  <div class="tab-header">
    <h2 class="tab-title" id="title-adgrants">Growth</h2>
  </div>
  <div id="alerts-adgrants" class="alerts"></div>
  <div id="grid-adgrants"></div>
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
    Engagement
  </button>
  <button class="mob-tab" data-tab="audio">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 12h3l3-9 4 18 3-9h5"/></svg>
    Audio
  </button>
  <button class="mob-tab" data-tab="adgrants">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="17 11 12 6 7 11"/><line x1="12" y1="6" x2="12" y2="18"/><path d="M5 21h14"/></svg>
    Growth
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
const MODE_LABELS = { introduction: 'Story', seed_conversation: 'Wisdom', prism: 'Prism', challenge: 'Quest', free_conversation: 'Freetalk', seed_challenge: 'Quest' };
const RANGE_OPTS = [
  { val: 1, label: 'Last 24h' },
  { val: 7, label: '7 days' },
  { val: 30, label: '30 days' },
  { val: 365, label: 'Year' },
  { val: 9999, label: 'All time' },
];
const RANGE_LABEL = { 1: 'last 24h', 7: 'last 7 days', 30: 'last 30 days', 365: 'last year', 9999: 'all time' };

// Public-launch epoch (Unix seconds). Substituted by the worker at request time
// from env.LAUNCH_EPOCH_SECONDS. 0 = no floor, no label.
const LAUNCH_EPOCH_SECONDS = __LAUNCH_EPOCH_SECONDS__;

// --- State ---
let S = {
  tab: 'overview',
  range: 7,
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

// Delta HTML. At single-digit scale a percentage off a tiny base is Poisson
// noise (1 -> 0 reads as a terrifying -100%), so below a small base we show the
// absolute change only, never a dramatic colored percent.
function deltaHtml(cur, prev) {
  if (prev == null || (prev === 0 && cur === 0)) return '<span class="kpi-delta flat">-</span>';
  const diff = cur - prev;
  if (diff === 0) return '<span class="kpi-delta flat">~0</span>';
  const cls = diff > 0 ? 'up' : 'down';
  const arrow = diff > 0 ? '&#9650;' : '&#9660;';
  const sign = diff > 0 ? '+' : '';
  // Small-base guard: with prev under 5, or a change of a single event, the
  // percentage is meaningless. Show just the absolute delta.
  if (prev < 5 || Math.abs(diff) <= 1) {
    return '<span class="kpi-delta ' + cls + '">' + arrow + ' ' + sign + fmt(diff) + '</span>';
  }
  const pctVal = Math.round((diff / prev) * 100);
  return '<span class="kpi-delta ' + cls + '">' + arrow + ' ' + sign + fmt(diff) + ' (' + sign + pctVal + '%)</span>';
}

// Express two comparable app-side counts as a multiplier (e.g. 2.4x), gated at a
// sample floor. A multiplier is interpretable at any value and structurally
// cannot render the misleading >100% that a percentage between two different
// populations can (that was the old "400%" funnel bug).
function multiplierOrDash(numer, denom, floor) {
  floor = floor || 20;
  if (!denom || denom < floor) return '--';
  return (numer / denom).toFixed(1) + '\\u00d7';
}

// One auto-composed sentence telling the founder what (if anything) to act on,
// from a fixed priority ladder over existing counts. Needs zero new events.
function decisionLine(chats, signups, visits, sessions) {
  var msg;
  if (chats === 0 && sessions === 0) {
    msg = 'No sessions and no conversations this period. Open the app yourself, confirm chat works, then share it in one warm community.';
  } else if (chats === 0) {
    msg = 'People open the app but no one has talked to a figure yet. Check the first-chat path on mobile.';
  } else if (visits > 200 && signups <= 2) {
    msg = 'Lots of visits, few signups. That is the cold ad traffic (mostly Spotify), which converts near zero by nature. Judge it as awareness, not acquisition, and do not buy more cold clicks.';
  } else if (signups > 0 && chats > 0) {
    msg = 'Healthy window: real signups and real conversations. No fire to fight.';
  } else {
    msg = 'Quiet, but normal at this stage. The 7-day view is the real read, not any single day.';
  }
  return '<div class="card card-full" style="padding:12px 16px"><div style="font-size:0.9375rem;color:var(--tx);line-height:1.45">&#128161; ' + msg + '</div></div>';
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
// Render a horizontal-on-desktop, vertical-on-mobile funnel of conversion
// stages. Each stage is { label, value, sub? }. Drop-off % is computed
// between consecutive stages and color-coded (>=50% ok, 20-50% warn, <20% weak).
function funnelHtml(stages) {
  if (!stages || stages.length === 0) return '';
  var parts = [];
  for (var i = 0; i < stages.length; i++) {
    var s = stages[i];
    var subHtml = s.sub ? '<div class="funnel-stage-sub">' + s.sub + '</div>' : '';
    parts.push(
      '<div class="funnel-stage">' +
        '<div class="funnel-stage-label">' + s.label + '</div>' +
        '<div class="funnel-stage-value">' + fmt(s.value) + '</div>' +
        subHtml +
      '</div>'
    );
    if (i < stages.length - 1) {
      var next = stages[i + 1];
      var arrowText, tone;
      if (s.value <= 0) {
        arrowText = '—'; tone = 'flat';
      } else if (s.value < 20) {
        // Small base: a percentage off fewer than 20 is Poisson noise. Show the
        // raw fraction instead of a colored % so 1-of-2 stops reading as a cliff.
        arrowText = fmt(next.value) + '/' + fmt(s.value); tone = 'flat';
      } else {
        var p = Math.round((next.value / s.value) * 100);
        arrowText = p + '%';
        tone = p >= 50 ? 'ok' : (p >= 20 ? 'warn' : 'weak');
      }
      parts.push(
        '<div class="funnel-arrow">' +
          '<span class="funnel-arrow-icon" aria-hidden="true">→</span>' +
          '<span class="funnel-arrow-pct ' + tone + '">' + arrowText + '</span>' +
        '</div>'
      );
    }
  }
  return '<div class="funnel-row" role="list" aria-label="User funnel">' + parts.join('') + '</div>';
}

// Funnel drawn as horizontal bars with a faint previous-period ghost bar behind
// each stage on a shared axis. A solid bar wider than its ghost means more people
// reached this step than last period — improvement you can see, not compute.
// Between stages we show the conversion to the next step (same honesty rule as
// funnelHtml: raw fraction under a base of 20, color-free; a % above) plus the
// percentage-point change vs the same step last period. Stages are
// { label, value, prev, sub }; population-level only, no per-visitor key.
function ghostFunnelHtml(stages) {
  if (!stages || stages.length === 0) return '';
  var base = 1;
  for (var k = 0; k < stages.length; k++) {
    base = Math.max(base, Number(stages[k].value) || 0, Number(stages[k].prev) || 0);
  }
  var out = '<div class="fbar-list" role="list" aria-label="New-visitor funnel">';
  for (var i = 0; i < stages.length; i++) {
    var s = stages[i];
    var v = Number(s.value) || 0;
    var pv = (s.prev == null) ? null : (Number(s.prev) || 0);
    var wv = (v / base * 100);
    var ghost = (pv == null) ? '' : '<div class="fbar-ghost" style="width:' + (pv / base * 100).toFixed(1) + '%"></div>';
    var sub2 = s.sub ? '<span class="fbar-sub2">' + s.sub + '</span>' : '';
    out += '<div class="fbar-row" role="listitem">' +
      '<span class="fbar-labelwrap"><span class="fbar-label">' + s.label + '</span>' + sub2 + '</span>' +
      '<div class="fbar-track">' + ghost + '<div class="fbar-fill" style="width:' + wv.toFixed(1) + '%"></div></div>' +
      '<span class="fbar-num"><span class="fbar-val">' + fmt(v) + '</span>' + (pv == null ? '' : deltaHtml(v, pv)) + '</span>' +
      '</div>';
    if (i < stages.length - 1) {
      var next = stages[i + 1];
      var nv = Number(next.value) || 0;
      var dropText;
      if (v <= 0) {
        dropText = '—';
      } else if (v < 20) {
        // Small base: a percentage off fewer than 20 is Poisson noise, so show
        // the raw fraction instead of a colored % (1-of-2 must not read a cliff).
        dropText = fmt(nv) + '/' + fmt(v) + ' to ' + next.label;
      } else {
        dropText = Math.round(nv / v * 100) + '% to ' + next.label;
      }
      // Percentage-point change vs the previous period's same step-to-step
      // conversion. Suppressed when either base is below the small-base floor.
      var ppHtml = '';
      var npv = (next.prev == null) ? null : (Number(next.prev) || 0);
      if (pv != null && npv != null && v >= 20 && pv >= 20) {
        var pp = Math.round((nv / v * 100) - (npv / pv * 100));
        if (pp !== 0) {
          var ppc = pp > 0 ? 'up' : 'down';
          var ppa = pp > 0 ? '&#9650;' : '&#9660;';
          ppHtml = '<span class="pp ' + ppc + '">' + ppa + ' ' + (pp > 0 ? '+' : '') + pp + 'pp</span>';
        }
      }
      out += '<div class="fbar-drop"><span aria-hidden="true">&#8595;</span> ' + dropText + ' ' + ppHtml + '</div>';
    }
  }
  out += '</div>';
  return out;
}

// One auto-composed sentence answering "are we better than last period", driven
// off the North Star (Conversations) and the SAME small-base guard as deltaHtml
// so it never contradicts the delta chip on the Conversations hero.
function momentumChip(cur, prev) {
  var msg;
  if (prev == null || (prev === 0 && cur === 0)) {
    msg = 'No conversations yet this period or last. Open the app, confirm chat works, then share it in one warm place.';
  } else {
    var diff = cur - prev;
    if (diff === 0) {
      msg = 'Holding steady at ' + fmt(cur) + ' conversations.';
    } else if (prev < 5 || Math.abs(diff) <= 1) {
      msg = 'Small numbers this period, hard to read a trend. The multi-day view is the real signal, not any single day.';
    } else {
      var p = Math.round(diff / prev * 100);
      if (diff > 0) msg = 'Better than last period. Conversations ' + fmt(cur) + ' (&#9650; +' + p + '%).';
      else msg = 'Down from last period. Conversations ' + fmt(cur) + ' (&#9660; ' + p + '%). Small swings are normal at this stage.';
    }
  }
  return '<div class="momentum-line">&#128161; ' + msg + '</div>';
}

// Health line for the top of Overview: "is anything on fire" before any metric.
// Server reachability comes from the (async) server poll; errors and rate limits
// from this period's analytics. The status bar remains the real-time alarm.
function healthChipHtml(errors, rl, serverData) {
  var level = 'ok';
  var parts = [];
  if (serverData) {
    ['fsn1', 'nbg1'].forEach(function(id) {
      var s = serverData[id];
      if (!s || s.error) { parts.push(id.toUpperCase() + ' unreachable'); level = 'err'; }
    });
  }
  if (errors > 0) { parts.push(errors + ' error' + (errors === 1 ? '' : 's')); if (level !== 'err') level = 'warn'; }
  if (rl > 0) { parts.push(rl + ' rate-limited'); if (level !== 'err') level = 'warn'; }
  var text = parts.length ? parts.join(' &middot; ') : 'All systems operational';
  return '<div class="health-line ' + level + '"><span class="dot"></span>' + text + '</div>';
}

// A conversion rate as a card: big %, the percentage-point change vs the previous
// period's rate (guarded so a tiny base never flashes a dramatic swing), and a
// modest dashed target shown as a label. den/prevDen are the SAME-population base
// (e.g. all visits); num is the sequential sub-population (e.g. signups).
function rateCard(label, num, den, prevNum, prevDen, opts) {
  opts = opts || {};
  var floor = opts.floor || 20;
  var rate = den >= floor ? (num / den * 100) : null;
  var prevRate = prevDen >= floor ? (prevNum / prevDen * 100) : null;
  var valStr = rate == null ? '--' : rate.toFixed(1) + '%';
  var ppHtml;
  if (rate != null && prevRate != null) {
    var pp = rate - prevRate;
    if (Math.abs(pp) < 0.05) {
      ppHtml = '<span class="kpi-delta flat">~0pp</span>';
    } else {
      var cls = pp > 0 ? 'up' : 'down';
      var arr = pp > 0 ? '&#9650;' : '&#9660;';
      ppHtml = '<span class="kpi-delta ' + cls + '">' + arr + ' ' + (pp > 0 ? '+' : '') + pp.toFixed(1) + 'pp</span>';
    }
  } else {
    ppHtml = '<span class="kpi-delta flat">-</span>';
  }
  var sub = opts.sub ? '<span class="kpi-sub">' + opts.sub + '</span>' : '';
  var target = (opts.target != null)
    ? '<div class="rate-target">Goal ' + opts.target + '%' + (rate != null ? ' &middot; now ' + valStr : '') + '</div>'
    : '';
  var heroClass = opts.hero ? ' card-hero' : '';
  return '<div class="card' + heroClass + '">' +
    '<div class="kpi-top"><span class="kpi-label">' + label + '</span></div>' +
    '<div class="kpi-value">' + valStr + '</div>' +
    '<div class="kpi-bottom">' + ppHtml + sub + '</div>' + target + '</div>';
}

// Render the engagement pool that sits below the new-visitor funnel. These are
// NOT sequential stages and NOT one population: App Sessions includes returning
// + passive opens, Chats are messages, content events are their own. So we show
// plain activity tiles with no between-stage percentages and no tone-coloring
// (a structurally-low ratio must never flash red). An optional honest note
// carries the key relationship as a sample-gated multiplier.
function engagementPoolHtml(label, stages, note) {
  if (!stages || stages.length === 0) return '';
  var parts = stages.map(function(s) {
    return '<div class="funnel-stage funnel-stage--parallel">' +
      '<div class="funnel-stage-label">' + s.label + '</div>' +
      '<div class="funnel-stage-value">' + fmt(s.value) + '</div>' +
      (s.sub ? '<div class="funnel-stage-sub">' + s.sub + '</div>' : '') +
      '</div>';
  });
  var noteHtml = note
    ? '<div class="funnel-parallel-label" style="margin-top:8px;text-transform:none;letter-spacing:0;color:var(--dim)">' + note + '</div>'
    : '';
  return '<div class="funnel-parallel-label">' + label + '</div>' +
    '<div class="funnel-row funnel-row--parallel" role="list" aria-label="Engagement pool">' + parts.join('') + '</div>' +
    noteHtml;
}

function chartCard(title, body, cls) {
  return '<div class="card ' + (cls || '') + '"><div class="kpi-label" style="margin-bottom:6px">' + title + '</div>' + body + '</div>';
}

// Merge same-label rows (e.g. empty-string rows that fall back to a default
// label like 'direct' or 'XX' would otherwise collide with rows that already
// have that exact value, producing duplicate bars). Sorts by count desc.
function aggregateByLabel(items) {
  if (!items || items.length === 0) return [];
  var map = {};
  items.forEach(function(r) {
    if (!r.label) return;
    map[r.label] = (map[r.label] || 0) + r.c;
  });
  return Object.keys(map).map(function(k) { return { label: k, c: map[k] }; })
    .sort(function(a, b) { return b.c - a.c; });
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
  if (opts.ghost && opts.ghost.length) {
    var gmax = Math.max.apply(null, opts.ghost.map(function(d) { return typeof d === 'number' ? d : Number(d.c); }));
    if (gmax > maxVal) maxVal = gmax;
  }
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

  // Previous-period ghost line: faint dashed polyline behind the main series, so
  // the solid line sitting above its ghost reads as "better than last period".
  if (opts.ghost && opts.ghost.length >= 2) {
    var gd = opts.ghost.map(function(d) { return typeof d === 'number' ? d : Number(d.c); });
    var gn = gd.length;
    var gPath = '';
    for (var gi = 0; gi < gn; gi++) {
      var gx = padL + (gi / (gn - 1)) * plotW;
      var gy = padT + plotH - (gd[gi] / yMax) * plotH;
      gPath += (gi === 0 ? 'M' : ' L') + gx.toFixed(1) + ',' + gy.toFixed(1);
    }
    svg += '<path d="' + gPath + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.35"/>';
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
    // Content STARTED by type — playback first-play events (blob8='started').
    // Filter intentional: matches the Engagement tab's "Content Started" KPI
    // exactly. Including completed events would over-count by the small number
    // of completions, breaking cross-tab consistency.
    { sql: "SELECT blob5 as type, COUNT() as c FROM agora_llm WHERE blob1 = 'playback' AND blob8 = 'started' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY type ORDER BY c DESC", dataset: 'agora_llm' },
    // Top figures by content first-plays (same blob8='started' filter)
    { sql: "SELECT blob2 as figure, COUNT() as c FROM agora_llm WHERE blob1 = 'playback' AND blob8 = 'started' AND blob2 != '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY figure ORDER BY c DESC LIMIT 8", dataset: 'agora_llm' },
    // Page arrivals (true visit count, fires on every cold load)
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'page' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    // Page arrivals previous period (for delta)
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'page' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    // Entry: post-cinematic welcome step where consent is given + profile created
    // (welcome modal "Begin"). Since 2026-05-29 this fires AFTER consent, not at
    // the old login card, so windows straddling that date show a step, not a drop.
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'entry' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    // Page arrivals sparkline
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE blob1 = 'page' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
    // Funnel split: all distinct page paths with counts. Aggregated client-side
    // into marketing (Astro static figures/themes/about/contact, both langs) vs
    // app (React SPA). AE SQL does not support LIKE pattern matching, so we
    // group by path and classify in JS by prefix + exact-match lookup.
    { sql: "SELECT blob2 as path, COUNT() as c FROM agora_llm WHERE blob1 = 'page' AND blob2 != '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY path ORDER BY c DESC LIMIT 200", dataset: 'agora_llm' },
    // Signups (total new-account beacons; distinct from gclid-gated profile_created)
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'signup' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    // Content completed total (blob8='completed' OR legacy empty blob8 — see analytics.ts trackPlayback comment).
    // Parallel engagement endpoint alongside Chats — a sessioned user can do both.
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'playback' AND (blob8 = '' OR blob8 = 'completed') AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    // Chat by mode (blob3 holds the mode for chat events). Breaks down chat
    // activity across the three interactive modes: seed_conversation (Wisdom),
    // challenge (Quest), free_conversation (Freetalk). MODE_LABELS maps raw → display.
    { sql: "SELECT blob3 as mode, COUNT() as c FROM agora_llm WHERE blob1 = 'chat' AND blob3 != '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY mode ORDER BY c DESC", dataset: 'agora_llm' },
    // Signups previous period — for the Pulse "new signups" delta.
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'signup' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    // --- D1 period-over-period additions (APPENDED at the end; reads are
    // positional, so new queries must never be inserted mid-array). r[31..34]. ---
    // Entry previous period (funnel ghost bar)
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'entry' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    // Page paths previous period (classified into marketing/app for the ghost)
    { sql: "SELECT blob2 as path, COUNT() as c FROM agora_llm WHERE blob1 = 'page' AND blob2 != '' AND timestamp " + prevRange() + " GROUP BY path ORDER BY c DESC LIMIT 200", dataset: 'agora_llm' },
    // Daily Conversations (chat) current + previous period for the ghost trend line
    S.range > 1
      ? { sql: "SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) as t, COUNT() as c FROM agora_llm WHERE blob1 = 'chat' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' }
      : { sql: "SELECT 1 as c", dataset: 'agora_llm' },
    S.range > 1
      ? { sql: "SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) as t, COUNT() as c FROM agora_llm WHERE blob1 = 'chat' AND timestamp " + prevRange() + " GROUP BY t ORDER BY t", dataset: 'agora_llm' }
      : { sql: "SELECT 1 as c", dataset: 'agora_llm' },
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
  // TTS-per-chat as a multiplier, not as a percentage. A single LLM response
  // typically chunks into 4-6 TTS calls (one per sentence), and the figure
  // carousel on LoginPage plays voice samples that don't correspond to any
  // LLM call. Both push TTS > LLM, so a "% adoption" framing hits 400-500%
  // and reads as broken. Multiplier is interpretable at any value.
  var voiceRatio = chats > 0 ? (tts / chats) : 0;

  var sparkSessions = rows(r[13]).map(function(r) { return r.c; });
  var sparkChats = rows(r[14]).map(function(r) { return r.c; });
  var sparkTts = rows(r[15]).map(function(r) { return r.c; });
  var hourlyChat = rows(r[16]);
  var dailyTrend = S.range > 1 ? rows(r[17]) : [];
  var topFigure = rows(r[18]);
  var langSplit = rows(r[19]);
  // r[20]=content type, r[21]=top figures by content (these were already correct
  // before this commit). The pre-existing channelSources/topCountries variables
  // were dead code; removed. The new arrivals/entries vars are at the actual
  // array positions of the queries appended at the end of the batch.
  var contentByType = rows(r[20]);
  var topFiguresByContent = rows(r[21]);
  var arrivals = val(r[22]);
  var arrivalsPrev = val(r[23]);
  var entries = val(r[24]);
  var sparkArrivals = rows(r[25]).map(function(r) { return r.c; });
  // Funnel: marketing arrivals (Astro static pages) vs app arrivals (React SPA).
  // We get all page paths grouped + counted from AE in one query (LIKE is not
  // supported by AE SQL) and classify them here in JS using prefix lookup +
  // exact-match for the leaf marketing pages.
  var MARKETING_PREFIXES = ['/figures', '/themes', '/de/figures', '/de/themes'];
  var MARKETING_EXACT = {
    // Homepages: the cinematic Observatory landing. Since the 2026-05-29
    // relocation, '/' and '/de/' are the STATIC marketing homepage, not the
    // React app (which moved to /app). They are top-of-funnel marketing, so
    // they belong here, not in the "everything else = App" bucket below.
    '/': 1, '/de': 1, '/de/': 1,
    '/about': 1, '/about/': 1, '/contact': 1, '/contact/': 1,
    '/impressum': 1, '/impressum/': 1, '/datenschutz': 1, '/datenschutz/': 1,
    '/cookie-policy': 1, '/cookie-policy/': 1, '/nutzungsbedingungen': 1, '/nutzungsbedingungen/': 1,
    '/de/about': 1, '/de/about/': 1, '/de/contact': 1, '/de/contact/': 1,
    '/de/impressum': 1, '/de/impressum/': 1, '/de/datenschutz': 1, '/de/datenschutz/': 1,
  };
  var allPaths = rows(r[26]);
  var marketingArrivals = 0;
  var appArrivalsFromPaths = 0;
  var topMarketingPages = [];
  for (var i = 0; i < allPaths.length; i++) {
    var pathRow = allPaths[i];
    var p = String(pathRow.path || '');
    var isMkt = false;
    for (var j = 0; j < MARKETING_PREFIXES.length; j++) {
      if (p.indexOf(MARKETING_PREFIXES[j]) === 0) { isMkt = true; break; }
    }
    if (!isMkt && MARKETING_EXACT[p]) isMkt = true;
    if (isMkt) {
      marketingArrivals += Number(pathRow.c) || 0;
      // Include every marketing page (figures, themes, about, contact, impressum,
      // datenschutz + their /de/ variants) so the chart reflects total marketing-
      // page traffic. Labels are computed in the topMarketingItems map below.
      topMarketingPages.push(pathRow);
    } else {
      // Non-marketing paths (/app + SPA routes) are the App stage, summed from
      // the SAME query as Marketing so the two are always mutually consistent.
      appArrivalsFromPaths += Number(pathRow.c) || 0;
    }
  }
  topMarketingPages.sort(function(a, b) { return b.c - a.c; });
  topMarketingPages = topMarketingPages.slice(0, 15);
  var signups = val(r[27]);
  var signupsPrev = val(r[30]);
  // D1 period-over-period reads (appended queries r[31..34]).
  var entriesPrev = val(r[31]);
  var prevPaths = rows(r[32]);
  var dailyConv = S.range > 1 ? rows(r[33]) : [];
  var dailyConvPrev = S.range > 1 ? rows(r[34]) : [];
  // Previous-period marketing-vs-app split (same classification as the current
  // period) so the funnel can draw a ghost bar behind each stage. MARKETING_*
  // and arrivalsPrev are already in scope above.
  var marketingArrivalsPrev = 0;
  var appArrivalsPrev = 0;
  for (var pi = 0; pi < prevPaths.length; pi++) {
    var pp2 = String(prevPaths[pi].path || '');
    var isMkt2 = false;
    for (var pj = 0; pj < MARKETING_PREFIXES.length; pj++) {
      if (pp2.indexOf(MARKETING_PREFIXES[pj]) === 0) { isMkt2 = true; break; }
    }
    if (!isMkt2 && MARKETING_EXACT[pp2]) isMkt2 = true;
    if (isMkt2) marketingArrivalsPrev += Number(prevPaths[pi].c) || 0;
    else appArrivalsPrev += Number(prevPaths[pi].c) || 0;
  }
  // Engagement endpoints (parallel from Sessions): content played + chat sent.
  // Content Started total is derived from the existing contentByType breakdown
  // (saves one query). Content Completed and Chat-by-Mode are new dedicated queries.
  var contentStarted = contentByType.reduce(function(acc, row) { return acc + (Number(row.c) || 0); }, 0);
  var contentCompleted = val(r[28]);
  var chatByMode = rows(r[29]);
  // App arrivals come from the SAME path-breakdown query as Marketing (above),
  // NOT from subtracting the independent total-arrivals COUNT. Analytics Engine
  // is eventually consistent across queries, so total-arrivals could briefly read
  // lower than marketing-arrivals and clamp App to 0 ("Marketing 560, App 0,
  // Entry 20" — an impossible funnel that self-healed on the next refresh). Same
  // query in, same query out: Marketing and App can never disagree now.
  var appArrivals = appArrivalsFromPaths;
  // bouncePct/bounceSub removed with the Arrivals hero KPI — the metric mixed
  // marketing-page bounces and login-page bounces into a single misleading
  // percentage. Per-stage drop-off lives in the Funnel below.

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

  // Reassurance banner: a quiet 24h window is expected at this scale, so frame
  // it as normal and point at the 7-day view rather than letting it read as a
  // failure. Only fires on the 24h window with near-zero conversations.
  if (S.range === 1 && chats < 3) {
    alertsEl.innerHTML += '<div class="hint-banner">Quiet 24h is normal at this stage. <a onclick="setRange(7)">The 7-day view</a> is the real read, not any single day.</div>';
  }

  var html = '';

  // STATUS STRIP — "is anything on fire" (health) + "are we better than last
  // period" (momentum verdict), the two reads the founder wants first. Both reuse
  // existing counts; the momentum line shares deltaHtml's small-base guard so it
  // never contradicts the Conversations delta chip below.
  html += '<div class="card card-full status-strip">' +
    healthChipHtml(totalErrors, totalRl, S.serverData) +
    momentumChip(chats, chatsPrev) +
    '</div>';

  // PULSE — the week in one screen: the three numbers that matter, with an
  // auto-composed decision line. Conversations (chat) is the North Star: the
  // only event a click-flood or bot cannot inflate. Raw Visits is shown but
  // explicitly captioned as mixed/unfiltered so it is never read as success.
  html += '<div class="section-divider" style="grid-column:1/-1">Pulse &middot; ' + RANGE_LABEL[S.range] + '</div>';
  html += kpi('Conversations', chats, { hero: true, spark: sparkChats, sparkColor: '#5B8BD4', delta: chatsPrev, sub: 'real chat messages. the one that means it worked' });
  html += kpi('New Signups', signups, { hero: true, delta: signupsPrev, sub: 'genuinely new accounts' });
  html += kpi('Raw Visits', arrivals, { sub: 'mixed: ads + bots, no source split yet' });
  html += decisionLine(chats, signups, arrivals, sessions);

  // Hero KPIs removed 2026-05-25: the previous Arrivals/Sessions/Conversations
  // trio duplicated what the Funnel below already shows, and "Arrivals" mixed
  // marketing and app page beacons in a way that double-counted transitions
  // (a single user landing on /figures then clicking through to / fires both
  // beacons). The Funnel is the primary view; per-channel KPIs with deltas
  // live in the secondary row + the Marketing / Engagement / Audio tabs.

  // NEW-VISITOR FUNNEL — the only clean monotonic chain: a new visitor lands on
  // marketing, opens the app, reaches the welcome modal (entry), and is recorded
  // as a new account (signup). Sessions is NOT in this chain: it is a broader,
  // partly-disjoint population (returning + passive app opens), and chaining it
  // here is what produced the impossible "400%". Sessions now lives in the
  // Activity pool below, paired with Chats.
  var funnelStages = [
    { label: 'Marketing', value: marketingArrivals, prev: marketingArrivalsPrev, sub: 'figures · themes · about' },
    { label: 'App', value: appArrivals, prev: appArrivalsPrev, sub: '/app + SPA routes' },
    { label: 'Entry', value: entries, prev: entriesPrev, sub: 'consent + enter' },
    { label: 'Signup', value: signups, prev: signupsPrev, sub: 'new accounts' },
  ];
  // ACTIVITY POOL — App Sessions sits next to Chat Messages (not a funnel). The
  // relationship is shown as a sample-gated multiplier, never a percentage, so
  // it cannot reproduce the >100% artifact.
  var engagementStages = [
    { label: 'App Sessions', value: sessions, sub: 'app opened, incl. returning' },
    { label: 'Chat Messages', value: chats, sub: 'real LLM messages' },
    { label: 'Content Started', value: contentStarted, sub: 'first-play events' },
    { label: 'Content Completed', value: contentCompleted, sub: 'fully heard' },
  ];
  var perSession = multiplierOrDash(chats, sessions, 20);
  var activityNote = perSession === '--'
    ? 'Chats per session: too few sessions yet to be meaningful.'
    : 'Chats per session: ' + perSession + '. Reads low by design, since App Sessions counts passive and returning opens that never intend to chat.';
  // Legend + footnote keep the honest definitions a multi-day window needs.
  var funnelLegend = '<div class="fbar-legend">' +
    '<span class="swatch" style="background:var(--gold-subtle)"></span> this ' + RANGE_LABEL[S.range] +
    '<span class="swatch" style="background:color-mix(in srgb, var(--gold-deep) 22%, transparent);margin-left:10px"></span> previous period (ghost)' +
    '</div>';
  var funnelNote = '<div style="margin-top:8px;font-size:11px;color:var(--dim);line-height:1.4">' +
    'New-visitor funnel only, compared step by step against the previous ' + RANGE_LABEL[S.range] + ' (the faint bars). ' +
    'Entry &amp; Signup fire at the welcome modal (post-consent). ' +
    'Returning visitors skip it, so they appear only as App Sessions below, never here. ' +
    'Marketing = / and /de/ plus figure and theme pages (mixed sources, incl. ads + bots). App = /app.' +
    '</div>';
  html += chartCard(
    'New-visitor funnel',
    ghostFunnelHtml(funnelStages) +
    funnelLegend +
    engagementPoolHtml('&#8627; Activity (parallel, a sessioned user can do several)', engagementStages, activityNote) +
    funnelNote,
    'card-full'
  );

  // Health check: errors + the server mini-card. Chat volume now lives in the
  // Pulse row above; TTS/voice infra moved to the Audio tab where it belongs.
  html += kpi('Errors', totalErrors, { sub: totalErrors > 0 ? llmErrors + ' LLM + ' + audioErrors + ' audio' : 'all clear', valColor: totalErrors > 0 ? '#E97451' : '#68C397' });

  // Mini server health
  html += '<div class="card card-interactive" onclick="switchTab(\\\'servers\\\')" tabindex="0" role="button" id="mini-servers"><div class="kpi-label">Server Health</div><div id="mini-servers-inner" style="margin-top:8px">Loading...</div></div>';

  // Chat activity graph (always visible)
  html += '<div class="section-divider" style="grid-column:1/-1">Activity &amp; content</div>';
  if (hourlyChat.length > 1) {
    var chatItems = hourlyChat.slice(-24).map(function(row) {
      return { label: new Date(row.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), c: row.c };
    });
    html += chartCard('Chat Activity', svgBarGraph(chatItems, { color: '#5B8BD4', height: 140, ariaLabel: 'Chat messages per hour' }), 'card-wide');
  } else {
    html += chartCard('Chat Activity', '<div class="empty-state" style="padding:40px 0">No chat data yet ' + RANGE_LABEL[S.range] + '</div>', 'card-wide');
  }

  // Content STARTED by Type — playback beacons (audio first-play events).
  // The Overview chart historically showed both started + completed mixed
  // and was labelled "Completed", which is misleading because completed
  // events are rare (a single completed story today vs 24 starts). The
  // engagement-quality cut (started vs completed, completion rate) lives
  // on the Engagement tab; Overview just surfaces what content gets
  // first-played.
  var contentTypeItems = aggregateByLabel(contentByType.map(function(r) {
    return { label: r.type || 'unknown', c: r.c };
  }));
  html += chartCard('Content Started by Type', barsHtml(contentTypeItems, '#68C397'), 'card-half');

  // Chat activity by mode — Wisdom (seed_conversation), Quest (challenge),
  // Freetalk (free_conversation). Sibling to "Content Started by Type" so
  // users can compare listening vs talking activity at a glance.
  var chatModeItems = aggregateByLabel(chatByMode.map(function(r) {
    return { label: modeLabel(r.mode || 'unknown'), c: r.c };
  }));
  html += chartCard('Chat by Mode', barsHtml(chatModeItems, '#D8A4C0'), 'card-half');

  // Top figures by content first-play (same data, grouped by figure)
  var topFiguresContentItems = aggregateByLabel(topFiguresByContent.map(function(r) {
    return { label: cap(r.figure), c: r.c };
  }).filter(function(r) { return r.label; }));
  html += chartCard('Top Figures by Plays', barsHtml(topFiguresContentItems, '#5B8BD4'), 'card-half');

  // Top marketing pages by arrivals — which figure / theme pages are pulling
  // the most paid + organic traffic. Strips the path to a short readable
  // label ("aurelius" not "/figures/marcus-aurelius/"). Empty if no marketing
  // arrivals yet (typical for first 1-2 days after the page-beacon fix went live).
  var topMarketingItems = topMarketingPages.map(function(row) {
    // Strip path to a short readable label without regex — TS template literals
    // eat regex escape sequences, so we use plain string methods. Distinguishes
    // EN/DE with a "(de)" suffix and labels the index pages explicitly.
    var raw = String(row.path || '');
    var isDe = raw.indexOf('/de/') === 0;
    var p = isDe ? raw.slice(4) : (raw.charAt(0) === '/' ? raw.slice(1) : raw);
    var prefix = '';
    var bucket = '';
    if (p.indexOf('figures/') === 0) { p = p.slice(8); bucket = 'figures'; }
    else if (p === 'figures') { p = ''; bucket = 'figures'; }
    else if (p.indexOf('themes/') === 0) { p = p.slice(7); prefix = '~'; bucket = 'themes'; }
    else if (p === 'themes') { p = ''; prefix = '~'; bucket = 'themes'; }
    if (p.length > 0 && p.charAt(p.length - 1) === '/') p = p.slice(0, -1);
    var label;
    if (p === '') {
      if (bucket === 'themes') label = 'all themes';
      else if (bucket === 'figures') label = 'all figures';
      else label = raw || '/';
    } else {
      label = prefix + p;
    }
    if (isDe) label += ' (de)';
    return { label: label, c: row.c };
  });
  html += chartCard('Top Marketing Pages', topMarketingItems.length > 0 ? barsHtml(topMarketingItems, '#9B7BC7') : '<div class="empty-state" style="padding:20px 0">No marketing arrivals yet ' + RANGE_LABEL[S.range] + '</div>', 'card-wide');

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

  // Daily Conversations trend with a faint previous-period ghost line, so
  // improvement reads as the solid line sitting above its ghost. Conversations
  // (chat) is the North Star: the one metric a bot or click flood cannot inflate.
  if (dailyConv.length > 1) {
    var convItems = dailyConv.map(function(row) {
      return { label: new Date(row.t).toLocaleDateString([], { month: 'short', day: 'numeric' }), c: row.c };
    });
    var convGhost = dailyConvPrev.map(function(row) { return Number(row.c); });
    html += chartCard('Daily Conversations', svgAreaGraph(convItems, { color: '#5B8BD4', ghost: convGhost.length > 1 ? convGhost : null, ariaLabel: 'Daily conversations trend; the dashed line is the previous period' }), 'card-full');
  } else if (sparkTts.length > 1) {
    // Show TTS activity as area graph when there is no multi-day trend yet
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
    // Server distribution — TTS-only so it sums to the TTS Requests count.
    // STT (small relative volume) has its own counter; combining was producing
    // mismatched totals (e.g. 67 vs 60) in adjacent panels.
    { sql: "SELECT blob3 as server, COUNT() as c FROM agora_audio WHERE blob5 = 'speech' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY server ORDER BY c DESC", dataset: 'agora_audio' },
    // Audio language split
    { sql: "SELECT blob1 as lang, COUNT() as c FROM agora_audio WHERE blob5 = 'speech' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY lang ORDER BY c DESC", dataset: 'agora_audio' },
    // Rate limits
    { sql: "SELECT blob3 as reason, COUNT() as c FROM agora_llm WHERE blob1 = 'ratelimit' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY reason ORDER BY c DESC", dataset: 'agora_llm' },
    { sql: "SELECT blob4 as reason, COUNT() as c FROM agora_audio WHERE blob5 = 'ratelimit' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY reason ORDER BY c DESC", dataset: 'agora_audio' },
    // Content completions by type — playback beacons (event='completed' or empty for legacy rows)
    { sql: "SELECT blob5 as type, COUNT() as c FROM agora_llm WHERE blob1 = 'playback' AND (blob8 = '' OR blob8 = 'completed') AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY type ORDER BY c DESC", dataset: 'agora_llm' },
    // Content completions by figure
    { sql: "SELECT blob2 as figure, COUNT() as c FROM agora_llm WHERE blob1 = 'playback' AND (blob8 = '' OR blob8 = 'completed') AND blob2 != '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY figure ORDER BY c DESC LIMIT 10", dataset: 'agora_llm' },
    // Content completions by language
    { sql: "SELECT blob4 as lang, COUNT() as c FROM agora_llm WHERE blob1 = 'playback' AND (blob8 = '' OR blob8 = 'completed') AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY lang ORDER BY c DESC", dataset: 'agora_llm' },
    // Completions sparkline
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE blob1 = 'playback' AND (blob8 = '' OR blob8 = 'completed') AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
    // Total completions previous period for delta
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'playback' AND (blob8 = '' OR blob8 = 'completed') AND timestamp " + prevRange(), dataset: 'agora_llm' },
    // Started events — total + sparkline (Phase 1 Option 1)
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'playback' AND blob8 = 'started' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE blob1 = 'playback' AND blob8 = 'started' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
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
  var playbackByType = rows(r[27]);
  var playbackByFigure = rows(r[28]);
  var playbackByLang = rows(r[29]);
  var sparkPlayback = rows(r[30]).map(function(x) { return x.c; });
  var sparkPlaybackRows = rows(r[30]);
  var playbackPrev = val(r[31]);
  var playbackStarted = val(r[32]);
  var sparkStartedRows = rows(r[33]);
  var totalPlayback = playbackByType.reduce(function(s, x) { return s + x.c; }, 0);
  var completionRate = playbackStarted > 0 ? Math.round((totalPlayback / playbackStarted) * 100) : null;
  var totalLlm = chats + councils + summaries;
  var chatsPerSession = multiplierOrDash(chats, sessions, 20);
  var totalRlLlm = rlLlm.reduce(function(s, r) { return s + r.c; }, 0);
  var totalRlAudio = rlAudio.reduce(function(s, r) { return s + r.c; }, 0);

  var html = '';

  // === ENGAGEMENT SECTION ===
  html += '<div class="section-divider">Engagement</div>';
  html += '<div class="grid">';
  html += kpi('App Sessions', sessions, { hero: true, spark: sparkSessions, delta: sessionsPrev, sub: 'app opened, incl. returning. not a conversation' });
  html += kpi('Chat Messages', chats, { spark: sparkChats, sparkColor: '#5B8BD4', delta: chatsPrev });
  html += kpi('Councils', councils, { delta: councilsPrev });
  html += kpi('Summaries', summaries, { delta: summariesPrev });
  html += kpi('Chats / Session', chatsPerSession, { sub: chatsPerSession === '--' ? 'need 20+ sessions to be meaningful' : 'reads low: sessions incl. passive and returning opens' });

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

  // === CONTENT CONSUMPTION SECTION ===
  // Real consumption signal — fires when a user completes a story/teaching/
  // prism/council in localStorage (same trigger as the gamification star).
  // 'started' fires from useAudio on first play; 'completed' from mark*Completed.
  html += '<div class="section-divider">Content Consumption</div>';
  html += '<div class="grid">';
  html += kpi('Content Started', playbackStarted, { hero: true, sub: 'audio first-play (story/prism/council/foreword)' });
  html += kpi('Content Completed', totalPlayback, { hero: true, spark: sparkPlayback, sparkColor: '#68C397', delta: playbackPrev, sub: 'stories, teachings, prisms, councils' });
  html += kpi('Completion Rate',
    completionRate === null ? '--' : (completionRate + '%'),
    { sub: completionRate === null ? 'awaiting first start' : (totalPlayback + ' / ' + playbackStarted),
      valColor: completionRate === null ? 'var(--dim)' : (completionRate >= 50 ? '#68C397' : completionRate >= 25 ? '#F5A623' : '#E97451') }
  );

  // Started vs Completed over time (the funnel signal)
  if (sparkPlaybackRows.length > 1 || sparkStartedRows.length > 1) {
    var startedMap = {};
    sparkStartedRows.forEach(function(row) { startedMap[row.t] = row.c; });
    var allBuckets = new Set();
    sparkPlaybackRows.forEach(function(row) { allBuckets.add(row.t); });
    sparkStartedRows.forEach(function(row) { allBuckets.add(row.t); });
    var bucketArr = Array.from(allBuckets).sort();
    var completedMap = {};
    sparkPlaybackRows.forEach(function(row) { completedMap[row.t] = row.c; });
    var graphItems = bucketArr.map(function(t) {
      var d = new Date(t);
      var label = S.range <= 1
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return { label: label, started: startedMap[t] || 0, completed: completedMap[t] || 0 };
    });
    // Render as a stacked-style summary inline (vanilla bar pair per bucket)
    var maxBucket = Math.max(1, ...graphItems.map(function(g) { return Math.max(g.started, g.completed); }));
    var graphHtml = '<div style="display:flex;align-items:flex-end;gap:4px;height:120px;padding:8px 0">';
    graphItems.slice(-24).forEach(function(g) {
      var h1 = Math.round((g.started / maxBucket) * 100);
      var h2 = Math.round((g.completed / maxBucket) * 100);
      graphHtml += '<div style="flex:1;display:flex;flex-direction:column;gap:1px;justify-content:flex-end;min-width:0" title="' + g.label + ': ' + g.started + ' started / ' + g.completed + ' completed">';
      graphHtml += '<div style="background:#5B8BD4;height:' + h1 + '%;border-radius:2px 2px 0 0;min-height:1px;opacity:0.85"></div>';
      graphHtml += '<div style="background:#68C397;height:' + h2 + '%;border-radius:2px 2px 0 0;min-height:1px"></div>';
      graphHtml += '</div>';
    });
    graphHtml += '</div>';
    graphHtml += '<div style="display:flex;gap:16px;font-size:0.75rem;margin-top:6px;color:var(--dim)">';
    graphHtml += '<span><span style="display:inline-block;width:10px;height:10px;background:#5B8BD4;border-radius:2px;margin-right:4px;vertical-align:middle"></span>Started</span>';
    graphHtml += '<span><span style="display:inline-block;width:10px;height:10px;background:#68C397;border-radius:2px;margin-right:4px;vertical-align:middle"></span>Completed</span>';
    graphHtml += '</div>';
    html += chartCard('Started vs Completed Over Time', graphHtml, 'card-full');
  }

  // By type — story / teaching / prism / council / foreword
  var pbTypeItems = aggregateByLabel(playbackByType.map(function(r) {
    return { label: r.type || 'unknown', c: r.c };
  }));
  if (pbTypeItems.length > 0) {
    html += chartCard('By Type', barsHtml(pbTypeItems, '#68C397'), 'card-half');
  } else {
    html += chartCard('By Type', '<div class="empty-state" style="padding:30px 0">No completions yet ' + RANGE_LABEL[S.range] + '</div>', 'card-half');
  }

  // By figure — which figures users actually finish
  var pbFigItems = aggregateByLabel(playbackByFigure.map(function(r) {
    return { label: cap(r.figure), c: r.c };
  }).filter(function(r) { return r.label; }));
  if (pbFigItems.length > 0) {
    html += chartCard('Top Figures by Completion', barsHtml(pbFigItems, '#5B8BD4'), 'card-half');
  } else {
    html += chartCard('Top Figures by Completion', '<div class="empty-state" style="padding:30px 0">No completions yet ' + RANGE_LABEL[S.range] + '</div>', 'card-half');
  }

  // By language
  if (playbackByLang.length > 0) {
    html += chartCard('Completion Language', donutSvg(playbackByLang.map(function(r) { return { key: r.lang || 'unknown', c: r.c }; }), COLORS.lang, function(l) { return l === 'de' ? 'Deutsch' : (l === 'en' ? 'English' : 'Unknown'); }), '');
  }
  html += '</div>';

  // === LLM CAPACITY (chat-side rate limits + global config) ===
  // Audio rate limits + audio activity moved to the dedicated Audio tab.
  html += '<div class="section-divider">Capacity</div>';
  html += '<div class="grid">';

  if (totalRlLlm > 0) {
    var llmDonut = donutSvg(rlLlm.map(function(r) { return { key: r.reason, c: r.c }; }), COLORS.rl, function(r) { return r === 'daily' ? 'Daily' : r === 'global' ? 'Global' : cap(r); }, 60);
    html += chartCard('LLM Rate Limits (' + totalRlLlm + ')', llmDonut, '');
  } else {
    html += '<div class="card"><div class="kpi-label">LLM Rate Limits</div><div style="margin-top:8px;font-size:0.8125rem;color:var(--ok)">No rate limit hits ' + RANGE_LABEL[S.range] + '</div></div>';
  }

  html += '<div class="card card-wide"><div class="kpi-label">LLM Limits</div><div class="limits-grid">' +
    '<div><span class="lim-val">30</span><span class="lim-key">Chat / day / IP</span></div>' +
    '<div><span class="lim-val">1</span><span class="lim-key">Council / day</span></div>' +
    '<div><span class="lim-val">2</span><span class="lim-key">Summary / day</span></div>' +
    '<div><span class="lim-val">15K</span><span class="lim-key">LLM global / day</span></div>' +
    '</div></div>';
  html += '</div>';

  grid.innerHTML = html;
  alertsEl.innerHTML = '';
  document.getElementById('updated-product').textContent = 'Updated ' + now();
}

// --- Audio Tab ---

async function loadAudio() {
  var grid = document.getElementById('grid-audio');
  var alertsEl = document.getElementById('alerts-audio');

  var queries = [
    // TTS volume (current + previous)
    { sql: "SELECT COUNT() as c FROM agora_audio WHERE blob5 = 'speech' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_audio' },
    { sql: "SELECT COUNT() as c FROM agora_audio WHERE blob5 = 'speech' AND timestamp " + prevRange(), dataset: 'agora_audio' },
    // STT volume (current + previous)
    { sql: "SELECT COUNT() as c FROM agora_audio WHERE blob5 = 'transcriptions' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_audio' },
    { sql: "SELECT COUNT() as c FROM agora_audio WHERE blob5 = 'transcriptions' AND timestamp " + prevRange(), dataset: 'agora_audio' },
    // TTS sparkline
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_audio WHERE blob5 = 'speech' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_audio' },
    // Avg TTS latency
    { sql: "SELECT AVG(double1) as avg_ms FROM agora_audio WHERE blob5 = 'speech' AND blob4 = '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_audio' },
    // Audio errors
    { sql: "SELECT COUNT() as c FROM agora_audio WHERE blob5 IN ('speech','transcriptions') AND blob4 != '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_audio' },
    // TTS models
    { sql: "SELECT blob2 as model, COUNT() as c, AVG(double1) as avg_ms FROM agora_audio WHERE blob5 = 'speech' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY model ORDER BY c DESC", dataset: 'agora_audio' },
    // Server distribution — TTS-only so it sums to the TTS Requests count.
    // STT (small relative volume) has its own counter; combining was producing
    // mismatched totals (e.g. 67 vs 60) in adjacent panels.
    { sql: "SELECT blob3 as server, COUNT() as c FROM agora_audio WHERE blob5 = 'speech' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY server ORDER BY c DESC", dataset: 'agora_audio' },
    // Audio language split
    { sql: "SELECT blob1 as lang, COUNT() as c FROM agora_audio WHERE blob5 = 'speech' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY lang ORDER BY c DESC", dataset: 'agora_audio' },
    // Audio rate limits
    { sql: "SELECT blob4 as reason, COUNT() as c FROM agora_audio WHERE blob5 = 'ratelimit' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY reason ORDER BY c DESC", dataset: 'agora_audio' },
  ];

  var r = await batch(queries);
  S.lastAnalytics = Date.now();

  var tts = val(r[0]), ttsPrev = val(r[1]);
  var stt = val(r[2]), sttPrev = val(r[3]);
  var sparkTts = rows(r[4]).map(function(x) { return x.c; });
  var sparkTtsRows = rows(r[4]);
  var avgLatency = r[5] && r[5].data && r[5].data[0] ? Number(r[5].data[0].avg_ms) : 0;
  var audioErrors = val(r[6]);
  var ttsModels = rows(r[7]);
  var serverDist = rows(r[8]);
  var audioLangs = rows(r[9]);
  var rlAudio = rows(r[10]);
  var totalRlAudio = rlAudio.reduce(function(s, x) { return s + x.c; }, 0);

  var html = '';

  // === ACTIVITY ===
  html += '<div class="section-divider">Audio Activity</div>';
  html += '<div class="grid">';
  html += kpi('TTS Requests', tts, { hero: true, spark: sparkTts, sparkColor: '#68C397', delta: ttsPrev });
  html += kpi('STT Requests', stt, { delta: sttPrev });
  html += kpi('Avg TTS Latency', fmtMs(avgLatency), {});
  html += kpi('Audio Errors', audioErrors, { sub: audioErrors > 0 ? 'non-200 responses' : 'all clear', valColor: audioErrors > 0 ? '#E97451' : '#68C397' });

  // TTS volume over time
  if (sparkTtsRows.length > 1) {
    var ttsGraphItems = sparkTtsRows.map(function(row) {
      var d = new Date(row.t);
      var label = S.range <= 1
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return { label: label, c: row.c };
    });
    html += chartCard('TTS Volume Over Time', svgAreaGraph(ttsGraphItems, { color: '#68C397', height: 130, ariaLabel: 'TTS requests over time' }), 'card-full');
  }
  html += '</div>';

  // === BACKEND ===
  html += '<div class="section-divider">Backend Distribution</div>';
  html += '<div class="grid">';

  if (ttsModels.length > 0) {
    var mRows = ttsModels.map(function(r) {
      var mc = COLORS.models[r.model] || 'var(--dim)';
      return ['<span style="color:' + mc + '">' + r.model + '</span>', fmt(r.c), fmtMs(r.avg_ms)];
    });
    html += chartCard('TTS Models', tableHtml(['Model', 'Requests', 'Avg Latency'], mRows), 'card-wide');
  }

  if (serverDist.length > 0) {
    html += chartCard('Server Distribution', donutSvg(serverDist.map(function(r) { return { key: r.server, c: r.c }; }), COLORS.servers, function(s) { return s.toUpperCase(); }), '');
  }
  if (audioLangs.length > 0) {
    html += chartCard('Audio Language', donutSvg(audioLangs.map(function(r) { return { key: r.lang, c: r.c }; }), COLORS.lang, function(l) { return l === 'de' ? 'Deutsch' : 'English'; }), '');
  }
  html += '</div>';

  // === RATE LIMITS ===
  html += '<div class="section-divider">Audio Rate Limits</div>';
  html += '<div class="grid">';
  if (totalRlAudio > 0) {
    var audioRlLabels = { gpu_capacity_german: 'GPU RED (DE)', daily_limit: 'Daily cap', burst_limit: 'Burst' };
    var audioDonut = donutSvg(rlAudio.map(function(r) { return { key: r.reason, c: r.c }; }), COLORS.rl, function(r) { return audioRlLabels[r] || r; }, 60);
    html += chartCard('Audio Rate Limits (' + totalRlAudio + ')', audioDonut, '');
  } else {
    html += '<div class="card"><div class="kpi-label">Audio Rate Limits</div><div style="margin-top:8px;font-size:0.8125rem;color:var(--ok)">No rate limit hits ' + RANGE_LABEL[S.range] + '</div></div>';
  }
  html += '<div class="card card-wide"><div class="kpi-label">Audio Limits</div><div class="limits-grid">' +
    '<div><span class="lim-val">500</span><span class="lim-key">Audio / day / IP</span></div>' +
    '<div><span class="lim-val">60</span><span class="lim-key">Audio burst / min</span></div>' +
    '</div></div>';
  html += '</div>';

  grid.innerHTML = html;
  alertsEl.innerHTML = '';
  document.getElementById('updated-audio').textContent = 'Updated ' + now();
}

// --- Navigation ---

// ─── Ad Grants Conversions ───

async function loadAdGrants() {
  var grid = document.getElementById('grid-adgrants');
  var alertsEl = document.getElementById('alerts-adgrants');

  // Conversion events are GCLID-GATED: they fire only for visitors who arrive
  // with a Google Ads gclid AND grant ad consent. With the Ad Grant paused, ~0
  // is expected and correct. start_exploring is the earliest signal: it fires
  // when an opted-in grant visitor accepts the on-page consent prompt or clicks
  // a Start Exploring CTA, so it leads the conversions row below.
  var queries = [
    // Profile Creation — current, previous (delta), sparkline
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'profile_created' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'profile_created' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE index1 = 'profile_created' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
    // Mode Selected — current, sparkline, by figure
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'mode_selected' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE index1 = 'mode_selected' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
    { sql: "SELECT blob2 as figure, COUNT() as c FROM agora_llm WHERE index1 = 'mode_selected' AND blob2 != '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY figure ORDER BY c DESC LIMIT 10", dataset: 'agora_llm' },
    // Council Engaged — current, sparkline
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'council_engaged' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE index1 = 'council_engaged' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
    // Geographic reach: where conversations physically come from
    { sql: "SELECT blob7 as country, COUNT() as c FROM agora_llm WHERE blob1 IN ('chat','council','summary') AND blob5 = '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY country ORDER BY c DESC LIMIT 10", dataset: 'agora_llm' },
    // Content reach: completions by type
    { sql: "SELECT blob5 as type, COUNT() as c FROM agora_llm WHERE blob1 = 'playback' AND (blob8 = '' OR blob8 = 'completed') AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY type ORDER BY c DESC", dataset: 'agora_llm' },
    // Traffic volume (mixed sources, no attribution yet): page beacons + prev
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'page' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'page' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    // Top countries by raw page arrivals (geo of all traffic, not just chatters)
    { sql: "SELECT blob7 as country, COUNT() as c FROM agora_llm WHERE blob1 = 'page' AND blob7 != '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY country ORDER BY c DESC LIMIT 10", dataset: 'agora_llm' },
    // --- D1: funnel-rate scoreboard (source-free, existing events). r[13..18],
    // appended at the end so existing positional reads do not shift. ---
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'signup' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'signup' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'entry' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'entry' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'chat' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'session' AND blob5 = '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    // --- start_exploring (re-added as the funnel entry). r[19..21], appended at
    // the end so existing positional reads do not shift. ---
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'start_exploring' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'start_exploring' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE index1 = 'start_exploring' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
  ];

  var r = await batch(queries);

  var profileConv = val(r[0]), profilePrev = val(r[1]);
  var sparkProfile = rows(r[2]).map(function(x) { return x.c; });
  var modeSelConv = val(r[3]);
  var sparkModeSel = rows(r[4]).map(function(x) { return x.c; });
  var modeByFigure = rows(r[5]);
  var councilEngagedConv = val(r[6]);
  var sparkCouncilEng = rows(r[7]).map(function(x) { return x.c; });
  var topCountriesChat = rows(r[8]);
  var playbackByType = rows(r[9]);
  var visits = val(r[10]), visitsPrev = val(r[11]);
  var topCountriesAll = rows(r[12]);
  // D1 rate scoreboard inputs (r[13..18]).
  var gSignups = val(r[13]), gSignupsPrev = val(r[14]);
  var gEntries = val(r[15]), gEntriesPrev = val(r[16]);
  var gChats = val(r[17]), gSessions = val(r[18]);
  // start_exploring (r[19..21]) — the re-added funnel entry.
  var startExpConv = val(r[19]), startExpPrev = val(r[20]);
  var sparkStartExp = rows(r[21]).map(function(x) { return x.c; });

  // Modes picked per ad-profile, within the gclid population only, gated for n.
  var modeFromProfile = multiplierOrDash(modeSelConv, profileConv, 5);

  alertsEl.innerHTML = '';

  var html = '';

  // ── FUNNEL RATES (source-free, existing events) ──
  // The new hero of this tab: are the top-of-funnel rates trending up? Rates are
  // taken over all visits (a conservative floor, since visits include ads + bots
  // that we never split by source). What matters is the direction, shown as the
  // percentage-point change vs the previous period. Activation depth stays a
  // sample-gated multiplier (chats per session), never a cross-population %.
  html += '<div class="section-divider">Funnel rates</div>';
  html += '<div class="hint-banner">Rates over all visits, so they read low on purpose (visits include ads and bots, which we never split by source). Watch the direction week over week, not the absolute number.</div>';
  html += '<div class="grid">';
  html += rateCard('Signup rate', gSignups, visits, gSignupsPrev, visitsPrev, { hero: true, target: 5, sub: 'new accounts as a share of all visits' });
  html += rateCard('Entry rate', gEntries, visits, gEntriesPrev, visitsPrev, { target: 10, sub: 'reached welcome and consented, as a share of all visits' });
  html += kpi('Chats per session', multiplierOrDash(gChats, gSessions, 20), { sub: 'activation depth (a multiplier, not a %). App Sessions include returning and passive opens' });
  html += '</div>';

  // ── GOOGLE ADS CONVERSIONS (gclid-gated) ──
  html += '<div class="section-divider">Google Ads Conversions</div>';
  // Persistent scope banner so a row of zeros never reads as a product failure.
  html += '<div class="hint-banner">These count only visitors who arrive with a Google Ads gclid and grant ad consent. The Ad Grant is paused, so ~0 here is expected and correct, not a funnel failure. Organic and Spotify traffic never appears in this section.</div>';
  html += '<div class="grid">';
  html += kpi('Start Exploring', startExpConv, { hero: true, spark: sparkStartExp, sparkColor: '#5B8BD4', delta: startExpPrev, sub: 'opted-in ad visitor accepted the consent prompt or clicked a Start Exploring CTA' });
  html += kpi('Profile Conversions', profileConv, { spark: sparkProfile, sparkColor: '#68C397', delta: profilePrev, sub: 'Enter button after character + name picked' });
  html += kpi('Mode Selected', modeSelConv, { spark: sparkModeSel, sparkColor: '#E6BC5C', sub: 'first mode pick (Story / Wisdom / Talk / Quest / Freetalk)' });
  html += kpi('Council Engaged', councilEngagedConv, { spark: sparkCouncilEng, sparkColor: '#9D83CD', sub: '60s of a council heard (curated or custom)' });
  html += kpi('Modes / Profile', modeFromProfile, { sub: modeFromProfile === '--' ? 'within ad visitors (need 5+ profiles)' : 'modes picked per ad-profile' });

  if (modeByFigure.length > 0) {
    html += chartCard('Top Figures by Engagement', barsHtml(modeByFigure.map(function(r) { return { label: cap(r.figure), c: r.c }; }), '#E6BC5C'), 'card-wide');
  }
  html += '</div>';

  // Instrumentation health — demoted from the old all-green status board (which
  // read as failure next to a row of zeros) to one quiet line. The plumbing
  // being wired says nothing about whether anyone converted.
  html += '<div class="insight" style="padding:8px 2px 0">Instrumentation healthy: gclid capture, profile / mode / council events, the CF worker, and Google Ads CAPI forwarding are all wired.</div>';

  // ── TRAFFIC (mixed sources) ──
  html += '<div class="section-divider">Traffic (mixed sources)</div>';
  html += '<div class="grid">';
  html += kpi('Raw Visits', visits, { hero: true, delta: visitsPrev, sub: 'page loads, mixed: ads + organic + bots' });
  html += '<div class="card card-wide"><div class="kpi-label">No source split, by design</div><div style="margin-top:8px;font-size:0.8125rem;color:var(--tx2);line-height:1.5">We deliberately do not record where a visit came from (no utm tags, no referrer profiling), so this stays inside the no-tracking, no-profiling promise. Channel performance is judged on each platform\\'s own console (Google Ads, Search Console, Spotify, Reddit), not here. This view shows volume and geography only.</div></div>';
  var countryAllItems = aggregateByLabel(topCountriesAll.map(function(r) { return { label: r.country || 'Unknown', c: r.c }; }));
  html += chartCard('Top Countries (all visits)', barsHtml(countryAllItems, '#9B7BC7'), 'card-wide');
  var countryChatItems = aggregateByLabel(topCountriesChat.map(function(r) { return { label: r.country || 'Unknown', c: r.c }; }));
  html += chartCard('Top Countries (conversations)', barsHtml(countryChatItems, '#5B8BD4'), 'card-wide');
  html += '</div>';

  // ── CONTENT REACH ──
  html += '<div class="section-divider">Content Reach</div>';
  html += '<div class="grid">';
  var playbackTypeItems = aggregateByLabel(playbackByType.map(function(r) { return { label: r.type || 'unknown', c: r.c }; }));
  html += chartCard('Content Completions by Type', barsHtml(playbackTypeItems, '#68C397'), 'card-wide');
  html += '</div>';

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
  else if (tab === 'audio') loadAudio();
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
  if (['overview', 'servers', 'product', 'audio', 'adgrants'].indexOf(hash) >= 0) {
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
    if (h && h !== S.tab && ['overview', 'servers', 'product', 'audio', 'adgrants'].indexOf(h) >= 0) {
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
