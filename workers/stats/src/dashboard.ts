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
  --src-direct: var(--tx2);
  --src-search: var(--s-prism);
  --src-ads: var(--gold);
  --src-forum: var(--err);
  --src-social: var(--s-wisdom);
  --src-other: var(--ok);
  --src-inside: color-mix(in srgb, var(--dim) 45%, transparent);
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
  /* Grid items default to min-width:auto, so one wide nowrap table inside a
     card stretches the whole column and pushes the tab sideways on a phone.
     The table already scrolls inside .tbl-wrap, so let the card shrink. */
  min-width: 0;
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

/* === MUSEUM OF AGES TAB === */
/* The tab has its own three frames, so the period control stands down. */
body[data-tab="museum"] .sidebar-section,
body[data-tab="museum"] .mobile-range { display: none; }
.mus-note {
  font-size: 0.75rem; color: var(--dim); line-height: 1.5;
  margin: -6px 0 14px; max-width: 78ch;
}
#alerts-museum:not(:empty) { margin-bottom: 16px; }
.mus-block { margin-bottom: 14px; }
.mus-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; flex-wrap: wrap;
}
.mus-controls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.mus-btn, .mus-date {
  min-height: 44px; min-width: 44px; padding: 0 12px;
  font-family: inherit; font-size: 0.8125rem; font-weight: 500;
  border: 1px solid color-mix(in srgb, var(--gold-deep) 22%, transparent);
  border-radius: var(--radius-sm); background: var(--bg-primary);
  color: var(--tx2); cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.mus-date { color-scheme: dark; }
.mus-btn:hover, .mus-date:hover { border-color: var(--gold-deep); color: var(--gold); }
.mus-btn:focus-visible, .mus-date:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.mus-btn:disabled { opacity: 0.35; cursor: default; }
.mus-btn.active {
  background: color-mix(in srgb, var(--gold) 12%, transparent);
  border-color: var(--gold-deep); color: var(--gold);
}
.mus-line { font-size: 0.8125rem; color: var(--tx2); margin-top: 10px; }
.mus-line b { color: var(--gold); font-weight: 600; }
.mus-cap { font-size: 0.75rem; color: var(--dim); line-height: 1.5; margin-top: 10px; }
.mus-wide .bar-label { min-width: 132px; text-align: left; }
.mus-scroll { max-height: 300px; overflow-y: auto; }
.mus-num { text-align: right; font-variant-numeric: tabular-nums; }
.mus-na { color: var(--dim); }
td.mus-strong { color: var(--tx); font-weight: 600; }
/* Upright bars as boxes: the names under them keep their size at any width. */
.mus-bars { display: flex; align-items: stretch; gap: 3px; height: 190px; margin-top: 12px; padding-top: 18px; }
.mus-bar-col { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; }
.mus-bar-plot {
  flex: 1; width: 100%; display: flex; align-items: flex-end;
  border-bottom: 1px solid var(--bg-highlight);
}
.mus-bar { position: relative; width: 100%; min-height: 1px; border-radius: 3px 3px 0 0; opacity: 0.85; }
.mus-bar-n {
  position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
  padding-bottom: 3px; font-size: 0.6875rem; color: var(--tx2); white-space: nowrap;
}
.mus-bar-x { font-size: 0.6875rem; color: var(--dim); margin-top: 5px; white-space: nowrap; }
@media (max-width: 640px) {
  body[data-tab="museum"] #tab-museum { padding-top: 12px; }
  .mus-wide .bar-label { min-width: 112px; }
  .mus-controls { width: 100%; }
  .mus-date { flex: 1; }
  /* A table fits the screen: tighter cells, names and headings may wrap. */
  .mus-table { font-size: 0.75rem; }
  .mus-table th, .mus-table td { padding: 6px 5px; }
  .mus-table th, .mus-table td.mus-strong { white-space: normal; }
  .mus-wide-only { display: none; }
  .mus-bars { height: 150px; gap: 2px; }
  .mus-bars.tight .mus-bar-col:not(:nth-child(3n+1)) .mus-bar-x { visibility: hidden; }
}

/* === MUSEUM: NOW AND TRENDS === */
.mus-switch {
  display: inline-flex; margin: -4px 0 14px;
  border: 1px solid color-mix(in srgb, var(--gold-deep) 22%, transparent);
  border-radius: var(--radius-sm); overflow: hidden; background: var(--bg-primary);
}
.mus-view {
  min-height: 44px; min-width: 104px; padding: 0 18px;
  font-family: inherit; font-size: 0.8125rem; font-weight: 500;
  color: var(--dim); background: none; border: none; cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}
.mus-view + .mus-view { border-left: 1px solid color-mix(in srgb, var(--gold-deep) 22%, transparent); }
.mus-view:hover { color: var(--tx2); }
.mus-view.active { color: var(--gold); background: color-mix(in srgb, var(--gold) 10%, transparent); border-bottom-color: var(--gold); }
.mus-view:focus-visible { outline: 2px solid var(--gold); outline-offset: -2px; }
#trends-museum { display: none; }
#tab-museum[data-view="trends"] #trends-museum { display: block; }
#tab-museum[data-view="trends"] #alerts-museum,
#tab-museum[data-view="trends"] #top-museum,
#tab-museum[data-view="trends"] #hours-museum,
#tab-museum[data-view="trends"] #grid-museum { display: none; }
.tr-head { display: flex; align-items: center; gap: 10px 18px; flex-wrap: wrap; margin-bottom: 10px; }
.tr-reach { font-size: 0.75rem; color: var(--dim); line-height: 1.5; flex: 1 1 320px; }
.tr-marks { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 0.75rem; color: var(--tx2); margin: 4px 0 6px; }
.tr-mark-key { display: inline-flex; align-items: center; gap: 6px; }
.tr-num {
  width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
  border: 1px solid var(--s-prism); color: var(--s-prism);
  font-size: 0.625rem; font-weight: 600;
  display: inline-flex; align-items: center; justify-content: center;
}
.tr-grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-bottom: 14px; }
.tr-card .kpi-label { margin-bottom: 6px; }
.tr-chart { position: relative; width: 100%; margin-top: 6px; }
.tr-svg { display: block; overflow: visible; touch-action: pan-y; }
.tr-svg text { font-family: 'Space Grotesk', system-ui, sans-serif; font-size: 11px; fill: var(--dim); }
.tr-gridline { stroke: var(--bg-highlight); stroke-width: 1; }
.tr-gridline.dash { stroke-dasharray: 2 4; }
.tr-hatch { stroke: color-mix(in srgb, var(--bg-highlight) 80%, transparent); stroke-width: 2; }
.tr-none { opacity: 0.35; }
.tr-svg text.tr-gone-lbl { font-size: 10.5px; fill: var(--tx2); }
.tr-bar { fill: color-mix(in srgb, var(--gold-subtle) 34%, transparent); }
.tr-bar.today { fill: color-mix(in srgb, var(--gold-subtle) 10%, transparent); stroke: color-mix(in srgb, var(--gold-subtle) 70%, transparent); stroke-dasharray: 2 2; }
.tr-avg { fill: none; stroke: var(--gold); stroke-width: 2.25; stroke-linejoin: round; stroke-linecap: round; }
.tr-avg.thin { stroke-width: 1.5; stroke-dasharray: 3 3; opacity: 0.8; }
.tr-pt { fill: var(--gold); }
.tr-pt.low { fill: var(--bg-card); stroke: var(--dim); stroke-width: 1.25; }
.tr-pt.today { opacity: 0.55; }
.tr-rate { fill: none; stroke: var(--gold); stroke-width: 2; stroke-linejoin: round; }
.tr-mark { stroke: var(--s-prism); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.75; }
.tr-mark-dot { fill: var(--bg-card); stroke: var(--s-prism); }
.tr-svg text.tr-mark-n { fill: var(--s-prism); font-size: 9.5px; font-weight: 600; }
.tr-aim { stroke: var(--ok); stroke-width: 1.25; stroke-dasharray: 6 4; }
.tr-svg text.tr-aim-lbl { fill: var(--ok); font-size: 10.5px; }
.tr-step { fill: none; stroke: var(--gold); stroke-width: 2; stroke-linejoin: round; }
.tr-step-ghost { fill: color-mix(in srgb, var(--gold-deep) 22%, transparent); }
.tr-svg text.tr-stack-n { fill: var(--tx2); font-size: 10.5px; }
.tr-guide { stroke: var(--tx2); stroke-width: 1; opacity: 0; pointer-events: none; }
.tr-guide.on { opacity: 0.45; }
.tr-hit { fill: transparent; cursor: crosshair; }
.tr-src-direct { fill: var(--src-direct); } .tr-src-search { fill: var(--src-search); } .tr-src-ads { fill: var(--src-ads); }
.tr-src-forum { fill: var(--src-forum); } .tr-src-social { fill: var(--src-social); } .tr-src-other { fill: var(--src-other); }
.tr-src-inside { fill: var(--src-inside); }
.tr-svg rect.part { opacity: 0.45; }
.tr-sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
.tr-sw-direct { background: var(--src-direct); } .tr-sw-search { background: var(--src-search); } .tr-sw-ads { background: var(--src-ads); }
.tr-sw-forum { background: var(--src-forum); } .tr-sw-social { background: var(--src-social); } .tr-sw-other { background: var(--src-other); }
.tr-sw-inside { background: var(--src-inside); }
.tr-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 0.75rem; color: var(--tx2); margin-top: 10px; }
.graph-tooltip.tr-tip { position: fixed; white-space: normal; max-width: 260px; line-height: 1.45; font-size: 0.75rem; padding: 6px 9px; z-index: 200; }
.tr-tip b { color: var(--gold); font-weight: 600; }
.tr-tip-mark { color: var(--s-prism); }
.tr-wow { font-size: 0.8125rem; color: var(--tx2); margin-top: 8px; line-height: 1.5; }
.tr-wow b { color: var(--gold); font-weight: 600; }
.tr-wow .kpi-delta { font-size: 0.75rem; }
.tr-multi { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px 18px; margin-top: 12px; }
.tr-panel { min-width: 0; }
.tr-panel-head { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; font-size: 0.75rem; }
.tr-panel-name { color: var(--tx); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tr-panel-fig { color: var(--dim); white-space: nowrap; }
.tr-panel-fig .kpi-delta { font-size: 0.6875rem; }
.tr-rates { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
.tr-lists { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 28px; margin-top: 16px; align-items: start; }
.tr-card.card-full { margin-bottom: 14px; }
.tr-svg text.tr-aim-lbl, .tr-svg text.tr-gone-lbl, .tr-svg text.tr-stack-n { paint-order: stroke; stroke: var(--bg-card); stroke-width: 3px; stroke-linejoin: round; }
.tr-mark-lead { stroke: var(--s-prism); stroke-width: 1; opacity: 0.75; }
.tr-clip { fill: none; stroke: var(--tx); stroke-width: 1.5; }
.tr-index { display: flex; flex-direction: column; }
.tr-row {
  display: grid; grid-template-columns: minmax(0, 1.7fr) 1fr 1fr 1fr; align-items: center; gap: 8px;
  min-height: 44px; padding: 0 10px; width: 100%;
  font-family: inherit; font-size: 0.8125rem; color: var(--tx2); text-align: left;
  background: none; border: none; border-left: 3px solid transparent;
  border-bottom: 1px solid color-mix(in srgb, var(--bg-highlight) 40%, transparent);
  cursor: pointer;
}
.tr-row:hover { background: var(--bg-highlight); }
.tr-row.active { border-left-color: var(--gold); background: color-mix(in srgb, var(--gold) 8%, transparent); color: var(--gold); }
.tr-row:focus-visible { outline: 2px solid var(--gold); outline-offset: -2px; }
.tr-row-head { cursor: default; min-height: 32px; font-size: 0.6875rem; color: var(--dim); border-bottom-color: var(--bg-highlight); }
.tr-row-head:hover { background: none; }
.tr-row-head span:not(:first-child) { text-align: right; }
.tr-row-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.2; }
.tr-row-name small { display: block; font-size: 0.625rem; color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tr-ghost .fbar-labelwrap { min-width: 120px; }
@media (max-width: 1024px) {
  .tr-multi { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tr-rates { grid-template-columns: 1fr; }
  .tr-lists { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  /* The switch stays in reach while the tab scrolls, as the phone's tab bar does. */
  .mus-switch {
    display: flex; position: sticky; top: 0; z-index: 10;
    margin: 0 -12px 12px; border: none; border-radius: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--gold-deep) 15%, transparent);
    background: var(--bg-primary);
  }
  .mus-view { flex: 1; min-width: 0; }
  .tr-grid2 { grid-template-columns: 1fr; }
  .tr-multi { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 12px; }
  .tr-panel-head { flex-direction: column; align-items: flex-start; gap: 0; }
  .tr-row { grid-template-columns: minmax(0, 1.6fr) 1fr 1fr; padding: 0 6px; font-size: 0.75rem; }
  .tr-wide { display: none; }
  .tr-ghost .fbar-labelwrap { min-width: 92px; }
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
    <button class="nav-item" data-tab="adgrants">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><line x1="12" y1="6" x2="12" y2="18"/><path d="M5 21h14"/></svg>
      <span class="nav-label">Growth</span>
    </button>
    <button class="nav-item" data-tab="product">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      <span class="nav-label">Engagement</span>
    </button>
    <button class="nav-item" data-tab="audio">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h3l3-9 4 18 3-9h5"/></svg>
      <span class="nav-label">Audio</span>
    </button>
    <button class="nav-item" data-tab="servers">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></svg>
      <span class="nav-label">Servers</span>
    </button>
    <button class="nav-item" data-tab="museum">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M4 10h16"/><path d="M12 3l8 7H4z"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/></svg>
      <span class="nav-label">Museum</span>
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
    <span class="tab-updated" id="updated-adgrants"></span>
  </div>
  <div id="alerts-adgrants" class="alerts"></div>
  <div id="grid-adgrants"></div>
</section>

<!-- Tab: Museum of Ages (Cloudflare's own totals for the museum's zone) -->
<section class="tab-section" id="tab-museum" aria-labelledby="title-museum">
  <div class="tab-header">
    <h2 class="tab-title" id="title-museum">Museum of Ages</h2>
    <span class="tab-updated" id="updated-museum"></span>
  </div>
  <div class="mus-switch" role="tablist" aria-label="Museum view">
    <button class="mus-view active" role="tab" data-mus-view="now" aria-selected="true">Now</button>
    <button class="mus-view" role="tab" data-mus-view="trends" aria-selected="false">Trends</button>
  </div>
  <div id="alerts-museum"></div>
  <div id="top-museum">
    <div class="grid">
      <div class="card card-hero"><div class="skel-label skeleton"></div><div class="skel-value skeleton"></div><div class="skel-sub skeleton"></div></div>
      <div class="card card-hero"><div class="skel-label skeleton"></div><div class="skel-value skeleton"></div><div class="skel-sub skeleton"></div></div>
      <div class="card"><div class="skel-label skeleton"></div><div class="skel-value skeleton"></div><div class="skel-sub skeleton"></div></div>
    </div>
  </div>
  <div id="hours-museum"></div>
  <div id="grid-museum"></div>
  <div id="trends-museum"></div>
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
  <button class="mob-tab" data-tab="adgrants">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="17 11 12 6 7 11"/><line x1="12" y1="6" x2="12" y2="18"/><path d="M5 21h14"/></svg>
    Growth
  </button>
  <button class="mob-tab" data-tab="product">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
    Engagement
  </button>
  <button class="mob-tab" data-tab="audio">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 12h3l3-9 4 18 3-9h5"/></svg>
    Audio
  </button>
  <button class="mob-tab" data-tab="servers">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></svg>
    Servers
  </button>
  <button class="mob-tab" data-tab="museum">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 21h18"/><path d="M4 10h16"/><path d="M12 3l8 7H4z"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/></svg>
    Museum
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
  rl: { daily_limit: '#F5A623', burst_limit: '#9D83CD', daily: '#F5A623', global: '#E97451', council: '#5B8BD4', summary: '#E6BC5C' },
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

// The engaged-session beacon (North Star v2) and the listening lifecycle went
// live on this date. Any window reaching further back holds no rows for them,
// so the series is partial there and a previous-period delta against a window
// that predates the beacon would read as growth from zero.
const NS2_LIVE_DATE = '2026-09-01';
const NS2_LIVE_MS = Date.parse(NS2_LIVE_DATE + 'T00:00:00Z');

// Rows whose in-house probe marker is set are the owner's own testing. The
// events carrying this marker (engaged, playback, page, paid_arrival) are
// filtered on it here, matching internal/ops/stats-pull.mjs exactly so the
// dashboard and the Monday pull can never disagree. The older counters on the
// same tabs predate the filter and are NOT deflated, so the two are not
// directly comparable.
const NOT_PROBE = "blob9 != 'probe'";

// Coarse listened-time buckets (double1 on a terminal playback row). Index 0
// is 0-14s, which the ex-zero filter cannot separate from an unwritten slot,
// so it never appears. Same six labels as the Monday pull.
const LISTEN_BUCKET_LABELS = ['under 15s', '15-59s', '1-3m', '3-10m', '10-30m', '30m+'];

// Spend-governor events, in escalation order. The threshold pair is written
// once per day at the first crossing, so those two counters read as days. The
// fallback pair is one row per request that moved to the standby model.
const GOVERNOR_EVENTS = [
  { key: 'soft_alert', label: 'Soft Alerts', one: 'Soft alert', sub: 'days the warning line was crossed', tone: 'var(--warn)' },
  { key: 'hard_trip', label: 'Hard Trips', one: 'Hard trip', sub: 'days the cap moved traffic to the standby', tone: 'var(--err)' },
  { key: 'fallback_error', label: 'Fallback on Error', one: 'Fallback on error', sub: 'requests the primary could not serve', tone: 'var(--err)' },
  { key: 'fallback_latency', label: 'Fallback on Latency', one: 'Fallback on latency', sub: 'requests the primary was too slow for', tone: 'var(--warn)' },
];

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

// Labels can carry client-supplied strings (figure ids from beacon payloads),
// so every interpolation into chart/table HTML goes through this.
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(ch) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
  });
}

function modeLabel(m) { return MODE_LABELS[m] || cap(m); }

function tier(p) { return p >= 90 ? 'err' : p >= 75 ? 'warn' : 'ok'; }
// Worst (most severe) tier across a set of resource percentages. A composite
// health verdict must be the worst of gpu/vram/cpu/ram/disk, never gpu alone.
function worstTier(ps) { var o = { ok: 0, warn: 1, err: 2 }; var w = 'ok'; for (var i = 0; i < ps.length; i++) { var tt = tier(Number(ps[i]) || 0); if (o[tt] > o[w]) w = tt; } return w; }

function now() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

// Analytics Engine hands back a naive UTC stamp ("2026-09-03 12:34:56"), which
// a browser reads as local time unless the Z is stamped on first.
function aeTime(raw) {
  var s = String(raw || '');
  if (!s) return 'unknown time';
  var d = new Date(s.indexOf('Z') < 0 ? s.replace(' ', 'T') + 'Z' : s);
  if (isNaN(d.getTime())) return esc(s);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function governorLabel(key) {
  for (var i = 0; i < GOVERNOR_EVENTS.length; i++) {
    if (GOVERNOR_EVENTS[i].key === key) return GOVERNOR_EVENTS[i].one;
  }
  return key || 'unlabelled';
}

function iv() { return String(S.range); }

// Sparkline: monotone cubic interpolation
function sparkSvg(pts, w, h, color) {
  if (!pts || pts.length < 2) return '';
  const gid = 'sg' + (S.__sg = (S.__sg || 0) + 1);
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
    '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + color + '" stop-opacity="0.25"/><stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + areaD + '" fill="url(#' + gid + ')"/>' +
    '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round"/>' +
    '</svg>';
}

// Delta HTML. At single-digit scale a percentage off a tiny base is Poisson
// noise (1 -> 0 reads as a terrifying -100%), so below a small base we show the
// absolute change only, never a dramatic colored percent.
// 'invert' flips the colour for counters where up is the bad direction (a rising
// fallback count must never render green), same rule as rateCard: the arrow
// follows the sign, the colour follows whether the move is good.
function deltaHtml(cur, prev, invert) {
  if (prev == null || (prev === 0 && cur === 0)) return '<span class="kpi-delta flat">-</span>';
  const diff = cur - prev;
  if (diff === 0) return '<span class="kpi-delta flat">~0</span>';
  const cls = (invert ? diff < 0 : diff > 0) ? 'up' : 'down';
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
    msg = 'Lots of visits, few signups. That is the cold ad traffic, which converts near zero by nature. Judge it as awareness, not acquisition, and do not buy more cold clicks.';
  } else if (signups === 0 && chats > 0) {
    msg = 'Conversations are happening but no new signups this period. Returning or existing users, not new acquisition. The gap is getting new people in, not the product.';
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
  const deltaStr = opts.delta !== undefined ? deltaHtml(value, opts.delta, opts.deltaInvert) : '';
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
// { label, value, prev, sub, pending }; population-level only, no per-visitor
// key. 'pending' (optional) names the stage's event: while that event has zero
// rows in both periods (its beacon may not be deployed yet), the stage shows a
// graceful-degrade "awaiting first <event>" placeholder, and the arrows either
// side stay flat so the gap never reads as a real 100% drop.
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
    var isPending = !!s.pending && v === 0 && (pv == null || pv === 0);
    if (isPending) {
      out += '<div class="fbar-row" role="listitem">' +
        '<span class="fbar-labelwrap"><span class="fbar-label">' + s.label + '</span>' +
        '<span class="fbar-sub2">awaiting first ' + s.pending + '</span></span>' +
        '<div class="fbar-track"></div>' +
        '<span class="fbar-num"><span class="fbar-val">--</span></span>' +
        '</div>';
    } else {
    var wv = (v / base * 100);
    var ghost = (pv == null) ? '' : '<div class="fbar-ghost" style="width:' + (pv / base * 100).toFixed(1) + '%"></div>';
    var sub2 = s.sub ? '<span class="fbar-sub2">' + s.sub + '</span>' : '';
    out += '<div class="fbar-row" role="listitem">' +
      '<span class="fbar-labelwrap"><span class="fbar-label">' + s.label + '</span>' + sub2 + '</span>' +
      '<div class="fbar-track">' + ghost + '<div class="fbar-fill" style="width:' + wv.toFixed(1) + '%"></div></div>' +
      '<span class="fbar-num"><span class="fbar-val">' + fmt(v) + '</span>' + (pv == null ? '' : deltaHtml(v, pv)) + '</span>' +
      '</div>';
    }
    if (i < stages.length - 1) {
      var next = stages[i + 1];
      var nv = Number(next.value) || 0;
      var npvPeek = (next.prev == null) ? null : (Number(next.prev) || 0);
      var nextPending = !!next.pending && nv === 0 && (npvPeek == null || npvPeek === 0);
      var dropText;
      if (isPending || nextPending) {
        // Either side of this arrow is awaiting its first event. A "0%" here
        // would claim a drop for a counter that does not exist yet.
        dropText = '—';
      } else if (v <= 0) {
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
      // The arrow always follows the sign, the colour follows whether the move
      // is good. opts.invert flips the colour for rates where up is the bad
      // direction (a rising dismiss share must never render green).
      var cls = (opts.invert ? pp < 0 : pp > 0) ? 'up' : 'down';
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

// Depth ladder: rungs on one shared axis so their relative size reads at a
// glance, each with a previous-period ghost bar, a sparkline and a delta.
// Deliberately NOT ghostFunnelHtml: these rungs are depths, not gates. Listened
// happens on the marketing pages while the dialogue events happen in the app,
// so a between-rung conversion percentage would claim a sequence that does not
// exist. The one true subset relation belongs in the caption, as a sentence.
// Rungs are { label, value, prev, sub, spark, sparkColor, pending }; 'pending'
// works exactly as in ghostFunnelHtml (zero rows in both periods means the
// beacon has produced nothing yet, so the rung says so instead of drawing an
// empty bar that reads as failure).
function ladderHtml(rungs, ariaLabel) {
  if (!rungs || rungs.length === 0) return '';
  var base = 1;
  for (var k = 0; k < rungs.length; k++) {
    base = Math.max(base, Number(rungs[k].value) || 0, Number(rungs[k].prev) || 0);
  }
  var out = '<div class="fbar-list" role="list" aria-label="' + (ariaLabel || 'Ad engagement ladder') + '">';
  for (var i = 0; i < rungs.length; i++) {
    var s = rungs[i];
    var v = Number(s.value) || 0;
    var pv = (s.prev == null) ? null : (Number(s.prev) || 0);
    var labelWrap = '<span class="fbar-labelwrap"><span class="fbar-label">' + s.label + '</span>' +
      (s.sub ? '<span class="fbar-sub2">' + s.sub + '</span>' : '') + '</span>';
    // The spark slot is reserved even when there is nothing to draw, so a rung
    // without a trend does not stretch its bar past the rung above. Reuses
    // .kpi-spark, which already hides itself under 640px.
    var sparkHtml = '<span class="kpi-spark" style="width:64px">' +
      ((s.spark && s.spark.length > 1) ? sparkSvg(s.spark, 64, 24, s.sparkColor || '#D4A539') : '') +
      '</span>';
    if (s.pending && v === 0 && (pv == null || pv === 0)) {
      // The beacon has produced nothing in either period. The note sits inside
      // the empty track rather than in the value column, so a long event name
      // cannot push this row's bar out of line with the rungs above it.
      out += '<div class="fbar-row" role="listitem" style="margin:3px 0">' + labelWrap +
        '<div class="fbar-track"><span style="position:absolute;left:10px;top:0;line-height:30px;font-size:0.6875rem;color:var(--dim)">awaiting first ' + s.pending + '</span></div>' +
        '<span class="kpi-spark" style="width:64px"></span>' +
        '<span class="fbar-num"><span class="fbar-val">--</span></span>' +
        '</div>';
      continue;
    }
    var ghost = (pv == null) ? '' : '<div class="fbar-ghost" style="width:' + (pv / base * 100).toFixed(1) + '%"></div>';
    out += '<div class="fbar-row" role="listitem" style="margin:3px 0">' + labelWrap +
      '<div class="fbar-track">' + ghost + '<div class="fbar-fill" style="width:' + (v / base * 100).toFixed(1) + '%"></div></div>' +
      sparkHtml +
      '<span class="fbar-num"><span class="fbar-val">' + fmt(v) + '</span>' + (pv == null ? '' : deltaHtml(v, pv)) + '</span>' +
      '</div>';
  }
  return out + '</div>';
}

function chartCard(title, body, cls) {
  return '<div class="card ' + (cls || '') + '"><div class="kpi-label" style="margin-bottom:6px">' + title + '</div>' + body + '</div>';
}

// Strip a page path to a short readable label ("aurelius (de)" not
// "/de/figures/marcus-aurelius/"). No regex: TS template literals eat regex
// escape sequences, so this uses plain string methods only. Distinguishes
// EN/DE with a "(de)" suffix, marks theme pages with a leading tilde and
// labels the index pages explicitly. Shared by Top Marketing Pages and the
// consent-by-page table so a path reads the same wherever it appears (and so
// no card is forced wide by a full path on a 390px screen).
function pathLabel(raw) {
  raw = String(raw || '');
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
  return isDe ? label + ' (de)' : label;
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
    html += '<div class="bar-row"><span class="bar-label">' + esc(row.label) + '</span>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + w.toFixed(1) + '%;background:' + (row.color || color) + '"></div></div>' +
      '<span class="bar-val">' + fmt(row.c) + '</span></div>';
  });
  return html + '</div>';
}

// Device: visit-share vs conversation-share per class. Two absolute bar charts
// could not answer "does mobile underconvert" without cross-chart math; this
// puts both shares on one row so a gap is visible at a glance. Small-base
// guarded, and the conversation side is message-weighted (one chatty desktop
// user skews it), so both caveats are captioned.
function deviceShareHtml(arrivals, chats, opts) {
  opts = opts || {};
  var floor = opts.floor || 20;
  var aTot = (arrivals || []).reduce(function(s, r) { return s + Number(r.c); }, 0);
  var cTot = (chats || []).reduce(function(s, r) { return s + Number(r.c); }, 0);
  if (aTot < floor) {
    return '<div class="card card-wide"><div class="kpi-label">Device: visit share vs conversation share</div><div class="empty-state">Needs 20+ device-tagged visits. Tagging shipped 2026-07-07, so short ranges and any range before then read low.</div></div>';
  }
  var aMap = {}, cMap = {};
  (arrivals || []).forEach(function(r) { if (r.device) aMap[r.device] = Number(r.c); });
  (chats || []).forEach(function(r) { if (r.device) cMap[r.device] = Number(r.c); });
  var classes = ['desktop', 'mobile', 'tablet'].filter(function(d) { return aMap[d] || cMap[d]; });
  var chatShown = cTot >= floor;
  var rowsHtml = classes.map(function(d) {
    var aPct = Math.round((aMap[d] || 0) / aTot * 100);
    var cPct = chatShown ? Math.round((cMap[d] || 0) / cTot * 100) : null;
    var color = d === 'mobile' ? 'var(--s-quest)' : d === 'tablet' ? 'var(--s-story)' : 'var(--s-prism)';
    // Underconversion flag: a device that pulls real visit share but a much
    // smaller conversation share is the mobile-UX signal we shipped this for.
    var flag = (cPct != null && aPct >= 15 && cPct <= aPct - 10)
      ? ' <span style="color:var(--warn);font-weight:600">underconverts</span>' : '';
    var visBar = '<div style="height:6px;border-radius:3px;background:var(--bg-highlight);overflow:hidden;margin:2px 0"><div style="height:100%;width:' + aPct + '%;background:' + color + ';opacity:0.55"></div></div>';
    var chatBar = cPct == null ? '' : '<div style="height:6px;border-radius:3px;background:var(--bg-highlight);overflow:hidden"><div style="height:100%;width:' + cPct + '%;background:' + color + '"></div></div>';
    return '<div style="margin:10px 0">' +
      '<div style="display:flex;justify-content:space-between;font-size:0.8125rem;color:var(--tx)"><span>' + cap(d) + flag + '</span>' +
      '<span style="color:var(--tx2)">' + aPct + '% visits &rarr; ' + (cPct == null ? '--' : cPct + '% conv') + '</span></div>' +
      visBar + chatBar + '</div>';
  }).join('');
  var caption = '<div class="kpi-sub" style="margin-top:6px">Device tagging since 2026-07-07 (older rows untagged). ' +
    (chatShown ? 'Conversation share is message-weighted, so one chatty user skews it.' : 'Conversation share hidden until 20+ tagged conversations.') + '</div>';
  return '<div class="card card-wide"><div class="kpi-label">Device: visit share vs conversation share</div>' + rowsHtml + caption + '</div>';
}

// Table HTML
function tableHtml(headers, rows) {
  if (!rows || rows.length === 0) return '<div class="empty-state">No data for this period</div>';
  let html = '<div class="tbl-wrap"><table><tr>';
  headers.forEach(function(h) { html += '<th>' + h + '</th>'; });
  html += '</tr>';
  rows.forEach(function(r) {
    html += '<tr>';
    // Cells may carry intentional markup (styled spans); callers escape any
    // client-supplied value before embedding it.
    r.forEach(function(cell) { html += '<td>' + cell + '</td>'; });
    html += '</tr>';
  });
  return html + '</table></div>';
}

// Unified Figures table: Picks (figure_selected) -> Chats (chat rows) ->
// Completions (playback completed), joined by figure key. Replaces the four
// scattered figure leaderboards so pick-to-chat-to-completion reads on one row.
function figuresTableHtml(picks, chats, completions) {
  var m = {};
  function add(rowsArr, key) {
    (rowsArr || []).forEach(function(r) {
      var f = r.figure; if (!f) return;
      if (!m[f]) m[f] = { figure: f, picks: 0, chats: 0, comps: 0 };
      m[f][key] = Number(r.c);
    });
  }
  add(picks, 'picks'); add(chats, 'chats'); add(completions, 'comps');
  var arr = Object.keys(m).map(function(k) { return m[k]; });
  if (arr.length === 0) return '<div class="empty-state">No figure activity for this period</div>';
  arr.sort(function(a, b) { return (b.picks + b.chats) - (a.picks + a.chats); });
  var rowsHtml = arr.slice(0, 12).map(function(x) {
    return [esc(cap(x.figure)), fmt(x.picks), fmt(x.chats), fmt(x.comps)];
  });
  return tableHtml(['Figure', 'Picks', 'Chats', 'Completions'], rowsHtml);
}

// Listening leaderboard: starts joined to audio finishes on one dimension
// (figure or chapter). Two independent counters, so the join happens here
// rather than in SQL. The finish rate follows the same small-base rule as
// everywhere else, and a row whose dimension slot is empty is named for what
// it is (a row written before the label shipped) instead of being dropped or
// silently read as a zero ordinal.
function listenTableHtml(dimLabel, startRows, finishRows, key, labelFn, emptyLabel) {
  var starts = byKey(startRows, key, emptyLabel);
  var finishes = byKey(finishRows, key, emptyLabel);
  var keys = Object.keys(starts);
  Object.keys(finishes).forEach(function(k) { if (keys.indexOf(k) < 0) keys.push(k); });
  if (keys.length === 0) return '<div class="empty-state">No listening rows for this period</div>';
  // Most-started first, with the unlabelled bucket pinned last so it never
  // heads a ranking it is not part of.
  keys.sort(function(a, b) {
    if (a === emptyLabel) return 1;
    if (b === emptyLabel) return -1;
    return (starts[b] || 0) - (starts[a] || 0);
  });
  // With no finish rows anywhere in the table the finish counter has produced
  // nothing yet, and a 0% per row would claim nobody finished. Blank the whole
  // rate column instead until the first finish lands.
  var anyFinish = Object.keys(finishes).some(function(k) { return (finishes[k] || 0) > 0; });
  var body = keys.slice(0, 14).map(function(k) {
    var s = starts[k] || 0;
    var f = finishes[k] || 0;
    return [esc(labelFn ? labelFn(k) : k), fmt(s), fmt(f), anyFinish ? shareText(f, s) : '--'];
  });
  return tableHtml([dimLabel, 'Starts', 'Finished', 'Finish rate'], body);
}

// Interior zero-fill for time-bucketed GROUP BY rows. Analytics Engine omits
// empty buckets, so a real zero day/hour (a zero-chat day on the North Star
// trend) silently vanishes and the line bridges it. This inserts the missing
// buckets as c:0, inferring bucket size from the smallest gap between present
// buckets. Interior gaps only (leading/trailing need a server clock we do not
// have here), which is exactly the vanishing-middle-day case.
function zeroFill(rows) {
  if (!rows || rows.length < 2) return rows || [];
  var pts = rows.map(function(r) { return { t: new Date(r.t).getTime(), raw: r }; })
    .filter(function(p) { return !isNaN(p.t); })
    .sort(function(a, b) { return a.t - b.t; });
  if (pts.length < 2) return rows;
  var step = Infinity;
  for (var i = 1; i < pts.length; i++) { var d = pts[i].t - pts[i - 1].t; if (d > 0 && d < step) step = d; }
  if (!isFinite(step) || step <= 0) return rows.slice();
  var out = [];
  for (var j = 0; j < pts.length; j++) {
    if (j > 0) {
      var missing = Math.round((pts[j].t - pts[j - 1].t) / step) - 1;
      if (missing > 0 && missing < 1000) {
        for (var k = 1; k <= missing; k++) out.push({ t: new Date(pts[j - 1].t + k * step).toISOString(), c: 0 });
      }
    }
    out.push(pts[j].raw);
  }
  return out;
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
  if (opts.line2 && opts.line2.values && opts.line2.values.length) {
    var l2max = Math.max.apply(null, opts.line2.values.map(Number));
    if (l2max > maxVal) maxVal = l2max;
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

  // Optional second solid series (e.g. Completed drawn over Started), same yMax.
  if (opts.line2 && opts.line2.values && opts.line2.values.length >= 2) {
    var l2 = opts.line2.values.map(Number);
    var l2n = l2.length;
    var l2Path = '';
    for (var li = 0; li < l2n; li++) {
      var lx = padL + (li / (l2n - 1)) * plotW;
      var ly = padT + plotH - (l2[li] / yMax) * plotH;
      l2Path += (li === 0 ? 'M' : ' L') + lx.toFixed(1) + ',' + ly.toFixed(1);
    }
    svg += '<path d="' + l2Path + '" fill="none" stroke="' + (opts.line2.color || '#68C397') + '" stroke-width="1.75" opacity="0.9"/>';
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

// How much of the selected window the 2026-09-01 beacons actually cover.
// 'partial' means the window reaches back before they existed, so the count is
// a floor. 'prevUsable' means the previous period overlaps them at all: when it
// does not, the delta is suppressed rather than printed as growth from zero.
function ns2Coverage() {
  var day = 86400000;
  var end = Date.now();
  var start = end - S.range * day;
  return {
    partial: start < NS2_LIVE_MS,
    coveredDays: Math.max(0, end - Math.max(start, NS2_LIVE_MS)) / day,
    prevUsable: start > NS2_LIVE_MS,
  };
}

// Group rows into { label: count }. Empty labels fall into the caller's chosen
// bucket name rather than colliding with a real value.
function byKey(list, field, emptyLabel) {
  var out = {};
  (list || []).forEach(function(row) {
    var k = row[field];
    if (k === '' || k == null) k = emptyLabel || 'untagged';
    out[k] = (out[k] || 0) + Number(row.c || 0);
  });
  return out;
}

// A share as text, with the same small-base rule the rest of the file uses: a
// percentage off fewer than 20 is Poisson noise, so print the raw fraction.
function shareText(num, den) {
  if (!den) return '--';
  if (den < 20) return fmt(num) + ' of ' + fmt(den);
  return Math.round(num / den * 100) + '%';
}

async function batch(queries) {
  try {
    const res = await fetch('/api/query-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: queries }),
    });
    if (!res.ok) { S.fetchError = true; return queries.map(function() { return { data: [] }; }); }
    const json = await res.json();
    S.fetchError = false;
    return json.results || queries.map(function() { return { data: [] }; });
  } catch (e) {
    S.fetchError = true;
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
      } else {
        // Composite health: the worst of gpu/cpu/ram/disk, not gpu alone (a
        // maxed disk or RAM used to ship silently green).
        var worstP = 0, worstName = '';
        [['GPU', s.gpu && s.gpu.utilization_percent],
         ['CPU', s.cpu && s.cpu.usage_percent],
         ['RAM', (s.ram && s.ram.total_gb > 0) ? (s.ram.used_gb / s.ram.total_gb * 100) : 0],
         ['Disk', s.disk && s.disk.usage_percent]].forEach(function(rr) {
          var p = Number(rr[1]) || 0;
          if (p > worstP) { worstP = p; worstName = rr[0]; }
        });
        if (worstP >= 90) { msgs.push(id.toUpperCase() + ' ' + worstName + ' high (' + Math.round(worstP) + '%)'); level = 'err'; }
        else if (worstP >= 75) { msgs.push(id.toUpperCase() + ' ' + worstName + ' elevated (' + Math.round(worstP) + '%)'); if (level !== 'err') level = 'warn'; }
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
    // --- Wave-1 funnel additions (APPENDED at the end; reads are positional,
    // so new queries must never be inserted mid-array). r[35..44]: one
    // current + previous pair per step, queried by blob1 like entry/signup.
    // Batch total after these: 45 of the 64 cap. ---
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'cta_click' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'cta_click' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'cinematic_start' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'cinematic_start' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'cinematic_end' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'cinematic_end' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'welcome_shown' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'welcome_shown' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'first_turn' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'first_turn' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    // --- Wave-2 first_reply additions (APPENDED at the end; reads are
    // positional, so new queries must never be inserted mid-array). r[45..48]:
    // success (blob5='200') current + previous for the funnel stage and its
    // ghost, error (blob5='error') current + previous for the reply-success
    // caption. Batch total after these: 49 of the 64 cap. ---
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'first_reply' AND blob5 = '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'first_reply' AND blob5 = '200' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'first_reply' AND blob5 = 'error' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'first_reply' AND blob5 = 'error' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    // --- Device split (blob6, live 2026-07-07). r[49..50], APPENDED at the end
    // so existing positional reads never shift. Arrivals + conversations by
    // device class, for the visit-share vs conversation-share card beside the
    // funnel (does mobile underconvert). Batch total after these: 51 of 64. ---
    { sql: "SELECT blob6 as device, COUNT() as c FROM agora_llm WHERE blob1 = 'page' AND blob6 != '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY device ORDER BY c DESC", dataset: 'agora_llm' },
    { sql: "SELECT blob6 as device, COUNT() as c FROM agora_llm WHERE blob1 IN ('chat','council','summary') AND blob5 = '200' AND blob6 != '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY device ORDER BY c DESC", dataset: 'agora_llm' },
    // --- North Star v2, engaged sessions (APPENDED at the end; reads are
    // positional, so new queries must never be inserted mid-array). r[51..53].
    // A tab that typed a first message or crossed the listening threshold emits
    // one row with its arm, then a second 'both' row if the other arm follows.
    // The session total is therefore typed + listened, never the raw row count.
    // Same SQL as internal/ops/stats-pull.mjs 'engaged_arms', probe filter
    // included, so the dashboard and the Monday pull cannot drift.
    // Batch total after these: 54 of the 64 cap. ---
    { sql: "SELECT blob3 as arm, COUNT() as c FROM agora_llm WHERE blob1 = 'engaged' AND " + NOT_PROBE + " AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY arm", dataset: 'agora_llm' },
    { sql: "SELECT blob3 as arm, COUNT() as c FROM agora_llm WHERE blob1 = 'engaged' AND " + NOT_PROBE + " AND timestamp " + prevRange() + " GROUP BY arm", dataset: 'agora_llm' },
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE blob1 = 'engaged' AND blob3 IN ('typed','listened') AND " + NOT_PROBE + " AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
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
  // Wave-1 funnel reads (appended queries r[35..44]).
  var ctaClicks = val(r[35]), ctaClicksPrev = val(r[36]);
  var cinStarts = val(r[37]), cinStartsPrev = val(r[38]);
  var cinEnds = val(r[39]), cinEndsPrev = val(r[40]);
  var welcomeShown = val(r[41]), welcomeShownPrev = val(r[42]);
  var firstTurns = val(r[43]), firstTurnsPrev = val(r[44]);
  // Wave-2 first_reply reads (appended queries r[45..48]). The funnel stage
  // counts successes only (an errored dispatch is not a reply the user got);
  // errors feed the reply-success caption under the funnel.
  var firstReplies = val(r[45]), firstRepliesPrev = val(r[46]);
  var firstReplyErrors = val(r[47]), firstReplyErrorsPrev = val(r[48]);
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
  // North Star v2 reads (appended queries r[51..53]). An engaged session is one
  // tab that did something: the first arm it reaches writes 'typed' or
  // 'listened', and only if the other arm follows does a second 'both' row
  // land. Summing typed + listened is therefore the session count; adding
  // 'both' would count the same tab twice.
  var engagedArms = byKey(rows(r[51]), 'arm', 'unlabelled');
  var engagedArmsPrev = byKey(rows(r[52]), 'arm', 'unlabelled');
  var engaged = (engagedArms.typed || 0) + (engagedArms.listened || 0);
  var engagedPrev = (engagedArmsPrev.typed || 0) + (engagedArmsPrev.listened || 0);
  var sparkEngaged = rows(r[53]).map(function(x) { return x.c; });
  var ns2 = ns2Coverage();
  // bouncePct/bounceSub removed with the Arrivals hero KPI — the metric mixed
  // marketing-page bounces and login-page bounces into a single misleading
  // percentage. Per-stage drop-off lives in the Funnel below.

  // Alerts
  var alerts = '';
  if (S.fetchError) alerts += '<div class="alert-card a-err">Stats API unreachable. The numbers below are stale or absent, not real zeros. Retry in a moment.</div>';
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
  if (!S.fetchError && S.range === 1 && chats < 3) {
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
  html += kpi('Conversations (v1)', chats, { hero: true, spark: sparkChats, sparkColor: '#5B8BD4', delta: chatsPrev, sub: 'real chat messages. the one that means it worked' });
  // NORTH STAR v2: engaged sessions, beside v1 rather than replacing it while
  // the two run in parallel. Signed definition (PRE-REG section 10): a tab that
  // sent a first message, or crossed the listening threshold of 120 seconds or
  // the first quarter, whichever came first.
  var engagedArmSub;
  if (engaged === 0) {
    engagedArmSub = 'no arm rows yet. live since ' + NS2_LIVE_DATE;
  } else {
    engagedArmSub = 'typed ' + fmt(engagedArms.typed || 0) + ', listened ' + fmt(engagedArms.listened || 0) +
      (engagedArms.both ? ', did both ' + fmt(engagedArms.both) : '') + '. live since ' + NS2_LIVE_DATE;
  }
  var engagedOpts = { hero: true, sub: engagedArmSub };
  if (sparkEngaged.length > 1) { engagedOpts.spark = sparkEngaged; engagedOpts.sparkColor = '#68C397'; }
  // A previous period that ends before the beacon existed holds structural
  // zeros, so no delta is shown against it.
  if (ns2.prevUsable) engagedOpts.delta = engagedPrev;
  html += kpi('Engaged Sessions (v2)', (engaged === 0 && engagedPrev === 0) ? '--' : engaged, engagedOpts);
  html += kpi('New Signups', signups, { hero: true, delta: signupsPrev, sub: 'genuinely new accounts' });
  html += kpi('Raw Visits', arrivals, { sub: 'mixed: ads + bots, no source split by design' });
  // Standing note on what the v2 number can and cannot mean yet. Partial-window
  // and no-previous-period cases are spelled out rather than left to the reader.
  var ns2Note = 'North Star v2 counts sessions, one row per tab per arm, and is probe filtered. ' +
    'Conversations (v1) counts chat messages and is not probe filtered, so the two are different populations and must not be divided into each other. ';
  if (ns2.partial) {
    ns2Note += 'The beacon went live ' + NS2_LIVE_DATE + ', so only about ' + Math.max(1, Math.round(ns2.coveredDays)) +
      ' of the ' + S.range + ' days in this window can hold a row. The count is a floor, not a trend. ';
  }
  if (!ns2.prevUsable) {
    ns2Note += 'The previous period ends before the beacon existed, so no delta is shown. A complete week over week read starts 2026-09-08.';
  }
  html += '<div class="hint-banner" style="grid-column:1/-1;margin-top:2px">' + ns2Note + '</div>';
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
  // Wave-1 stages carry a 'pending' event name: until that event has produced
  // a single row in either period (deploy lag, or simply pre-launch of the
  // beacon), the stage renders a quiet "awaiting first <event>" placeholder
  // instead of a zero bar, so the funnel never reads as a fake 100% cliff.
  var funnelStages = [
    { label: 'Marketing', value: marketingArrivals, prev: marketingArrivalsPrev, sub: 'figures · themes · about' },
    { label: 'CTA Click', value: ctaClicks, prev: ctaClicksPrev, sub: 'Start Exploring', pending: 'cta_click' },
    { label: 'App', value: appArrivals, prev: appArrivalsPrev, sub: '/app + SPA routes' },
    { label: 'Saw Intro', value: cinStarts, prev: cinStartsPrev, sub: 'cinematic started', pending: 'cinematic_start' },
    { label: 'Finished Intro', value: cinEnds, prev: cinEndsPrev, sub: 'watched or skipped', pending: 'cinematic_end' },
    { label: 'Welcome', value: welcomeShown, prev: welcomeShownPrev, sub: 'consent screen shown', pending: 'welcome_shown' },
    { label: 'Entry', value: entries, prev: entriesPrev, sub: 'consent + enter' },
    { label: 'Signup', value: signups, prev: signupsPrev, sub: 'new accounts' },
    { label: 'First Message', value: firstTurns, prev: firstTurnsPrev, sub: 'first chat turn, incl. BYOK', pending: 'first_turn' },
    { label: 'First Reply', value: firstReplies, prev: firstRepliesPrev, sub: 'assistant replied, incl. BYOK', pending: 'first_reply' },
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
  // Reply-success caption: first_reply 200 vs error, one quiet line under the
  // funnel. Same honesty rules as everywhere else: an "awaiting first" note
  // while the beacon has no rows in either period, raw counts (no %) under a
  // base of 20, a % only above it.
  var replyTotal = firstReplies + firstReplyErrors;
  var replyNote;
  if (replyTotal + firstRepliesPrev + firstReplyErrorsPrev === 0) {
    replyNote = 'Reply success: -- awaiting first first_reply.';
  } else if (replyTotal === 0) {
    replyNote = 'Reply success: no first replies ' + RANGE_LABEL[S.range] + '.';
  } else if (replyTotal < 20) {
    replyNote = 'Reply success: ' + firstReplies + ' of ' + replyTotal + ' first replies arrived' + (firstReplyErrors > 0 ? ', ' + firstReplyErrors + ' errored' : '') + ' (small base, raw counts).';
  } else {
    replyNote = 'Reply success: ' + Math.round(firstReplies / replyTotal * 100) + '% (' + firstReplies + ' of ' + replyTotal + ' first replies, ' + firstReplyErrors + ' errored).';
  }
  var funnelNote = '<div style="margin-top:8px;font-size:11px;color:var(--dim);line-height:1.4">' +
    'New-visitor funnel only, compared step by step against the previous ' + RANGE_LABEL[S.range] + ' (the faint bars). ' +
    'Entry &amp; Signup fire at the welcome modal (post-consent). ' +
    'Returning visitors skip it, so they appear only as App Sessions below, never here. ' +
    'Marketing = / and /de/ plus figure and theme pages (mixed sources, incl. ads + bots). App = /app. ' +
    replyNote +
    '</div>';
  html += chartCard(
    'New-visitor funnel',
    ghostFunnelHtml(funnelStages) +
    funnelLegend +
    engagementPoolHtml('&#8627; Activity (parallel, a sessioned user can do several)', engagementStages, activityNote) +
    funnelNote,
    'card-full'
  );

  // FUNNEL RATES + DEVICE — moved here from Growth so Overview answers "is
  // traffic converting" (counts in the funnel above, rates-with-targets here)
  // and "does mobile underconvert" in one morning read. Every input is already
  // in this batch (signups/entries/arrivals + prevs); device is r[49..50].
  html += '<div class="section-divider" style="grid-column:1/-1">Conversion rates &amp; device</div>';
  html += rateCard('Signup rate', signups, arrivals, signupsPrev, arrivalsPrev, { target: 5, sub: 'new accounts as a share of all visits' });
  html += rateCard('Entry rate', entries, arrivals, entriesPrev, arrivalsPrev, { target: 10, sub: 'reached welcome and consented, share of all visits' });
  html += deviceShareHtml(rows(r[49]), rows(r[50]), { floor: 20 });

  // Health check: errors + the server mini-card. Chat volume now lives in the
  // Pulse row above; TTS/voice infra moved to the Audio tab where it belongs.
  html += kpi('Errors', totalErrors, { sub: totalErrors > 0 ? llmErrors + ' LLM + ' + audioErrors + ' audio' : 'all clear', valColor: totalErrors > 0 ? '#E97451' : '#68C397' });

  // Mini server health
  html += '<div class="card card-interactive" onclick="switchTab(\\\'servers\\\')" onkeydown="if(event.key===\\\'Enter\\\'||event.key===\\\' \\\'){event.preventDefault();switchTab(\\\'servers\\\')}" tabindex="0" role="button" id="mini-servers"><div class="kpi-label">Server Health</div><div id="mini-servers-inner" style="margin-top:8px">Loading...</div></div>';

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

  // "Top Figures by Plays" removed: the canonical figure home is the Engagement
  // Figures table (Picks/Chats/Completions). Overview keeps Content Started by
  // Type + Chat by Mode for overview-level demand.

  // Top marketing pages by arrivals — which figure / theme pages are pulling
  // the most paid + organic traffic. Strips the path to a short readable
  // label ("aurelius" not "/figures/marcus-aurelius/"). Empty if no marketing
  // arrivals yet (typical for first 1-2 days after the page-beacon fix went live).
  var topMarketingItems = topMarketingPages.map(function(row) {
    return { label: pathLabel(row.path), c: row.c };
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
    var convRows = zeroFill(dailyConv);
    var convItems = convRows.map(function(row) {
      return { label: new Date(row.t).toLocaleDateString([], { month: 'short', day: 'numeric' }), c: Number(row.c) };
    });
    var convGhost = zeroFill(dailyConvPrev).map(function(row) { return Number(row.c); });
    // Align ghost length to the current series so it sits at the same calendar
    // offset (svgAreaGraph stretches by index, so unequal lengths misalign).
    if (convGhost.length > 1 && convGhost.length !== convItems.length) {
      if (convGhost.length < convItems.length) { while (convGhost.length < convItems.length) convGhost.unshift(0); }
      else { convGhost = convGhost.slice(convGhost.length - convItems.length); }
    }
    html += chartCard('Daily Conversations', svgAreaGraph(convItems, { color: '#5B8BD4', ghost: convGhost.length > 1 ? convGhost : null, ariaLabel: 'Daily conversations trend; the dashed line is the previous period' }), 'card-full');
  }
  // TTS fallback chart removed from Overview: a TTS-infra curve standing in for
  // the North Star trend belonged on the Audio tab, not here.

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
    var t = worstTier([gpuPct, vramPct, cpuPct, ramPct, diskPct]);

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
    html += '<div class="gauge-card"><div class="gauge-label">Network</div><div class="gauge-val" style="font-size:0.875rem">' + (net.bandwidth_in_mbps || 0).toFixed(0) + ' / ' + (net.bandwidth_out_mbps || 0).toFixed(0) + '</div><div class="gauge-detail">in / out Mbit/s</div></div>';
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
    // --- Wave-2 organic-pick additions (APPENDED at the end; reads are
    // positional, so new queries must never be inserted mid-array). r[34..35].
    // Batch total after these: 36 of the 64 cap. The gclid CONVERSION rows
    // share the 'mode_selected' name in blob1/index1 but never set blob3, so
    // the blob3 != '' guard keeps them out of the mode mix. No conversion is
    // named 'figure_selected', so that query needs no such guard. ---
    // Organic mode picks (funnel mode_selected, per-occurrence) by mode
    { sql: "SELECT blob3 as mode, COUNT() as c FROM agora_llm WHERE blob1 = 'mode_selected' AND blob3 != '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY mode ORDER BY c DESC", dataset: 'agora_llm' },
    // Organic figure picks (funnel figure_selected, per-occurrence), top 10
    { sql: "SELECT blob2 as figure, COUNT() as c FROM agora_llm WHERE blob1 = 'figure_selected' AND blob2 != '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY figure ORDER BY c DESC LIMIT 10", dataset: 'agora_llm' },
    // --- Listening lifecycle, r[36..42] (APPENDED at the end; reads are
    // positional, so new queries must never be inserted mid-array). Every
    // definition here is copied from internal/ops/stats-pull.mjs so the
    // dashboard and the Monday pull cannot disagree:
    //   lifecycle + per-figure  = story and teaching only, probe filtered
    //   audio finish            = completed AND double1 > 0 (a terminal row
    //                             carrying a listened bucket), ALL content
    //                             types, which is the Monday pull's definition
    //   buckets                 = terminal rows with a bucket above zero
    // blob10 is the chapter ordinal on story rows. It is empty on rows written
    // before the label shipped, which reads as unlabelled, never as chapter 0.
    { sql: "SELECT blob8 as state, COUNT() as c FROM agora_llm WHERE blob1 = 'playback' AND blob5 IN ('story','teaching') AND " + NOT_PROBE + " AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY state ORDER BY c DESC", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'playback' AND blob8 = 'completed' AND double1 > 0 AND " + NOT_PROBE + " AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT double1 as bucket, COUNT() as c FROM agora_llm WHERE blob1 = 'playback' AND blob8 IN ('completed','ended') AND double1 > 0 AND " + NOT_PROBE + " AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY bucket ORDER BY bucket ASC", dataset: 'agora_llm' },
    { sql: "SELECT blob2 as figure, COUNT() as c FROM agora_llm WHERE blob1 = 'playback' AND blob8 = 'started' AND blob5 IN ('story','teaching') AND blob2 != '' AND " + NOT_PROBE + " AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY figure ORDER BY c DESC LIMIT 12", dataset: 'agora_llm' },
    { sql: "SELECT blob2 as figure, COUNT() as c FROM agora_llm WHERE blob1 = 'playback' AND blob8 = 'completed' AND double1 > 0 AND blob5 IN ('story','teaching') AND blob2 != '' AND " + NOT_PROBE + " AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY figure ORDER BY c DESC LIMIT 12", dataset: 'agora_llm' },
    { sql: "SELECT blob10 as chapter, COUNT() as c FROM agora_llm WHERE blob1 = 'playback' AND blob8 = 'started' AND blob5 = 'story' AND " + NOT_PROBE + " AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY chapter ORDER BY c DESC LIMIT 20", dataset: 'agora_llm' },
    { sql: "SELECT blob10 as chapter, COUNT() as c FROM agora_llm WHERE blob1 = 'playback' AND blob8 = 'completed' AND double1 > 0 AND blob5 = 'story' AND " + NOT_PROBE + " AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY chapter ORDER BY c DESC LIMIT 20", dataset: 'agora_llm' },
    // --- Free-tier bot check, r[43..48]. Per-occurrence counters, NOT probe
    // filtered, matching the Monday pull (the turnstile steps are queried raw
    // there too). turnstile_token_aged is kept out of the failure family on
    // purpose: it is a token expiring after a check already succeeded.
    // Batch total after these: 49 of the 64 cap. ---
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'turnstile_started' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'turnstile_interactive' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'turnstile_solved' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'turnstile_token_aged' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT blob5 as outcome, COUNT() as c FROM agora_llm WHERE blob1 = 'turnstile_failed' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY outcome ORDER BY c DESC", dataset: 'agora_llm' },
    { sql: "SELECT blob5 as outcome, COUNT() as c FROM agora_llm WHERE blob1 = 'turnstile_abandoned' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY outcome ORDER BY c DESC", dataset: 'agora_llm' },
    // --- Spend governor, r[49..52] (APPENDED at the end; reads are positional,
    // so new queries must never be inserted mid-array). Governor rows are
    // written server side and carry no probe slot at all, so there is nothing
    // to filter, which is also how the rate-limit counters in this same section
    // are read. blob2 is the event, blob3 the endpoint, blob4 the serving model.
    // The third query carries no window on purpose: "has this counter ever
    // written a row" is the only thing that tells an honest zero apart from a
    // governor that is not armed yet. Batch total after these: 53 of the 64 cap.
    { sql: "SELECT blob2 as event, COUNT() as c FROM agora_llm WHERE blob1 = 'governor' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY event ORDER BY c DESC", dataset: 'agora_llm' },
    { sql: "SELECT blob2 as event, COUNT() as c FROM agora_llm WHERE blob1 = 'governor' AND timestamp " + prevRange() + " GROUP BY event ORDER BY c DESC", dataset: 'agora_llm' },
    { sql: "SELECT blob2 as event, COUNT() as c FROM agora_llm WHERE blob1 = 'governor' GROUP BY event ORDER BY c DESC", dataset: 'agora_llm' },
    { sql: "SELECT timestamp as t, blob2 as event, blob3 as endpoint, blob4 as model, double1 as spend FROM agora_llm WHERE blob1 = 'governor' ORDER BY timestamp DESC LIMIT 1", dataset: 'agora_llm' },
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
  // Wave-2 organic-pick reads (appended queries r[34..35]).
  var organicModes = rows(r[34]);
  var organicFigures = rows(r[35]);
  // Listening reads (appended queries r[36..42]).
  var listenLife = byKey(rows(r[36]), 'state', 'unlabelled');
  var audioFinishes = val(r[37]);
  var listenBuckets = byKey(rows(r[38]), 'bucket', '0');
  var listenFigStarts = rows(r[39]);
  var listenFigFinish = rows(r[40]);
  var listenChapStarts = rows(r[41]);
  var listenChapFinish = rows(r[42]);
  // Bot-check reads (appended queries r[43..48]).
  var tsStarted = val(r[43]);
  var tsInteractive = val(r[44]);
  var tsSolved = val(r[45]);
  var tsAged = val(r[46]);
  var tsFailed = rows(r[47]);
  var tsAbandoned = rows(r[48]);
  // Governor reads (appended queries r[49..52]).
  var govPeriod = byKey(rows(r[49]), 'event', 'unlabelled');
  var govPrev = byKey(rows(r[50]), 'event', 'unlabelled');
  var govEver = byKey(rows(r[51]), 'event', 'unlabelled');
  var govLast = rows(r[52])[0] || null;
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
  html += kpi('Chat Messages', chats, { hero: true, spark: sparkChats, sparkColor: '#5B8BD4', delta: chatsPrev, sub: 'real LLM messages. the North Star' });
  html += kpi('App Sessions', sessions, { spark: sparkSessions, delta: sessionsPrev, sub: 'app opened, incl. returning. not a conversation' });
  html += kpi('Councils', councils, { delta: councilsPrev });
  html += kpi('Summaries', summaries, { delta: summariesPrev });
  html += kpi('Chats / Session', chatsPerSession, { sub: chatsPerSession === '--' ? 'need 20+ sessions to be meaningful' : 'reads low: sessions incl. passive and returning opens' });

  // One Figures table (Picks -> Chats -> Completions), joined by figure. This
  // replaces the four scattered figure leaderboards (chats, organic picks,
  // completions, figure x mode) that never joined, and is the pick-to-chat
  // activation view the funnel work made central.
  html += chartCard('Figures: pick to chat to completion', figuresTableHtml(organicFigures, figures, playbackByFigure), 'card-wide');

  // Mode + Lang donuts
  if (modes.length > 0) {
    html += chartCard('Mode Distribution', donutSvg(modes.map(function(r) { return { key: r.mode, c: r.c }; }), COLORS.modes, modeLabel), '');
  }
  if (langs.length > 0) {
    html += chartCard('Language Split', donutSvg(langs.map(function(r) { return { key: r.lang, c: r.c }; }), COLORS.lang, function(l) { return l === 'de' ? 'Deutsch' : l === 'en' ? 'English' : cap(l || 'unknown'); }), '');
  }

  // Organic pick volume (Wave-2 funnel events, per-occurrence counters).
  // Mode Picks counts every selector pick (mode_selected), the intent-level
  // twin of the Mode Distribution donut above (which counts chat messages).
  // Figure Picks counts every figure switch (figure_selected), upstream of
  // Most Popular Figures (which needs a chat to register). Until the beacons
  // produce their first row, each card shows a quiet awaiting placeholder.
  if (organicModes.length > 0) {
    html += chartCard('Mode Picks (organic)', barsHtml(organicModes.map(function(x) { return { label: modeLabel(x.mode), c: x.c }; }), '#D8A4C0'), 'card-half');
  } else {
    html += chartCard('Mode Picks (organic)', '<div class="empty-state" style="padding:30px 0">-- awaiting first mode_selected</div>', 'card-half');
  }
  // Figure Picks and Figure x Mode folded into the unified Figures table above
  // (Picks column + the pick-to-chat relationship), so figure signals read on
  // one row instead of across three disjoint cards.

  // Chat activity graph (always visible)
  if (chatTimeline.length > 1) {
    var timeItems = zeroFill(chatTimeline).map(function(row) {
      var d = new Date(row.t);
      var label = S.range <= 1
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return { label: label, c: Number(row.c) };
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
  // Floor 20 starts before a rate: below that a % is Poisson noise (1 of 1 =
  // 100%). Show the raw fraction instead. A rate over 100% means legacy
  // completions predate the started beacon, flagged rather than clamped.
  var compBelowFloor = playbackStarted < 20;
  html += kpi('Completion Rate',
    completionRate === null ? '--' : (compBelowFloor ? (totalPlayback + '/' + playbackStarted) : (completionRate + '%')),
    { sub: completionRate === null ? 'awaiting first start'
        : (compBelowFloor ? 'raw count, needs 20+ starts for a rate'
        : (completionRate > 100 ? totalPlayback + ' / ' + playbackStarted + ', legacy completions predate the started beacon' : totalPlayback + ' / ' + playbackStarted)),
      valColor: (completionRate === null || compBelowFloor) ? 'var(--dim)' : (completionRate >= 50 ? '#68C397' : completionRate >= 25 ? '#F5A623' : '#E97451') }
  );

  // Started vs Completed over time. Rebuilt on the SVG chart system: the old
  // inline flex bars used percent heights in a content-sized column, so every
  // bar collapsed toward 1px. Started is the filled area, Completed the green
  // line, both zero-filled so an empty day reads as zero rather than vanishing.
  if (sparkPlaybackRows.length > 1 || sparkStartedRows.length > 1) {
    var sMap = {}, cMap = {};
    sparkStartedRows.forEach(function(row) { sMap[row.t] = Number(row.c); });
    sparkPlaybackRows.forEach(function(row) { cMap[row.t] = Number(row.c); });
    var unionT = {};
    sparkStartedRows.forEach(function(row) { unionT[row.t] = true; });
    sparkPlaybackRows.forEach(function(row) { unionT[row.t] = true; });
    var scRows = zeroFill(Object.keys(unionT).map(function(t) { return { t: t, c: 0 }; }));
    var scItems = scRows.map(function(row) {
      var d = new Date(row.t);
      var label = S.range <= 1
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return { label: label, c: sMap[row.t] || 0 };
    });
    var completedVals = scRows.map(function(row) { return cMap[row.t] || 0; });
    html += chartCard('Started vs Completed Over Time',
      svgAreaGraph(scItems, { color: '#5B8BD4', height: 150, line2: { values: completedVals, color: '#68C397' }, ariaLabel: 'Content started (filled area) and completed (green line) over time' }) +
      '<div style="display:flex;gap:16px;font-size:0.75rem;margin-top:6px;color:var(--dim)">' +
      '<span><span style="display:inline-block;width:10px;height:10px;background:#5B8BD4;border-radius:2px;margin-right:4px;vertical-align:middle"></span>Started</span>' +
      '<span><span style="display:inline-block;width:10px;height:10px;background:#68C397;border-radius:2px;margin-right:4px;vertical-align:middle"></span>Completed</span>' +
      '</div>',
      'card-full');
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

  // Top Figures by Completion folded into the unified Figures table above
  // (Completions column), so completion sits next to picks and chats.

  // By language
  if (playbackByLang.length > 0) {
    html += chartCard('Completion Language', donutSvg(playbackByLang.map(function(r) { return { key: r.lang || 'unknown', c: r.c }; }), COLORS.lang, function(l) { return l === 'de' ? 'Deutsch' : (l === 'en' ? 'English' : 'Unknown'); }), '');
  }
  html += '</div>';

  // === LISTENING (the reception arm, lifecycle beacons live 2026-09-01) ===
  // Content Consumption above counts every content type on the legacy
  // completion semantics. This section is the audio lifecycle a track reports
  // for itself: it started, it passed each quarter, and it either finished or
  // stopped short. Story and teaching only, probe filtered, definitions copied
  // from the Monday pull.
  var listenStarted = listenLife.started || 0;
  var listenEnded = listenLife.ended || 0;
  html += '<div class="section-divider">Listening</div>';
  var listenHint = 'Rows are tracks, not listeners. One person playing three chapters writes three starts, and nothing ties a track back to a visit, so read this as how content performs and never as how many people listened. ' +
    'The lifecycle covers stories and teachings only. Finished counts a terminal row carrying a listened bucket, across every content type, which is how the Monday pull counts it, so the finish rate can read high against a stories-and-teachings denominator. ' +
    'Rows written before ' + NS2_LIVE_DATE + ' have no milestone or bucket at all, so any window reaching back before then undercounts everything here except starts.';
  html += '<div class="hint-banner">' + listenHint + '</div>';
  // A zero here would claim nobody finished, when on a young beacon the truth
  // is that the counter has produced no rows yet. Both cases show the awaiting
  // marker instead, exactly as the funnel and ladder stages do.
  var awaitTerminal = 'awaiting first terminal row. beacon live since ' + NS2_LIVE_DATE;
  html += '<div class="grid">';
  html += kpi('Tracks Started', listenStarted, { hero: true, sub: 'story and teaching first-plays, probe filtered' });
  html += kpi('Audio Finishes', audioFinishes === 0 ? '--' : audioFinishes, {
    sub: audioFinishes === 0 ? awaitTerminal : 'terminal row carrying a listened bucket, all content types',
  });
  html += kpi('Stopped Short', listenEnded === 0 ? '--' : listenEnded, {
    sub: listenEnded === 0 ? awaitTerminal : 'playback ended before the track did',
  });
  html += kpi('Finish Rate', audioFinishes === 0 ? '--' : shareText(audioFinishes, listenStarted), {
    sub: audioFinishes === 0
      ? 'no finish rows yet, so there is no rate to read'
      : (listenStarted < 20 ? 'raw count, needs 20+ starts for a rate' : 'finishes over starts, mixed denominators'),
    valColor: audioFinishes === 0 ? 'var(--dim)' : undefined,
  });

  // The lifecycle as one shared axis. Deliberately no ghost bars: the previous
  // period predates the milestone beacons for now, so a ghost would draw the
  // beacon's ship date as a collapse.
  var listenRungs = [
    // Short, uniform rung labels on purpose: the label column is narrow on a
    // phone, and a long one squeezes the track until the awaiting note clips.
    { label: 'Started', value: listenStarted, sub: 'first play', pending: 'playback started' },
    { label: '25% heard', value: listenLife.progress_25 || 0, sub: 'quarter', pending: 'progress_25' },
    { label: '50% heard', value: listenLife.progress_50 || 0, sub: 'half', pending: 'progress_50' },
    { label: '75% heard', value: listenLife.progress_75 || 0, sub: 'three quarters', pending: 'progress_75' },
    { label: 'Finished', value: listenLife.completed || 0, sub: 'incl. legacy mark', pending: 'completed' },
    { label: 'Ended early', value: listenEnded, sub: 'stopped short', pending: 'ended' },
  ];
  var quarterLine = (listenLife.progress_25 || 0) === 0
    ? 'No quarter milestone rows yet, so there is no hold rate to read.'
    : 'Reached a quarter: ' + shareText(listenLife.progress_25 || 0, listenStarted) + ' of starts.';
  var listenLadderNote = '<div style="margin-top:8px;font-size:11px;color:var(--dim);line-height:1.4">' +
    'The three milestone rungs sit inside one track, so they do nest. Finished and Ended early are the two ways the same track stops, so they sit side by side and never sum with the milestones. ' +
    quarterLine + ' ' +
    'The Finished rung counts every completed row, including the legacy gamification mark that carries no listened time, while the Audio Finishes card above counts only the rows that carry one.' +
    '</div>';
  html += chartCard('Listening lifecycle', ladderHtml(listenRungs, 'Listening lifecycle') + listenLadderNote, 'card-full');

  // Time actually heard, from the bucket on terminal rows. Bucket 0 (under 15
  // seconds) is filtered out by the same ex-zero guard the Monday pull uses,
  // because an unwritten slot and a genuine sub-15s listen are the same value.
  var bucketItems = [];
  for (var bi = 1; bi < LISTEN_BUCKET_LABELS.length; bi++) {
    var bc = listenBuckets[String(bi)] || listenBuckets[bi] || 0;
    if (bc > 0) bucketItems.push({ label: LISTEN_BUCKET_LABELS[bi], c: bc });
  }
  var bucketNote = '<div class="kpi-sub" style="margin-top:6px;display:block">Time the audio actually ran, in coarse buckets, on the row that ended the track. The under 15s bucket cannot be told apart from an unwritten slot, so it is excluded and short listens are missing from this chart.</div>';
  html += chartCard('Time actually heard',
    (bucketItems.length > 0 ? barsHtml(bucketItems, 'var(--s-story)') : '<div class="empty-state" style="padding:30px 0">-- awaiting first terminal row with a listened bucket</div>') + bucketNote,
    'card-wide');

  html += chartCard('Listening by figure',
    listenTableHtml('Figure', listenFigStarts, listenFigFinish, 'figure', cap, 'unlabelled') +
    '<div class="kpi-sub" style="margin-top:6px;display:block">Stories and teachings only. The finish rate shows a raw fraction under 20 starts, and stays blank while the finish counter has produced no rows at all.</div>',
    'card-wide');

  // Chapter ranking. blob10 carries the ordinal on story rows only; an empty
  // slot is a row from before the label shipped and is named unlabelled, never
  // folded into chapter 0.
  var chapUnlabelled = byKey(listenChapStarts, 'chapter', 'unlabelled').unlabelled || 0;
  var chapNote = chapUnlabelled > 0
    ? 'Rows with no chapter label are stories played before the label shipped on ' + NS2_LIVE_DATE + '. They are listed as unlabelled, never as chapter 0, and they are the reason a chapter ranking on an older window looks empty.'
    : 'Stories only. Prisms, councils and forewords have no chapters and are absent by design.';
  html += chartCard('Listening by chapter',
    listenTableHtml('Chapter', listenChapStarts, listenChapFinish, 'chapter', function(c) {
      return c === 'unlabelled' ? 'unlabelled' : 'Chapter ' + c;
    }, 'unlabelled') +
    '<div class="kpi-sub" style="margin-top:6px;display:block">' + chapNote + '</div>',
    'card-wide');
  html += '</div>';

  // === FREE-TIER BOT CHECK ===
  // The gate in front of a free-tier message. Every counter here is a row per
  // occurrence, so the ratios are indicative rather than exact.
  html += '<div class="section-divider">Free-tier bot check</div>';
  html += '<div class="hint-banner">Counter semantics are per row, so one session can emit several rows, and the error class may include benign auto retries. Every ratio here is indicative until per-session dedup is verified. Token aged sits outside the failure family on purpose: it is a token expiring after a check already succeeded, so it costs nobody a message, and counting it as a failure used to bury the real ones. These counters are not probe filtered, matching the Monday pull.</div>';
  var tsFailTotal = tsFailed.reduce(function(s, x) { return s + Number(x.c || 0); }, 0);
  var tsAbandTotal = tsAbandoned.reduce(function(s, x) { return s + Number(x.c || 0); }, 0);
  html += '<div class="grid">';
  html += kpi('Checks Started', tsStarted, { hero: true, sub: 'one row per widget render, the denominator' });
  html += kpi('Escalated to a Tap', tsInteractive, { sub: 'escalation ' + shareText(tsInteractive, tsStarted) + ' of checks started' });
  html += kpi('Tap Landed', tsSolved, { sub: 'solved ' + shareText(tsSolved, tsInteractive) + ' of escalations' });
  html += kpi('Failed', tsFailTotal, { sub: tsFailTotal > 0 ? 'ended without a token' : 'no failures this period', valColor: tsFailTotal > 0 ? '#E97451' : '#68C397' });
  html += kpi('Abandoned', tsAbandTotal, { sub: 'page went away with the check still running' });
  html += kpi('Token Aged', tsAged, { sub: 'expired after a successful check. housekeeping, not a failure' });

  var tsRungs = [
    { label: 'Started', value: tsStarted, sub: 'widget rendered', pending: 'turnstile_started' },
    { label: 'Escalated', value: tsInteractive, sub: 'a tap was asked for', pending: 'turnstile_interactive' },
    { label: 'Solved', value: tsSolved, sub: 'the tap landed', pending: 'turnstile_solved' },
  ];
  var tsNote = '<div style="margin-top:8px;font-size:11px;color:var(--dim);line-height:1.4">' +
    'Escalated and Solved do nest inside Started, but only per row, and a single session can render the widget more than once. ' +
    'Escalation ' + shareText(tsInteractive, tsStarted) + ' of starts, solve ' + shareText(tsSolved, tsInteractive) + ' of escalations. ' +
    'Failures and abandons are counted apart because a check can end without a token for reasons that never reached a person.' +
    '</div>';
  html += chartCard('Bot check, start to solve', ladderHtml(tsRungs, 'Bot check ladder') + tsNote, 'card-full');

  var tsFailItems = aggregateByLabel(tsFailed.map(function(x) { return { label: x.outcome || 'unlabelled', c: x.c }; }));
  html += chartCard('Failed by reason',
    (tsFailItems.length > 0 ? barsHtml(tsFailItems, 'var(--s-quest)') : '<div class="empty-state" style="padding:30px 0">No failures ' + RANGE_LABEL[S.range] + '</div>') +
    '<div class="kpi-sub" style="margin-top:6px;display:block">The error class can include a widget retrying itself, which nobody experiences as a lost message.</div>',
    'card-half');
  var tsAbandItems = aggregateByLabel(tsAbandoned.map(function(x) { return { label: x.outcome === 'interactive' ? 'tap never came' : x.outcome === 'pending' ? 'widget never appeared' : (x.outcome || 'unlabelled'), c: x.c }; }));
  html += chartCard('Abandoned by state',
    (tsAbandItems.length > 0 ? barsHtml(tsAbandItems, 'var(--s-wisdom)') : '<div class="empty-state" style="padding:30px 0">No abandons ' + RANGE_LABEL[S.range] + '</div>') +
    '<div class="kpi-sub" style="margin-top:6px;display:block">A check still pending when the page went away. The state says whether a tap was waiting or the widget had not appeared yet.</div>',
    'card-half');
  html += '</div>';

  // === LLM CAPACITY (chat-side rate limits + global config) ===
  // Audio rate limits + audio activity moved to the dedicated Audio tab.
  html += '<div class="section-divider">Capacity</div>';
  html += '<div class="grid">';

  // === SPEND GOVERNOR ===
  // The rows arrive only once the free-tier model flip is armed, so a counter
  // that has never written shows the awaiting marker and never a zero.
  html += '<div class="section-divider" style="grid-column:1/-1;margin-top:0;padding-left:14px">Spend governor</div>';
  // A counter counts as written when any of the three governor queries saw it,
  // so one failed query can never blank a family that has real rows.
  function govWrote(key) {
    return (govEver[key] || 0) > 0 || (govPeriod[key] || 0) > 0 || (govPrev[key] || 0) > 0;
  }
  var govArmed = !!govLast || GOVERNOR_EVENTS.some(function(g) { return govWrote(g.key); });
  var govHint = 'Soft alert and hard trip are written once per day, at the first crossing, so they count days and never requests. The fallback pair is one row per request that moved to the standby model. After a hard trip the rest of the day goes straight to the standby with no fallback row, so the two families never sum. Chat rows carry no model, so chat requests cannot be split by which model served them.';
  if (!govArmed) govHint += ' Nothing has been written yet. The governor arms with the free-tier model flip.';
  html += '<div class="hint-banner" style="grid-column:1/-1;margin-bottom:0">' + govHint + '</div>';

  GOVERNOR_EVENTS.forEach(function(g) {
    if (!govWrote(g.key)) {
      html += kpi(g.label, '--', { sub: 'awaiting first ' + g.key, valColor: 'var(--dim)' });
      return;
    }
    var v = govPeriod[g.key] || 0;
    html += kpi(g.label, v, {
      delta: govPrev[g.key] || 0,
      deltaInvert: true,
      sub: g.sub,
      valColor: v > 0 ? g.tone : 'var(--ok)',
    });
  });

  var govLastBody, govLastNote;
  if (govLast) {
    govLastBody = '<div class="kpi-value" style="font-size:1.375rem">' + esc(governorLabel(govLast.event)) + '</div>' +
      '<div class="kpi-sub" style="display:block;margin-top:4px">' + aeTime(govLast.t) +
      ' on ' + esc(govLast.model || 'unlabelled model') +
      (govLast.endpoint ? ', ' + esc(govLast.endpoint) : '') + '</div>' +
      // double1 is the day-to-date metered spend in USD at the moment the row fired.
      (Number.isFinite(Number(govLast.spend)) ? '<div class="kpi-sub" style="display:block;margin-top:4px">Spend that day when it fired: $' + Number(govLast.spend).toFixed(2) + '</div>' : '');
    govLastNote = 'The most recent row overall, not only the selected period. The model is the one the row was written for, which on a fallback is the standby that answered.';
  } else {
    govLastBody = '<div class="empty-state" style="padding:24px 0">-- awaiting first governor row</div>';
    govLastNote = 'The governor arms with the free-tier model flip.';
  }
  html += chartCard('Last governor event', govLastBody +
    '<div class="kpi-sub" style="margin-top:6px;display:block">' + govLastNote + '</div>',
    'card-wide');

  html += '<div class="section-divider" style="grid-column:1/-1;padding-left:14px">Rate limits</div>';

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
    // --- STT parity + error split (APPENDED; reads positional). r[11..13].
    // TTS errors, STT errors (so "Audio Errors" can name the split), and an STT
    // volume trend so STT is not the only pipeline with no time series. ---
    { sql: "SELECT COUNT() as c FROM agora_audio WHERE blob5 = 'speech' AND blob4 != '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_audio' },
    { sql: "SELECT COUNT() as c FROM agora_audio WHERE blob5 = 'transcriptions' AND blob4 != '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_audio' },
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_audio WHERE blob5 = 'transcriptions' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_audio' },
  ];

  var r = await batch(queries);
  S.lastAnalytics = Date.now();

  var tts = val(r[0]), ttsPrev = val(r[1]);
  var stt = val(r[2]), sttPrev = val(r[3]);
  var sparkTts = rows(r[4]).map(function(x) { return x.c; });
  var sparkTtsRows = rows(r[4]);
  var avgLatency = r[5] && r[5].data && r[5].data[0] && r[5].data[0].avg_ms != null ? Number(r[5].data[0].avg_ms) : null;
  var audioErrors = val(r[6]);
  var ttsModels = rows(r[7]);
  var serverDist = rows(r[8]);
  var audioLangs = rows(r[9]);
  var rlAudio = rows(r[10]);
  var totalRlAudio = rlAudio.reduce(function(s, x) { return s + x.c; }, 0);
  var ttsErr = val(r[11]), sttErr = val(r[12]);
  var sttTrendRows = rows(r[13]);

  var html = '';

  // === ACTIVITY ===
  html += '<div class="section-divider">Audio Activity</div>';
  html += '<div class="grid">';
  html += kpi('TTS Requests', tts, { hero: true, spark: sparkTts, sparkColor: '#68C397', delta: ttsPrev });
  html += kpi('STT Requests', stt, { delta: sttPrev });
  html += kpi('Avg TTS Latency', fmtMs(avgLatency), { sub: avgLatency == null ? 'no successful TTS calls in period' : '' });
  html += kpi('Audio Errors', audioErrors, { sub: audioErrors > 0 ? ttsErr + ' TTS + ' + sttErr + ' STT' : 'all clear', valColor: audioErrors > 0 ? '#E97451' : '#68C397' });

  // TTS + STT volume over time, both zero-filled so an empty bucket reads as
  // zero rather than vanishing.
  if (sparkTtsRows.length > 1) {
    var ttsGraphItems = zeroFill(sparkTtsRows).map(function(row) {
      var d = new Date(row.t);
      var label = S.range <= 1
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return { label: label, c: Number(row.c) };
    });
    html += chartCard('TTS Volume Over Time', svgAreaGraph(ttsGraphItems, { color: '#68C397', height: 130, ariaLabel: 'TTS requests over time' }), 'card-full');
  }
  if (sttTrendRows.length > 1) {
    var sttGraphItems = zeroFill(sttTrendRows).map(function(row) {
      var d = new Date(row.t);
      var label = S.range <= 1
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return { label: label, c: Number(row.c) };
    });
    html += chartCard('STT Volume Over Time', svgAreaGraph(sttGraphItems, { color: '#9D83CD', height: 130, ariaLabel: 'STT requests over time' }), 'card-full');
  }
  html += '</div>';

  // === BACKEND ===
  html += '<div class="section-divider">Backend Distribution</div>';
  html += '<div class="grid">';

  if (ttsModels.length > 0) {
    var mRows = ttsModels.map(function(r) {
      var mc = COLORS.models[r.model] || 'var(--dim)';
      return ['<span style="color:' + mc + '">' + esc(r.model) + '</span>', fmt(r.c), fmtMs(r.avg_ms)];
    });
    html += chartCard('TTS Models', tableHtml(['Model', 'Requests', 'Avg Latency'], mRows), 'card-wide');
  }

  if (serverDist.length > 0) {
    html += chartCard('Server Distribution', donutSvg(serverDist.map(function(r) { return { key: r.server, c: r.c }; }), COLORS.servers, function(s) { return s.toUpperCase(); }), '');
  }
  if (audioLangs.length > 0) {
    html += chartCard('Audio Language', donutSvg(audioLangs.map(function(r) { return { key: r.lang, c: r.c }; }), COLORS.lang, function(l) { return l === 'de' ? 'Deutsch' : l === 'en' ? 'English' : cap(l || 'unknown'); }), '');
  }
  html += '</div>';

  // === RATE LIMITS ===
  html += '<div class="section-divider">Audio Rate Limits</div>';
  html += '<div class="grid">';
  if (totalRlAudio > 0) {
    var audioRlLabels = { daily_limit: 'Daily cap', burst_limit: 'Burst' };
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

// ─── Growth: the ad engagement ladder, the consent prompt, traffic ───

async function loadAdGrants() {
  var grid = document.getElementById('grid-adgrants');
  var alertsEl = document.getElementById('alerts-adgrants');

  // Two row shapes live on this tab and must never be mixed.
  //
  // CONVERSION rows (routes/conversions.ts) are gclid-gated: they exist only
  // for a visitor who arrived on a Google Ads click AND granted ad consent.
  // They write index1/blob1 = event and blob2 = figureId, nothing else, so
  // blob5 = '' is what separates them from a funnel row carrying the same
  // name. Every conversion query below keeps that guard even where no name
  // collision exists today, so a later funnel step cannot silently inflate a
  // paid number.
  //
  // CONSENT rows (routes/funnel.ts, the ad_consent_* steps) are anonymous
  // counters about the prompt itself: blob1 = step, blob2 = sanitized page
  // path, blob4 = language, blob5 forced to '200'. No click id, no figure,
  // no user dimension, by construction in the worker.
  //
  // mode_selected is retired as a conversion (the worker rejects it and the
  // Ads action is deleted), so nothing here queries it any more. Its organic
  // funnel namesake is untouched and still lives on the Engagement tab.
  var queries = [
    // --- Engagement ladder, r[0..11]. Four depths in ladder order, each as
    // current + previous (delta) + sparkline. ---
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'start_exploring' AND blob5 = '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'start_exploring' AND blob5 = '' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE index1 = 'start_exploring' AND blob5 = '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'listened' AND blob5 = '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'listened' AND blob5 = '' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE index1 = 'listened' AND blob5 = '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'dialogue_started' AND blob5 = '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'dialogue_started' AND blob5 = '' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE index1 = 'dialogue_started' AND blob5 = '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'conversation_deepened' AND blob5 = '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'conversation_deepened' AND blob5 = '' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE index1 = 'conversation_deepened' AND blob5 = '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
    // --- Off-ladder conversions, r[12..17]. Same three-query shape. ---
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'profile_created' AND blob5 = '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'profile_created' AND blob5 = '' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE index1 = 'profile_created' AND blob5 = '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'council_engaged' AND blob5 = '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE index1 = 'council_engaged' AND blob5 = '' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT toStartOfInterval(timestamp, INTERVAL " + sparkBucket() + ") as t, COUNT() as c FROM agora_llm WHERE index1 = 'council_engaged' AND blob5 = '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY t ORDER BY t", dataset: 'agora_llm' },
    // --- Figures, r[18]. Blended across every conversion that can carry a
    // figureId. conversation_deepened never does, so it is absent by design. ---
    { sql: "SELECT blob2 as figure, COUNT() as c FROM agora_llm WHERE index1 IN ('listened','dialogue_started','council_engaged','start_exploring') AND blob5 = '' AND blob2 != '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY figure ORDER BY c DESC LIMIT 10", dataset: 'agora_llm' },
    // --- Ad consent prompt, r[19..26]. Anonymous counters, current + previous
    // for every step so both rates can show a percentage-point change. ---
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'ad_consent_shown' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'ad_consent_shown' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'ad_consent_accepted' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'ad_consent_accepted' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'ad_consent_declined' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'ad_consent_declined' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'ad_consent_dismissed' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'ad_consent_dismissed' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    // --- Consent breakdowns, r[27..30]. Seen and accepted by page path
    // (blob2) and by interface language (blob4): where does the question work. ---
    { sql: "SELECT blob2 as path, COUNT() as c FROM agora_llm WHERE blob1 = 'ad_consent_shown' AND blob2 != '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY path ORDER BY c DESC LIMIT 12", dataset: 'agora_llm' },
    { sql: "SELECT blob2 as path, COUNT() as c FROM agora_llm WHERE blob1 = 'ad_consent_accepted' AND blob2 != '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY path ORDER BY c DESC LIMIT 12", dataset: 'agora_llm' },
    { sql: "SELECT blob4 as language, COUNT() as c FROM agora_llm WHERE blob1 = 'ad_consent_shown' AND blob4 != '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY language ORDER BY c DESC", dataset: 'agora_llm' },
    { sql: "SELECT blob4 as language, COUNT() as c FROM agora_llm WHERE blob1 = 'ad_consent_accepted' AND blob4 != '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY language ORDER BY c DESC", dataset: 'agora_llm' },
    // --- Traffic, r[31..35]. Volume and geography only, no source split. ---
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'page' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'page' AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT blob7 as country, COUNT() as c FROM agora_llm WHERE blob1 = 'page' AND blob7 != '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY country ORDER BY c DESC LIMIT 10", dataset: 'agora_llm' },
    { sql: "SELECT blob7 as country, COUNT() as c FROM agora_llm WHERE blob1 IN ('chat','council','summary') AND blob5 = '200' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY country ORDER BY c DESC LIMIT 10", dataset: 'agora_llm' },
    // blob6 != '' drops the pre-device untagged rows, mirroring the country panels.
    { sql: "SELECT blob6 as device, COUNT() as c FROM agora_llm WHERE blob1 = 'page' AND blob6 != '' AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY GROUP BY device ORDER BY c DESC", dataset: 'agora_llm' },
    // --- Attribution counters, r[36..40] (APPENDED at the end; reads are
    // positional, so new queries must never be inserted mid-array). Same SQL as
    // the Monday pull's paid_arrivals and landings, probe filter included.
    // paid_arrival is a click that carried the paid parameter and nothing else:
    // no path, no figure, no click id. The landing bit says a pageview opened
    // the visit, which is a property of the pageview, not of the visitor. The
    // ex-probe arrivals count is the matching denominator for the landing
    // share (Raw Visits above is raw, so the two must not be divided).
    // Batch total after these: 41 of the 64 cap. ---
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'paid_arrival' AND " + NOT_PROBE + " AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'paid_arrival' AND " + NOT_PROBE + " AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'page' AND blob8 = 'landing' AND " + NOT_PROBE + " AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'page' AND blob8 = 'landing' AND " + NOT_PROBE + " AND timestamp " + prevRange(), dataset: 'agora_llm' },
    { sql: "SELECT COUNT() as c FROM agora_llm WHERE blob1 = 'page' AND " + NOT_PROBE + " AND timestamp > NOW() - INTERVAL '" + iv() + "' DAY", dataset: 'agora_llm' },
  ];

  var r = await batch(queries);
  S.lastAnalytics = Date.now();

  // Ladder (r[0..11]).
  var startExp = val(r[0]), startExpPrev = val(r[1]);
  var sparkStartExp = rows(r[2]).map(function(x) { return x.c; });
  var listened = val(r[3]), listenedPrev = val(r[4]);
  var sparkListened = rows(r[5]).map(function(x) { return x.c; });
  var dialogues = val(r[6]), dialoguesPrev = val(r[7]);
  var sparkDialogues = rows(r[8]).map(function(x) { return x.c; });
  var deepened = val(r[9]), deepenedPrev = val(r[10]);
  var sparkDeepened = rows(r[11]).map(function(x) { return x.c; });
  // Off-ladder conversions (r[12..17]).
  var profileConv = val(r[12]), profilePrev = val(r[13]);
  var sparkProfile = rows(r[14]).map(function(x) { return x.c; });
  var councilConv = val(r[15]), councilPrev = val(r[16]);
  var sparkCouncil = rows(r[17]).map(function(x) { return x.c; });
  // Figures (r[18]).
  var figuresByEngagement = rows(r[18]);
  // Consent counters (r[19..26]).
  var cShown = val(r[19]), cShownPrev = val(r[20]);
  var cAccept = val(r[21]), cAcceptPrev = val(r[22]);
  var cDecline = val(r[23]), cDeclinePrev = val(r[24]);
  var cDismiss = val(r[25]), cDismissPrev = val(r[26]);
  // Consent breakdowns (r[27..30]).
  var shownByPath = rows(r[27]), acceptByPath = rows(r[28]);
  var shownByLang = rows(r[29]), acceptByLang = rows(r[30]);
  // Traffic (r[31..35]).
  var visits = val(r[31]), visitsPrev = val(r[32]);
  var topCountriesAll = rows(r[33]);
  var topCountriesChat = rows(r[34]);
  var deviceArrivals = rows(r[35]);
  // Attribution reads (appended queries r[36..40]).
  var paidArrivals = val(r[36]), paidArrivalsPrev = val(r[37]);
  var landings = val(r[38]), landingsPrev = val(r[39]);
  var arrivalsExProbe = val(r[40]);

  // A decision is a yes or a no. Closing the card is not an answer, so it stays
  // out of the decisions denominator and gets its own share instead.
  var cDecisions = cAccept + cDecline;
  var cDecisionsPrev = cAcceptPrev + cDeclinePrev;
  // Seen but never answered. Clamped: the beacons are independent, so an accept
  // that beats its own shown beacon (a click inside the first second, a lost
  // sendBeacon) can push this below zero without anything being wrong.
  var cNoAnswer = Math.max(0, cShown - cAccept - cDecline - cDismiss);

  alertsEl.innerHTML = S.fetchError
    ? '<div class="alert-card a-err">Stats API unreachable. The numbers below are stale or absent, not real zeros. Retry in a moment.</div>'
    : '';

  var html = '';

  // ── ENGAGEMENT LADDER (gclid-gated conversions) ──
  html += '<div class="section-divider">Engagement ladder &middot; Google Ads conversions</div>';
  // Persistent scope banner so a row of zeros never reads as a product failure.
  html += '<div class="hint-banner">Only visitors who arrive with a Google Ads gclid and grant ad consent are counted here, so the consent gate caps every number on this tab and low is structural, not a funnel failure. The four rungs are depths, not gates: Listened happens on the marketing pages while both dialogue events happen in the app, so someone can start a dialogue without ever listening. All six conversions are secondary actions in August, building the history September value bidding will run on. Mode Selected is retired as a conversion and gone from this tab, while its organic counter on Engagement keeps running. Paid campaigns (?p=1) run on clicks only, and organic traffic never appears here at all.</div>';

  // The ladder itself: one shared axis, ghost bars for the previous period.
  var ladderRungs = [
    { label: 'Start Exploring', value: startExp, prev: startExpPrev, sub: 'consent given', spark: sparkStartExp, sparkColor: '#5B8BD4', pending: 'start_exploring' },
    { label: 'Listened', value: listened, prev: listenedPrev, sub: '30s of audio', spark: sparkListened, sparkColor: '#E6BC5C', pending: 'listened' },
    { label: 'Dialogue', value: dialogues, prev: dialoguesPrev, sub: 'first message', spark: sparkDialogues, sparkColor: '#68C397', pending: 'dialogue_started' },
    { label: 'Deepened', value: deepened, prev: deepenedPrev, sub: 'third message', spark: sparkDeepened, sparkColor: '#9D83CD', pending: 'conversation_deepened' },
  ];
  // Deepened is the one true subset on this ladder (a third message implies a
  // first), so it is the only place a rate is honest. Same small-base rule as
  // everywhere else: raw counts under 20, a percentage above it.
  var deepenLine;
  if (dialogues === 0) {
    // A deepen without its own dialogue start is possible (consent arriving
    // mid-conversation lets the third message send while the first could not),
    // so say that rather than print a fraction over zero.
    deepenLine = deepened > 0
      ? 'Third-message depth: ' + fmt(deepened) + ' deepened with no dialogue start recorded, which is what consent arriving mid-conversation looks like.'
      : 'Third-message depth: no dialogues started ' + RANGE_LABEL[S.range] + '.';
  } else if (dialogues < 20) {
    deepenLine = 'Third-message depth: ' + fmt(deepened) + ' of ' + fmt(dialogues) + ' dialogues reached a third message (small base, raw counts).';
  } else {
    deepenLine = 'Third-message depth: ' + Math.round(deepened / dialogues * 100) + '% (' + fmt(deepened) + ' of ' + fmt(dialogues) + ' dialogues).';
  }
  var ladderLegend = '<div class="fbar-legend">' +
    '<span class="swatch" style="background:var(--gold-subtle)"></span> this ' + RANGE_LABEL[S.range] +
    '<span class="swatch" style="background:color-mix(in srgb, var(--gold-deep) 22%, transparent);margin-left:10px"></span> previous period (ghost)' +
    '</div>';
  var ladderNote = '<div style="margin-top:8px;font-size:11px;color:var(--dim);line-height:1.4">' +
    'Start Exploring fires when an ad visitor accepts the consent prompt or clicks a Start Exploring CTA. ' +
    'Listened is 30 seconds of audio played on the marketing pages. Dialogue is the first message sent in the app. ' +
    'Deepened is the third message in the same conversation. ' +
    'Read the bars as depth reached, never as drop-off. ' + deepenLine + ' ' +
    'All four are secondary actions in August, so they steer no bidding yet. They go primary on September 1 with value bidding, weighted so a deepened conversation counts for far more than a listen.' +
    '</div>';
  html += chartCard('How deep ad visitors get', ladderHtml(ladderRungs) + ladderLegend + ladderNote, 'card-full');

  // ── OFF-LADDER CONVERSIONS ──
  html += '<div class="section-divider">Other ad conversions</div>';
  html += '<div class="grid">';
  html += kpi('Profile Created', profileConv, { spark: sparkProfile, sparkColor: '#68C397', delta: profilePrev, sub: 'welcome disclosure accepted (consent given, Begin clicked)' });
  html += kpi('Council Engaged', councilConv, { spark: sparkCouncil, sparkColor: '#9D83CD', delta: councilPrev, sub: '60s of a council heard (curated or custom)' });
  // The volume Google Ads actually receives. Six events of very different
  // depth, every one weighted the same in this sum, which is precisely the
  // flattening that September value bidding exists to undo.
  var allConv = startExp + listened + dialogues + deepened + profileConv + councilConv;
  var allConvPrev = startExpPrev + listenedPrev + dialoguesPrev + deepenedPrev + profilePrev + councilPrev;
  html += kpi('All Ad Conversions', allConv, { delta: allConvPrev, sub: 'the six events summed, weighted the same here and secondary all August' });
  html += chartCard('Top Figures by Ad Engagement',
    barsHtml(figuresByEngagement.map(function(x) { return { label: cap(x.figure), c: x.c }; }), '#E6BC5C') +
    '<div class="kpi-sub" style="margin-top:6px;display:block">Listened, dialogue, council and start events that carried a figure. Deepened never carries one.</div>',
    'card-wide');
  html += '</div>';

  // Instrumentation health — one quiet line. The plumbing being wired says
  // nothing about whether anyone converted.
  html += '<div class="insight" style="padding:8px 2px 0">Instrumentation wired (not live-checked): gclid capture, the four consent counters, the start / listened / dialogue / deepened / profile / council conversions, the CF worker, and Google Ads CAPI forwarding. Wiring being in place says nothing about whether anyone converted.</div>';

  // ── AD CONSENT PROMPT ──
  // The gate in front of every number above. Two rates, always together: the
  // accept-of-seen rate moves mechanically whenever the prompt starts appearing
  // more often, the accept-of-decisions rate does not.
  html += '<div class="section-divider">Ad consent prompt</div>';
  html += '<div class="hint-banner">Seen counts only cards that sat at least half in view for a full second, so the denominator means plausibly seen, not merely rendered. Both accept rates are shown on purpose. Accepts over seen moves whenever the prompt starts appearing more often, accepts over decisions does not, so a change in one and not the other tells you which happened. Closing the card is not a decision, so it gets its own share.</div>';
  html += '<div class="grid">';
  html += kpi('Prompt Seen', cShown, { hero: true, delta: cShownPrev, sub: 'half the card in view for a full second' });
  html += '<div class="card card-wide">' + engagementPoolHtml(
    'What they answered (one visitor, one answer)',
    [
      { label: 'Accepted', value: cAccept, sub: 'measurement on' },
      { label: 'Declined', value: cDecline, sub: 'measurement off' },
      { label: 'Dismissed', value: cDismiss, sub: 'closed the card' },
      { label: 'No answer', value: cNoAnswer, sub: 'left it open' },
    ],
    'No answer is what is left of Seen once the three answers are counted, so it reads 0 when the beacons land out of order.'
  ) + '</div>';
  html += rateCard('Accepts / seen', cAccept, cShown, cAcceptPrev, cShownPrev, { sub: fmt(cAccept) + ' of ' + fmt(cShown) + ' seen' });
  html += rateCard('Accepts / decisions', cAccept, cDecisions, cAcceptPrev, cDecisionsPrev, { sub: fmt(cAccept) + ' of ' + fmt(cDecisions) + ' yes-or-no answers' });
  html += rateCard('Dismiss share', cDismiss, cShown, cDismissPrev, cShownPrev, { invert: true, sub: 'closed the card without answering' });
  html += consentTable('Language', shownByLang, acceptByLang, 'language', function(v) {
    return v === 'de' ? 'Deutsch' : v === 'en' ? 'English' : cap(v || 'unknown');
  }, '');
  html += consentTable('Page', shownByPath, acceptByPath, 'path', pathLabel, 'card-wide');
  html += '</div>';

  // ── TRAFFIC (mixed sources) ──
  html += '<div class="section-divider">Traffic (mixed sources)</div>';
  html += '<div class="grid">';
  html += kpi('Raw Visits', visits, { hero: true, delta: visitsPrev, sub: 'page loads, mixed: ads + organic + bots' });
  html += '<div class="card card-wide"><div class="kpi-label">No source split, by design</div><div style="margin-top:8px;font-size:0.8125rem;color:var(--tx2);line-height:1.5">We deliberately do not record where a visit came from (no utm tags, no referrer profiling), so this stays inside the no-tracking, no-profiling promise. Channel performance is judged on each platform\\'s own console (Google Ads, Search Console, Spotify, Reddit), not here. This view shows volume and geography only.</div></div>';
  // The three geography and device panels sit one row across rather than each
  // taking two of three columns and leaving a hole beside it.
  var countryAllItems = aggregateByLabel(topCountriesAll.map(function(r) { return { label: r.country || 'Unknown', c: r.c }; }));
  html += chartCard('Top Countries (all visits)', barsHtml(countryAllItems, '#9B7BC7'), '');
  var countryChatItems = aggregateByLabel(topCountriesChat.map(function(r) { return { label: r.country || 'Unknown', c: r.c }; }));
  html += chartCard('Top Countries (conversations)', barsHtml(countryChatItems, '#5B8BD4'), '');
  // Device share-vs-share moved to Overview (beside the funnel, where the
  // activation question lives). Growth keeps the raw arrivals bar for symmetry
  // with Top Countries.
  var deviceArrivalItems = aggregateByLabel(deviceArrivals.map(function(r) { return { label: cap(r.device || 'unknown'), c: r.c }; }));
  html += chartCard('Device (all visits)', barsHtml(deviceArrivalItems, 'var(--s-wisdom)'), '');
  html += '</div>';

  // ── ATTRIBUTION (what the URL said, never who clicked) ──
  // The only two source-shaped numbers we hold, and both describe the request
  // rather than the person. They sit under Traffic because that is where
  // arrivals are read, and they change nothing about the no-source-split rule
  // above: neither one is a channel report and neither is a conversion.
  var attrNs2 = ns2Coverage();
  html += '<div class="section-divider">Attribution</div>';
  var attrHint = 'Paid arrivals count a pageview whose landing URL carried the paid parameter. That is reach, and only reach: paid campaigns are deliberately not tracked for conversions, so nothing here says what a paid click went on to do, and no conversion number for paid exists anywhere on this dashboard. ' +
    'Landing pageviews are the pageviews that opened a visit, decided from the referrer of the document itself with nothing stored. ' +
    'Rows written before either flag shipped carry an empty slot, which reads as not known to be one rather than as not one, so any window reaching back that far undercounts both. ' +
    'Both counters are probe filtered while Raw Visits above is not, so the two must not be divided into each other.';
  if (!attrNs2.prevUsable) {
    attrHint += ' Both flags went live ' + NS2_LIVE_DATE + ' and the previous period ends before that, so no delta is shown against a window that could hold nothing.';
  }
  html += '<div class="hint-banner">' + attrHint + '</div>';
  html += '<div class="grid">';
  var paidOpts = { hero: true, sub: 'clicks that arrived with the paid parameter. reach only, never a conversion' };
  var landingOpts = { sub: 'pageviews that opened a visit, ' + shareText(landings, arrivalsExProbe) + ' of probe-filtered arrivals (' + fmt(arrivalsExProbe) + ')' };
  if (attrNs2.prevUsable) { paidOpts.delta = paidArrivalsPrev; landingOpts.delta = landingsPrev; }
  html += kpi('Paid Arrivals', paidArrivals, paidOpts);
  html += kpi('Landing Pageviews', landings, landingOpts);
  html += '<div class="card"><div class="kpi-label">Paid, honestly</div><div style="margin-top:8px;font-size:0.8125rem;color:var(--tx2);line-height:1.5">The paid counter exists so paid reach can be read as a number without any of it being attached to a person. Judge paid on the Google Ads console, where the spend lives, and judge the product on the funnel, never by joining the two here.</div></div>';
  html += '</div>';

  // Content Reach removed: "Completions by Type" was SQL-identical to the
  // Engagement tab's "By Type" panel. Content consumption lives on Engagement.

  grid.innerHTML = html;
  document.getElementById('updated-adgrants').textContent = 'Updated ' + now();
}

// Consent prompt seen-vs-accepted, joined on one dimension (page path or
// language). Two independent counters, so the join happens here rather than in
// SQL. The per-row rate follows the same small-base rule as everywhere else:
// under 20 cards seen there is no rate worth printing, and the raw Seen and
// Accepted columns already carry the honest version.
function consentTable(dimLabel, shownRows, acceptRows, key, labelFn, cls) {
  var floor = 20;
  var accMap = {};
  (acceptRows || []).forEach(function(x) { if (x[key]) accMap[x[key]] = Number(x.c) || 0; });
  var body = (shownRows || []).filter(function(x) { return x[key]; }).map(function(x) {
    var seen = Number(x.c) || 0;
    var acc = accMap[x[key]] || 0;
    return [
      esc(labelFn(x[key])),
      fmt(seen),
      fmt(acc),
      seen >= floor ? Math.round(acc / seen * 100) + '%' : '--',
    ];
  });
  var caption = '<div class="kpi-sub" style="margin-top:6px;display:block">Accepts over seen, hidden under ' + floor + ' seen.</div>';
  return chartCard('Consent by ' + dimLabel.toLowerCase(),
    tableHtml([dimLabel, 'Seen', 'Accepted', 'Accepts / seen'], body) + caption, cls);
}

// --- Tab: Museum of Ages ---
// Cloudflare's own totals for the museum's zone, read by the worker. The site
// counts nothing itself, so this tab shows totals and never a visitor.

var MUS = { day: '', metric: 'arrivals', answer: null, hours: null, shell: false, view: 'now' };
var MUS_LANGS = { en: 'English', de: 'German', fr: 'French', it: 'Italian', es: 'Spanish', 'pt-BR': 'Portuguese (BR)', bg: 'Bulgarian' };
var MUS_KINDS = { front: 'Front page', wing: 'Wing page', topic: 'Topic page', about: 'About the museum', walk: 'The walk', privacy: 'Privacy', legal: 'Legal notice',
  'placed-g': 'Placed: grant ads', 'placed-p': 'Placed: paid search', 'placed-f': 'Placed: forum placement', 'placed-o': 'Placed: own posts', other: 'Other' };
var MUS_METRICS = [
  { key: 'arrivals', label: 'Arrivals' },
  { key: 'pages', label: 'Pages opened' },
  { key: 'started', label: 'Walks started' },
  { key: 'req', label: 'Requests' },
];
// What Cloudflare did not give, in the worker's own short names.
var MUS_GAPS = {
  token: 'Cloudflare refused the token. MUSEUM_CF_API_TOKEN needs Zone, Analytics, Read for the museum zone.',
  zone: 'The token does not see the zone. Check MUSEUM_ZONE_TAG and which zone the token is for.',
  daily: 'Cloudflare did not give the daily totals. The next refresh asks again.',
  countries: 'Cloudflare did not give the countries or the server errors with the daily totals.',
  visitors: 'Cloudflare gives different visitors per day only, not for a longer stretch.',
  pages: 'Cloudflare did not give page-level totals, so language, page kind and the walk are missing.',
  arrivals: 'Cloudflare did not give its visits figure, so arrivals are missing.',
  film: 'Cloudflare did not give the totals for the film files, so walks started and stops are missing.',
};

function musPad(n) { return n < 10 ? '0' + n : String(n); }
function musShiftDay(day, by) { return new Date(Date.parse(day + 'T12:00:00Z') + by * 86400000).toISOString().slice(0, 10); }
// Cloudflare cuts its days at midnight UTC. This is that moment on the reader's clock.
function musDayTurn(day) { return musPad(new Date(day + 'T00:00:00Z').getHours()) + ':00'; }
function musUtcDay(day) {
  var d = new Date(day + 'T12:00:00Z');
  return isNaN(d.getTime()) ? esc(day) : d.toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
function musFull(n) { return Number(n || 0).toLocaleString(); }
function musCell(v) { return v == null ? '<span class="mus-na">n/a</span>' : musFull(v); }
function musBytes(n) {
  n = Number(n || 0);
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB';
  if (n >= 1e3) return Math.round(n / 1e3) + ' KB';
  return n + ' B';
}
function musCountry(code) {
  try {
    var name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
    return name && name !== code ? name : code;
  } catch (e) { return code; }
}
function musStop(id, i) {
  var words = String(id).split('-').join(' ');
  return (i + 1) + '. ' + cap(words);
}
function musTable(headers, rows, wideOnly) {
  // First column is a name, the rest are figures. wideOnly lists the columns
  // a phone leaves out so the table fits without scrolling sideways.
  if (!rows.length) return '<div class="empty-state">No data yet</div>';
  var cls = function(i) {
    return (i > 0 ? 'mus-num' : 'mus-strong') + (wideOnly && wideOnly.indexOf(i) >= 0 ? ' mus-wide-only' : '');
  };
  var html = '<div class="tbl-wrap"><table class="mus-table"><tr>';
  headers.forEach(function(h, i) { html += '<th class="' + cls(i) + '">' + h + '</th>'; });
  html += '</tr>';
  rows.forEach(function(r) {
    html += '<tr>';
    r.forEach(function(cell, i) { html += '<td class="' + cls(i) + '">' + cell + '</td>'; });
    html += '</tr>';
  });
  return html + '</table></div>';
}
// Upright bars as plain boxes, so the names under them keep their size on a
// phone. every: name each n-th bar. tight: only the tallest bar says its figure.
function musBars(items, color, aria, every, tight) {
  if (!items.length) return '<div class="empty-state">No data yet</div>';
  var max = 0;
  items.forEach(function(d) { if (d.c > max) max = d.c; });
  var html = '<div class="mus-bars' + (tight ? ' tight' : '') + '" role="img" aria-label="' + esc(aria) + '">';
  items.forEach(function(d, i) {
    var h = max > 0 ? (d.c / max * 100) : 0;
    var says = (!tight && d.c > 0) || (d.c === max && max > 0);
    html += '<div class="mus-bar-col" title="' + esc(d.label) + ': ' + musFull(d.c) + '"><div class="mus-bar-plot">' +
      '<div class="mus-bar" style="height:' + h.toFixed(1) + '%;background:' + color + '">' +
      (says ? '<span class="mus-bar-n">' + fmt(d.c) + '</span>' : '') + '</div></div>' +
      '<span class="mus-bar-x">' + (i % (every || 1) === 0 ? esc(d.label) : '&nbsp;') + '</span></div>';
  });
  return html + '</div>';
}

async function loadMuseum() {
  var top = document.getElementById('top-museum');
  var a = null;
  try {
    var res = await fetch('/api/museum');
    a = await res.json();
  } catch (e) { a = null; }
  if (!a || a.error) {
    if (!MUS.answer) top.innerHTML = '<div class="empty-state">Cloudflare did not answer. The next refresh asks again.</div>';
    return;
  }
  if (!a.configured) {
    document.getElementById('hours-museum').innerHTML = '';
    document.getElementById('grid-museum').innerHTML = '';
    top.innerHTML = '<div class="placeholder"><h3>Not set up yet</h3><p>This panel reads the totals Cloudflare holds for the museum. It needs two secrets on this worker: MUSEUM_CF_API_TOKEN and MUSEUM_ZONE_TAG. Until both are set, nothing is asked.</p></div>';
    return;
  }
  MUS.answer = a;
  renderMuseum(a);
  document.getElementById('updated-museum').textContent = 'Updated ' + now();
  if (!MUS.day) MUS.day = a.today;
  if (!MUS.shell) renderMuseumHoursShell(a);
  loadMuseumHours();
}

function renderMuseum(a) {
  var f = a.frames;
  var openName = a.open ? musUtcDay(a.open) : '';
  var sinceLabel = 'Since ' + (a.open && a.reach.daily === a.open ? openName : musUtcDay(a.reach.daily));

  // What Cloudflare left out, said once at the top
  var alerts = '';
  var gaps = a.gaps || [];
  // A wrong token or zone explains every other gap, so it is the only line.
  if (gaps[0] === 'token' || gaps[0] === 'zone') gaps = [gaps[0]];
  gaps.forEach(function(g) {
    if (MUS_GAPS[g]) alerts += '<div class="alert-card a-warn">' + MUS_GAPS[g] + '</div>';
  });
  document.getElementById('alerts-museum').innerHTML = alerts;

  // The second stop's picture stands in for a real use: a visit that did
  // more than arrive. Null where Cloudflare gave no film totals.
  var second = a.stops && a.stops.length > 1 ? a.stops[1] : null;
  var use = {
    today: second ? second.today : null,
    week: second ? second.week : null,
    open: second ? second.open : null,
  };

  // --- The headline and the three frames ---
  var top = '<div class="mus-note">Cloudflare&rsquo;s totals for ' + esc(a.host) + '. The site counts nothing itself. Bots and crawlers are in every number, because Cloudflare&rsquo;s own bot filter is not applied. A day is Cloudflare&rsquo;s day: it turns at ' + musDayTurn(a.today) + ' your time.</div>';
  top += '<div class="grid mus-block">';
  if (f.today.arrivals == null && (a.gaps || []).indexOf('daily') < 0) {
    // Without Cloudflare's visits figure the nearest thing is pages opened.
    top += kpi('Pages opened today', f.today.pv, { hero: true, sub: 'Last 7 days ' + fmt(f.week.pv) + ' &middot; arrivals were not given' });
  } else {
    top += kpi('Arrivals today', f.today.arrivals == null ? 'n/a' : f.today.arrivals, {
      hero: true,
      sub: 'Last 7 days ' + (f.week.arrivals == null ? 'n/a' : fmt(f.week.arrivals)) + ' &middot; pages reached from outside the site',
    });
  }
  top += kpi('Walks started today', f.today.started == null ? 'n/a' : f.today.started, {
    hero: true,
    sub: 'Last 7 days ' + (f.week.started == null ? 'n/a' : fmt(f.week.started)) + ' &middot; the film began in a browser',
  });
  top += kpi('Second stop reached today', use.today == null ? 'n/a' : use.today, {
    hero: true,
    sub: 'Last 7 days ' + (use.week == null ? 'n/a' : fmt(use.week)) + ' &middot; stands in for real uses',
  });
  top += '</div>';

  var frameRows = [
    ['Arrivals', musCell(f.today.arrivals), musCell(f.week.arrivals), musCell(f.open.arrivals)],
    ['Pages opened', musCell(f.today.pv), musCell(f.week.pv), musCell(f.open.pv)],
    ['The walk opened', musCell(f.today.walks), musCell(f.week.walks), musCell(f.open.walks)],
    ['Walks started', musCell(f.today.started), musCell(f.week.started), musCell(f.open.started)],
    ['Second stop reached', musCell(use.today), musCell(use.week), musCell(use.open)],
    ['Different visitors', musCell(f.today.uniq), musCell(f.week.uniq), musCell(f.open.uniq)],
    ['Requests', musCell(f.today.req), musCell(f.week.req), musCell(f.open.req)],
    ['Data moved', musBytes(f.today.bytes), musBytes(f.week.bytes), musBytes(f.open.bytes)],
    ['Stopped by Cloudflare', musCell(f.today.stopped), musCell(f.week.stopped), musCell(f.open.stopped)],
    ['Server errors', musCell(f.today.err5), musCell(f.week.err5), musCell(f.open.err5)],
  ];
  var reachNote = a.reach.pagesSinceOpen ? '' : ' Cloudflare keeps arrivals and the walk for about a month, so the last column has no figure for them.';
  top += '<div class="mus-block">' + chartCard('Today, the last 7 days, since opening',
    musTable(['', 'Today', '7 days', sinceLabel], frameRows) +
    '<div class="mus-cap">Arrivals are what Cloudflare calls visits: a page opened from outside the site or straight from the address bar. ' +
    'Walks started counts how often the film&rsquo;s index was read, which only a browser running the walk does. ' +
    'Second stop reached counts how often the second stop&rsquo;s picture was asked for. It stands in for real uses, a visit that did more than arrive, and is not a count of people.' + reachNote + '</div>',
    'card-full') + '</div>';
  document.getElementById('top-museum').innerHTML = top;

  // --- By day ---
  var html = '<div class="section-divider">By day</div><div class="grid">';
  var dayItems = a.days.map(function(d) { return { label: musUtcDay(d.d), c: d.pv }; });
  html += chartCard('Pages opened per day', musBars(dayItems, 'var(--s-prism)', 'Pages opened per day', Math.ceil(dayItems.length / 8), dayItems.length > 16), 'card-wide');
  var dayRows = a.days.slice(-14).reverse().map(function(d) {
    return [musUtcDay(d.d), musCell(d.arrivals), musCell(d.pv), musCell(d.uniq), musCell(d.started)];
  });
  html += chartCard('Day by day', '<div class="mus-scroll">' + musTable(['Day', 'Arrivals', 'Pages', 'Visitors', 'Walks started'], dayRows) + '</div>', '');
  html += '</div>';

  // --- By language ---
  html += '<div class="section-divider">By language of the page</div><div class="grid">';
  if (a.byLang) {
    var langRows = a.byLang.map(function(l) {
      return [esc(MUS_LANGS[l.key] || l.key), musCell(l.today[0]), musCell(l.today[1]), musCell(l.week[0]), musCell(l.week[1])];
    });
    html += chartCard('Pages and arrivals by language',
      musTable(['Language', 'Pages today', 'Arrivals today', 'Pages 7 days', 'Arrivals 7 days'], langRows) +
      '<div class="mus-cap">The language of the page that was asked for, never the language of a browser.</div>',
      'card-wide');
    var langItems = a.byLang.map(function(l) { return { label: MUS_LANGS[l.key] || l.key, c: l.week[0] }; });
    html += chartCard('Pages, last 7 days', '<div class="mus-wide">' + barsHtml(langItems, 'var(--s-story)') + '</div>', '');
  } else {
    html += chartCard('Pages and arrivals by language', '<div class="empty-state">Cloudflare did not give page-level totals.</div>', 'card-full');
  }
  html += '</div>';

  // --- By kind of page, and countries ---
  html += '<div class="section-divider">By kind of page &middot; countries</div><div class="grid">';
  if (a.byKind) {
    var kindRows = a.byKind.map(function(k) {
      return [esc(MUS_KINDS[k.key] || k.key), musCell(k.today[0]), musCell(k.today[1]), musCell(k.week[0]), musCell(k.week[1])];
    });
    html += chartCard('Pages and arrivals by kind of page',
      musTable(['Kind', 'Pages today', 'Arrivals today', 'Pages 7 days', 'Arrivals 7 days'], kindRows) +
      '<div class="mus-cap">Placed: the addresses we put in our own ads and posts, /a/g/ (grant ads), /a/p/ (paid search), /a/f/ (forum placement) or /a/o/ (own posts) in front of a page or the walk. ' +
      'A page opened there counts in its row here, not under its own kind, and in its language above. A walk opened there counts among the walks opened.</div>',
      'card-wide');
  } else {
    html += chartCard('Pages and arrivals by kind of page', '<div class="empty-state">Cloudflare did not give page-level totals.</div>', 'card-wide');
  }
  var longer = a.reach.daily < a.reach.week;
  var lands = (longer ? a.countries.open : a.countries.week).slice(0, 10).map(function(c) { return { label: musCountry(c[0]), c: c[1] }; });
  html += chartCard('Top countries, ' + (longer ? 'since opening' : 'last 7 days'),
    '<div class="mus-wide">' + barsHtml(lands, 'var(--s-prism)') + '</div><div class="mus-cap">Requests by country, not people.</div>', '');
  html += '</div>';

  // --- The walk ---
  html += '<div class="section-divider">The walk</div><div class="grid">';
  var walkRows = [
    ['Opened', musCell(f.today.walks), musCell(f.week.walks)],
    ['Started', musCell(f.today.started), musCell(f.week.started)],
    ['Second stop reached', musCell(use.today), musCell(use.week)],
  ];
  html += chartCard('Opened, started, second stop', musTable(['', 'Today', '7 days'], walkRows) +
    '<div class="mus-cap">Started can stand above opened: the film&rsquo;s index is asked for at every start, also by a browser that still holds the page, and by our own checks of the site. ' +
    'In which language a walk was opened is not shown here. The address carries it after the question mark, and Cloudflare does not give that part on this plan.</div>', '');
  if (a.stops && a.stops.length) {
    var stopItems = a.stops.map(function(s, i) { return { label: musStop(s.id, i), c: s.week }; });
    html += chartCard('How far walks went, last 7 days',
      '<div class="mus-wide">' + barsHtml(stopItems, 'var(--s-wisdom)') + '</div>' +
      '<div class="mus-cap">How often each stop&rsquo;s picture was asked for. It stands in for stops reached: the player may fetch a picture a step ahead, and a browser that already holds a picture does not ask again.</div>',
      'card-wide');
  } else {
    html += chartCard('How far walks went', '<div class="empty-state">Cloudflare did not give the totals for the film files.</div>', 'card-wide');
  }
  html += '</div>';

  document.getElementById('grid-museum').innerHTML = html;
}

// --- One chosen day, hour by hour ---

function renderMuseumHoursShell(a) {
  var el = document.getElementById('hours-museum');
  el.innerHTML = '<div class="card card-full mus-block">' +
    '<div class="mus-head"><div class="kpi-label">Hour by hour</div>' +
    '<div class="mus-controls">' +
    '<button class="mus-btn" data-mus-step="-1" aria-label="The day before">&lsaquo;</button>' +
    '<input class="mus-date" id="mus-day" type="date" aria-label="Day">' +
    '<button class="mus-btn" data-mus-step="1" aria-label="The day after">&rsaquo;</button>' +
    '<button class="mus-btn" data-mus-step="0">Today</button>' +
    '</div></div>' +
    '<div id="mus-hours-body"><div class="empty-state">Loading the hours...</div></div></div>';
  var input = document.getElementById('mus-day');
  if (a.open) input.min = a.open;
  input.addEventListener('change', function() { if (input.value) musSetDay(input.value); });
  el.addEventListener('click', function(ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-mus-step], [data-mus-metric]') : null;
    if (!t) return;
    if (t.dataset.musMetric) { MUS.metric = t.dataset.musMetric; renderMuseumHours(); return; }
    var step = Number(t.dataset.musStep);
    musSetDay(step === 0 ? MUS.answer.today : musShiftDay(MUS.day, step));
  });
  MUS.shell = true;
}

function musSetDay(day) {
  var today = MUS.answer.today;
  if (day > today) day = today;
  if (MUS.answer.open && day < MUS.answer.open) day = MUS.answer.open;
  MUS.day = day;
  loadMuseumHours();
}

async function loadMuseumHours() {
  var day = MUS.day;
  var today = MUS.answer.today;
  var input = document.getElementById('mus-day');
  if (input) { input.value = day; input.max = today; }
  var next = document.querySelector('[data-mus-step="1"]');
  if (next) next.disabled = day >= today;
  var prev = document.querySelector('[data-mus-step="-1"]');
  if (prev) prev.disabled = !!(MUS.answer.open && day <= MUS.answer.open);
  var h = null;
  try {
    var res = await fetch('/api/museum/hours?day=' + day);
    h = await res.json();
  } catch (e) { h = null; }
  if (day !== MUS.day) return;
  MUS.hours = h && h.hours ? h : null;
  renderMuseumHours();
}

function renderMuseumHours() {
  var body = document.getElementById('mus-hours-body');
  if (!body) return;
  var h = MUS.hours;
  if (!h) { body.innerHTML = '<div class="empty-state">Cloudflare did not answer for this day.</div>'; return; }
  var metric = MUS.metric;
  var has = function(key) { return h.hours.some(function(r) { return r[key] != null; }); };
  if (!has(metric)) {
    var firstWith = MUS_METRICS.filter(function(m) { return has(m.key); })[0];
    if (firstWith) metric = firstWith.key;
  }
  if (!has(metric)) {
    body.innerHTML = '<div class="empty-state">Cloudflare no longer holds the hours of this day. Requests and visitors per hour reach back three days, page-level totals about a month.</div>';
    return;
  }
  var pills = '<div class="mus-controls" style="margin-top:10px" role="group" aria-label="What the bars show">';
  MUS_METRICS.forEach(function(m) {
    pills += '<button class="mus-btn' + (m.key === metric ? ' active' : '') + '" data-mus-metric="' + m.key + '"' + (has(m.key) ? '' : ' disabled') + '>' + m.label + '</button>';
  });
  pills += '</div>';

  var label = '';
  MUS_METRICS.forEach(function(m) { if (m.key === metric) label = m.label; });
  var total = 0, peak = -1, peakAt = '';
  var items = h.hours.map(function(r) {
    var hour = musPad(new Date(r.t).getHours());
    var c = r[metric] == null ? 0 : Number(r[metric]);
    total += c;
    if (c > peak) { peak = c; peakAt = hour; }
    return { label: hour, c: c };
  });
  var line = '<div class="mus-line"><b>' + musFull(total) + '</b> ' + label.toLowerCase() + ' on this day' +
    (peak > 0 ? ' &middot; busiest hour <b>' + peakAt + ':00</b> with ' + musFull(peak) : '') +
    ' &middot; hours on your clock, the day runs from ' + musDayTurn(MUS.day) + ' to ' + musDayTurn(MUS.day) + '</div>';
  var chart = musBars(items, 'var(--gold-subtle)', label + ' per hour', 1, true);

  var rowsHtml = h.hours.filter(function(r) {
    return r.req != null || r.pages != null;
  }).reverse().map(function(r) {
    return [musPad(new Date(r.t).getHours()) + ':00', musCell(r.arrivals), musCell(r.pages), musCell(r.walks), musCell(r.started), musCell(r.uniq), musCell(r.req)];
  });
  var gapNote = '';
  if ((h.gaps || []).indexOf('hourly-reach') >= 0) gapNote = '<div class="mus-cap">Cloudflare keeps visitors and requests per hour for three days only, so those two columns are empty for this day.</div>';
  body.innerHTML = pills + line + chart +
    '<div class="mus-scroll">' + musTable(['Hour', 'Arrivals', 'Pages', 'Walk opened', 'Walks started', 'Visitors', 'Requests'], rowsHtml, [3, 6]) + '</div>' + gapNote;
}

// --- Museum: trends ---
// How the museum's numbers move over the weeks, from two sources: Cloudflare's
// totals (bots included, a day is UTC) and the museum's own count (from its
// first day with rows). Charts are drawn at the width they are given, so their
// labels keep their size on a phone.

var TR = { cf: null, count: null, at: 0, range: 28, metric: 'started', split: 'lang', of: 'arrivals', src: 'walks', charts: {}, seq: 0, painted: false, marks: [] };
// A rate over fewer than this many is greyed and its line left out.
var TR_FLOOR = 20;
var TR_RANGES = [{ days: 28, label: '4 weeks' }, { days: 91, label: '13 weeks' }, { days: 0, label: 'Since opening' }];
var TR_METRICS = [
  { key: 'arrivals', label: 'Arrivals', cf: 'arrivals', keep: 'pages', cap: 'Pages opened from outside the site or straight from the address bar, as Cloudflare counts its visits. Bots and our own checks are in it.' },
  { key: 'opened', label: 'The walk opened', cf: 'walks', keep: 'pages', cap: 'The walk&rsquo;s page opened, as Cloudflare counts it. Bots are in it.' },
  { key: 'started', label: 'Walks started', cf: 'started', keep: 'pages', cap: 'The film&rsquo;s index read, which only a browser running the walk does. Our own checks of the site read it too.' },
  { key: 'second', label: 'Second stop reached', tag: 'stand-in', cf: 'second', keep: 'pages', cap: 'The second stop&rsquo;s picture asked for. It stands in for real uses: a browser that already holds the picture does not ask again.' },
  { key: 'pages', label: 'Pages opened', cf: 'pv', keep: 'daily', cap: 'Page views as Cloudflare counts them, bots included.' },
  { key: 'visitors', label: 'Different visitors', cf: 'uniq', keep: 'daily', cap: 'Cloudflare&rsquo;s estimate per day. A week&rsquo;s figure is its own estimate, not the sum of its days.' },
  { key: 'bytes', label: 'Data moved', cf: 'bytes', keep: 'daily', bytes: true, cap: 'What the site sent, the film included.' },
  { key: 'real', label: 'Real uses', tag: 'counted', count: function(c) { return c.stops && c.stops['3']; }, cap: 'Walks that reached the third stop, counted by the museum.' },
  { key: 'use', label: 'Uses', tag: 'counted', count: function(c) { return c.steps && c.steps.museum_use; }, cap: 'The count&rsquo;s use: the second stop or the first close look, once per walk.' },
  { key: 'walks', label: 'Walks opened', tag: 'counted', count: function(c) { return c.steps && c.steps.museum_arrival; }, cap: 'The walk opened in a browser, once per page load, counted by the museum.' },
  { key: 'site', label: 'Page arrivals', tag: 'counted', count: function(c) { return c.steps && c.steps.page_arrival; }, cap: 'A site page opened in a browser, once per page load.' },
  { key: 'reads', label: 'Page reads', tag: 'counted', count: function(c) { return c.steps && c.steps.page_read; }, cap: 'The middle of a page&rsquo;s text came into view.' },
  { key: 'doors', label: 'Door presses', tag: 'counted', count: function(c) { return c.steps && c.steps.door_press; }, cap: 'A link into the walk pressed, once per page load.' },
];
var TR_M = {};
TR_METRICS.forEach(function(m) { TR_M[m.key] = m; });
var TR_FAMILIES = [
  { key: 'direct', label: 'Direct', words: ['direct'] },
  { key: 'search', label: 'Search', words: ['search'] },
  { key: 'ads', label: 'Ads', words: ['ad_grant', 'ad_paid', 'ad_forum'] },
  { key: 'forum', label: 'Forums', words: ['forum'] },
  { key: 'social', label: 'Social and mail', words: ['social', 'mail'] },
  { key: 'other', label: 'Other links', words: ['code', 'edu', 'wiki', 'news', 'award', 'assistant', 'referral'] },
  { key: 'inside', label: 'From the site', words: [''] },
];
var TR_WORDS = { direct: 'Direct', search: 'Search', ad_grant: 'Ad, grant', ad_paid: 'Ad, paid', ad_forum: 'Ad in a forum', forum: 'Forum post', code: 'Code sites', edu: 'Schools', wiki: 'Wikis', news: 'News', mail: 'Mail', award: 'Awards, galleries', assistant: 'AI assistants', social: 'Social', referral: 'Other sites', '': 'From the site' };
var TR_COUNT_KINDS = { home: 'Front page', leonardo: 'Leonardo', inventions: 'Inventions', statement: 'About the museum', privacy: 'Privacy', imprint: 'Legal notice' };
var TR_HOLDS = { upright: 'Upright', sideways: 'Sideways', wide: 'Wide' };
var TR_DEVICES = { phone: 'Phone', tablet: 'Tablet', desktop: 'Desktop' };
var TR_GAPS = {
  stops: 'Cloudflare did not give the stops per day, so the second stop and how far walks go are missing here.',
  'stops-cut': 'Cloudflare cut the list of film pictures at its limit, so the stops may read low.',
  notes: 'MUSEUM_TREND_NOTES is not valid JSON, so the charts carry no marks.',
};

function trNul() { return null; }
function trDayMs(d) { return Date.parse(d + 'T00:00:00Z'); }
function trShift(d, by) { return new Date(trDayMs(d) + by * 86400000).toISOString().slice(0, 10); }
function trDates(from, to) {
  var out = [];
  for (var t = trDayMs(from); t <= trDayMs(to); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
function trSum(list) {
  var s = 0, any = false;
  list.forEach(function(v) { if (v != null) { s += v; any = true; } });
  return any ? s : null;
}
function trCfOk() { return !!(TR.cf && TR.cf.configured && TR.cf.days); }
function trCountOk() { return !!(TR.count && TR.count.state === 'ok' && TR.count.days); }
function trToday() {
  if (TR.cf && TR.cf.today) return TR.cf.today;
  if (TR.count && TR.count.today) return TR.count.today;
  return new Date().toISOString().slice(0, 10);
}
function trIndex(list) { var o = {}; list.forEach(function(d, i) { o[d] = i; }); return o; }
// A column of the count (aligned with its days) read on other dates: zero on
// a counted day without rows, nothing before the count began.
function trAlign(dates, col) {
  if (!trCountOk()) return dates.map(trNul);
  var idx = TR.cIdx;
  return dates.map(function(d) { var i = idx[d]; return i == null ? null : (col ? col[i] || 0 : 0); });
}
function trCfCol(dates, col) {
  if (!trCfOk()) return dates.map(trNul);
  var idx = TR.cfIdx;
  return dates.map(function(d) { var i = idx[d]; return i == null || col[i] == null ? null : col[i]; });
}
function trHas(m) {
  if (m.cf) return trCfOk();
  return trCountOk();
}
function trValues(key, dates) {
  var m = TR_M[key];
  if (m.cf) return trCfCol(dates, TR.cf ? TR.cf.days.map(function(r) { return r[m.cf]; }) : []);
  return trAlign(dates, trCountOk() ? m.count(TR.count) : null);
}
// Why a day has no figure, said in the chart and in its tooltip.
function trWhy(key, d) {
  var m = TR_M[key] || {};
  if (m.count || key === 'count') {
    return trCountOk() && d < TR.count.first ? 'not counted yet' : '';
  }
  if (!trCfOk()) return '';
  if (d < TR.cf.reach.daily) return TR.cf.open && d < TR.cf.open ? 'before the opening' : 'not kept';
  if (m.keep === 'pages' && (!TR.cf.reach.pages || d < TR.cf.reach.pages)) return 'not kept';
  return '';
}
function trDomain() {
  var today = trToday();
  var first = today;
  if (trCfOk() && TR.cf.days.length) first = TR.cf.days[0].d;
  if (trCountOk() && TR.count.first < first) first = TR.count.first;
  var from = TR.range ? trShift(today, -(TR.range - 1)) : first;
  if (from < first) from = first;
  return trDates(from, today);
}

// The last 7 full days against the 7 before. Today is never in it: half a day
// would read as a fall.
function trWeeks(get) {
  var today = trToday();
  var dates = trDates(trShift(today, -14), trShift(today, -1));
  var v = get(dates);
  var part = function(a) {
    var have = a.filter(function(x) { return x != null; });
    return { sum: have.length ? trSum(have) : null, days: have.length };
  };
  var prev = part(v.slice(0, 7)), last = part(v.slice(7));
  var t = get([today])[0];
  return { last: last.sum, lastDays: last.days, prev: prev.sum, prevDays: prev.days, today: t, from: dates[7], to: dates[13] };
}
function trWow(key) {
  var w = trWeeks(function(dates) { return trValues(key, dates); });
  // Different visitors over a week are Cloudflare's own figure, never a sum.
  if (key === 'visitors' && trCfOk()) {
    w.last = w.lastDays ? TR.cf.visitors.last : null;
    w.prev = w.prevDays ? TR.cf.visitors.prev : null;
  }
  return w;
}
function trDaysWord(n) { return n ? n + (n > 1 ? ' days' : ' day') : 'none'; }
function trFig(m, v) {
  if (v == null) return '<span class="mus-na">n/a</span>';
  return m && m.bytes ? musBytes(v) : musFull(Math.round(v));
}
function trDelta(cur, prev, bytes) {
  if (!bytes) return deltaHtml(cur, prev);
  var diff = cur - prev;
  if (!prev || !diff) return '<span class="kpi-delta flat">~0</span>';
  return '<span class="kpi-delta ' + (diff > 0 ? 'up' : 'down') + '">' + (diff > 0 ? '&#9650; +' : '&#9660; -') + musBytes(Math.abs(diff)) + ' (' + (diff > 0 ? '+' : '') + Math.round(diff / prev * 100) + '%)</span>';
}
function trChange(w, bytes) {
  if (w.lastDays === 7 && w.prevDays === 7 && w.prev != null) return trDelta(w.last, w.prev, bytes);
  return '<span class="kpi-delta flat">-</span>';
}
function trWowLine(key) {
  var m = TR_M[key];
  var w = trWow(key);
  if (!w.lastDays) {
    return '<div class="tr-wow">' + (w.today != null ? 'No full day yet &middot; today so far <b>' + trFig(m, w.today) + '</b>' : 'No full day yet') + '</div>';
  }
  var head = w.lastDays === 7 ? 'Last 7 full days' : 'The ' + w.lastDays + ' full day' + (w.lastDays > 1 ? 's' : '') + ' so far';
  var out = head + ' <b>' + trFig(m, w.last) + '</b>';
  if (w.lastDays === 7 && w.prevDays === 7) out += ' &middot; the 7 before ' + trFig(m, w.prev) + ' ' + trDelta(w.last, w.prev, m.bytes);
  else if (w.lastDays === 7 && w.prevDays > 0) out += ' &middot; only ' + w.prevDays + ' day' + (w.prevDays > 1 ? 's' : '') + ' before them (' + trFig(m, w.prev) + ')';
  else if (w.lastDays === 7) out += ' &middot; no week before them yet';
  return '<div class="tr-wow">' + out + '</div>';
}

// --- Drawing ---

function trNice(max) {
  if (!(max > 0)) return { top: 1, step: 1 };
  var raw = max / 3;
  var p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
  var f = raw / p;
  var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  if (step < 1 && max >= 1) step = 1;
  return { top: Math.ceil(max / step - 1e-9) * step, step: step };
}
function trTick(v, bytes) {
  if (bytes) return musBytes(v);
  if (v >= 1000) return fmt(v);
  return String(Math.round(v * 100) / 100);
}
function trShort(d) { return musUtcDay(d); }
function trAvg(values, dates, today) {
  return values.map(function(v, i) {
    if (dates[i] === today) return null;
    var have = [];
    for (var k = Math.max(0, i - 6); k <= i; k++) if (values[k] != null && dates[k] !== today) have.push(values[k]);
    if (have.length < 3) return null;
    return { v: trSum(have) / have.length, days: have.length };
  });
}
function trChart(spec, height) {
  var id = 'c' + (TR.seq++);
  TR.charts[id] = spec;
  spec.h = height;
  return '<div class="tr-chart" data-tr="' + id + '" style="height:' + height + 'px"></div>';
}
function trMarksOn(dates) {
  var idx = trIndex(dates);
  return TR.marks.filter(function(mk) { return idx[mk.day] != null; }).map(function(mk) { return { i: idx[mk.day], n: mk.n }; });
}
function trAimsOn(key) {
  var notes = TR.cf && TR.cf.notes;
  if (!notes || !notes.aims) return [];
  return notes.aims.filter(function(a) { return a.metric === key; }).map(function(a) {
    return { v: a.per === 'week' ? a.value / 7 : a.value, text: 'aim ' + (a.per === 'week' ? musFull(a.value) + ' a week' : musFull(a.value) + ' a day') + (a.label ? ', ' + a.label : '') };
  });
}
function trSvgOpen(w, h, id, aria) {
  return '<svg class="tr-svg" data-trs="' + id + '" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(aria) + '">' +
    '<defs><pattern id="hatch-' + id + '" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="tr-hatch" x1="0" y1="0" x2="0" y2="6"/></pattern></defs>';
}
function trYAxis(top, step, padL, w, y, bytes, compact) {
  var out = '';
  for (var v = 0; v <= top + 1e-9; v += step) {
    var yy = y(v).toFixed(1);
    out += '<line class="tr-gridline' + (v > 0 ? ' dash' : '') + '" x1="' + padL + '" x2="' + (w - 4) + '" y1="' + yy + '" y2="' + yy + '"/>';
    if (v > 0 && (!compact || v + step > top + 1e-9)) out += '<text x="' + (padL - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + trTick(v, bytes) + '</text>';
  }
  return out;
}

// Each mark: a dashed line on its day and a numbered circle above the plot.
// Circles that would touch move right, a short leader keeps them on their day.
function trMarkSvg(dates, cx, padT, bottom, w) {
  var out = '', lastX = -99;
  trMarksOn(dates).forEach(function(mk) {
    var x = cx(mk.i), at = Math.max(x, lastX + 17);
    if (at > w - 9) at = w - 9;
    lastX = at;
    out += '<line class="tr-mark" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + padT + '" y2="' + bottom + '"/>';
    if (Math.abs(at - x) > 1) out += '<line class="tr-mark-lead" x1="' + x.toFixed(1) + '" x2="' + at.toFixed(1) + '" y1="' + padT + '" y2="' + (padT - 3) + '"/>';
    out += '<circle class="tr-mark-dot" cx="' + at.toFixed(1) + '" cy="' + (padT - 10) + '" r="8"/><text class="tr-mark-n" x="' + at.toFixed(1) + '" y="' + (padT - 6.5) + '" text-anchor="middle">' + mk.n + '</text>';
  });
  return out;
}

// Daily bars with the 7-day average as the line that carries the eye.
var TR_DRAW = {};
TR_DRAW.daily = function(spec, w, id) {
  var h = spec.h, dates = spec.dates, vals = spec.values, n = dates.length, today = trToday();
  var compact = !!spec.compact;
  var avg = trAvg(vals, dates, today);
  var aims = compact ? [] : trAimsOn(spec.key);
  var max = spec.yMax || 0;
  if (!spec.yMax) {
    vals.forEach(function(v) { if (v != null && v > max) max = v; });
    aims.forEach(function(a) { if (a.v > max) max = a.v; });
  }
  var nice = trNice(max);
  var label = trTick(nice.top, spec.bytes);
  var padL = compact ? Math.max(22, label.length * 6.5 + 8) : Math.max(30, label.length * 7 + 10);
  var padT = compact ? 6 : 20, padB = compact ? 18 : 22, padR = 6;
  var plotW = w - padL - padR, bottom = h - padB;
  var step = plotW / Math.max(n, 1);
  var y = function(v) { return bottom - (v / nice.top) * (bottom - padT); };
  var cx = function(i) { return padL + (i + 0.5) * step; };
  spec.lay = { padL: padL, step: step, n: n, top: padT, bottom: bottom };
  var svg = trSvgOpen(w, h, id, spec.aria || '') + trYAxis(nice.top, nice.step, padL, w, y, spec.bytes, compact);
  // Days without a figure at the start: gone from Cloudflare, or before the count.
  var run = 0;
  while (run < n && vals[run] == null) run++;
  if (run > 0) {
    var why = trWhy(spec.key, dates[0]);
    var x1 = padL + run * step;
    svg += '<rect class="' + (why === 'not kept' ? 'tr-gone' : 'tr-none') + '" x="' + padL + '" y="' + padT + '" width="' + (x1 - padL).toFixed(1) + '" height="' + (bottom - padT).toFixed(1) + '" style="fill:url(#hatch-' + id + ')"/>';
    if (why && x1 - padL > 64 && !compact) svg += '<text class="tr-gone-lbl" x="' + ((padL + x1) / 2).toFixed(1) + '" y="' + ((padT + bottom) / 2).toFixed(1) + '" text-anchor="middle">' + why + '</text>';
  }
  var bw = Math.max(1, Math.min(step * 0.72, 28));
  vals.forEach(function(v, i) {
    if (v == null) return;
    var cut = v > nice.top;
    var yy = y(cut ? nice.top : v);
    var hh = Math.max(v > 0 ? 1 : 0, bottom - yy);
    svg += '<rect class="tr-bar' + (dates[i] === today ? ' today' : '') + '" x="' + (cx(i) - bw / 2).toFixed(1) + '" y="' + (bottom - hh).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hh.toFixed(1) + '"/>';
    if (cut) svg += '<path class="tr-clip" d="M' + (cx(i) - 3).toFixed(1) + ',' + (padT + 3) + ' L' + cx(i).toFixed(1) + ',' + padT + ' L' + (cx(i) + 3).toFixed(1) + ',' + (padT + 3) + '"/>';
  });
  // The average: dashed where fewer than 7 days stand behind it.
  var all = '', full = '', prevFull = false;
  avg.forEach(function(a, i) {
    if (!a) { prevFull = false; return; }
    var pt = cx(i).toFixed(1) + ',' + y(Math.min(a.v, nice.top)).toFixed(1);
    all += (all && avg[i - 1] ? ' L' : ' M') + pt;
    var isFull = a.days === 7;
    if (isFull) full += (prevFull ? ' L' : ' M') + pt;
    prevFull = isFull;
  });
  if (all) svg += '<path class="tr-avg thin" d="' + all + '"/>';
  if (full) svg += '<path class="tr-avg" d="' + full + '"/>';
  if (n === 1 || avg.filter(function(a) { return a; }).length === 1) {
    avg.forEach(function(a, i) { if (a) svg += '<circle class="tr-pt" cx="' + cx(i).toFixed(1) + '" cy="' + y(a.v).toFixed(1) + '" r="3"/>'; });
  }
  aims.forEach(function(a) {
    var yy = y(a.v).toFixed(1);
    svg += '<line class="tr-aim" x1="' + padL + '" x2="' + (w - padR) + '" y1="' + yy + '" y2="' + yy + '"/>' +
      '<text class="tr-aim-lbl" x="' + (w - padR) + '" y="' + (y(a.v) - 5).toFixed(1) + '" text-anchor="end">' + esc(a.text) + '</text>';
  });
  if (!compact) svg += trMarkSvg(dates, cx, padT, bottom, w);
  // Day names under the axis, as many as fit, the newest always.
  var every = compact ? Math.max(1, n - 1) : Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 58))));
  for (var i = n - 1; i >= 0; i -= every) {
    var anchor = i === n - 1 && compact ? 'end' : i === 0 && compact ? 'start' : 'middle';
    var tx = anchor === 'end' ? w - padR : anchor === 'start' ? padL : cx(i);
    if (anchor === 'middle' && (tx < padL + 18 || tx > w - 18)) continue;
    svg += '<text x="' + tx.toFixed(1) + '" y="' + (h - 5) + '" text-anchor="' + anchor + '">' + trShort(dates[i]) + '</text>';
  }
  if (compact && n > 1 && every === n - 1) svg += '<text x="' + padL + '" y="' + (h - 5) + '" text-anchor="start">' + trShort(dates[0]) + '</text>';
  svg += '<line class="tr-guide" x1="0" x2="0" y1="' + padT + '" y2="' + bottom + '"/><rect class="tr-hit" x="' + padL + '" y="0" width="' + plotW.toFixed(1) + '" height="' + h + '"/></svg>';
  spec.hit = function(x) {
    var i = Math.floor((x - padL) / step);
    if (i < 0 || i >= n) return null;
    var d = dates[i], v = vals[i], a = avg[i];
    var unit = spec.unit || '';
    var html = '<b>' + trShort(d) + (d === today ? ', today so far' : '') + '</b>';
    if (v == null) html += '<br>' + (trWhy(spec.key, d) || 'no figure');
    else {
      html += '<br>' + (spec.bytes ? musBytes(v) : musFull(v)) + ' ' + unit;
      if (a) html += '<br>7-day average ' + (spec.bytes ? musBytes(a.v) : (Math.round(a.v * 10) / 10).toLocaleString()) + (a.days < 7 ? ' (' + a.days + ' days)' : '');
    }
    TR.marks.forEach(function(mk) { if (mk.day === d) html += '<br><span class="tr-tip-mark">' + mk.n + '. ' + esc(mk.label) + '</span>'; });
    return { gx: cx(i), html: html };
  };
  return svg;
};

// Rates as points, the 7-day rate as the line. A point over fewer than
// TR_FLOOR is hollow, and the line stops where its week has fewer.
TR_DRAW.rate = function(spec, w, id) {
  var h = spec.h, dates = spec.dates, num = spec.num, den = spec.den, n = dates.length, today = trToday();
  var roll = dates.map(function(d, i) {
    if (d === today) return null;
    var a = 0, b = 0, days = 0;
    for (var k = Math.max(0, i - 6); k <= i; k++) {
      if (num[k] == null || den[k] == null || dates[k] === today) continue;
      a += num[k]; b += den[k]; days++;
    }
    return days >= 3 && b > 0 ? { r: a / b, a: a, b: b, days: days } : null;
  });
  var max = 0;
  dates.forEach(function(d, i) {
    if (den[i] >= TR_FLOOR && num[i] / den[i] > max) max = num[i] / den[i];
    if (roll[i] && roll[i].b >= TR_FLOOR && roll[i].r > max) max = roll[i].r;
  });
  // Each rate keeps its own scale from zero: three different questions.
  var scale = [[0.05, 0.01], [0.1, 0.025], [0.2, 0.05], [0.25, 0.05], [0.4, 0.1], [0.5, 0.1], [0.75, 0.25], [1, 0.25], [1.5, 0.5], [2, 0.5]];
  var top = 2, tick = 0.5;
  scale.some(function(t) { top = t[0]; tick = t[1]; return max <= t[0]; });
  var padL = 40, padT = 8, padB = 22, padR = 6;
  var plotW = w - padL - padR, bottom = h - padB;
  var step = plotW / Math.max(n, 1);
  var y = function(v) { return bottom - (Math.min(v, top) / top) * (bottom - padT); };
  var cx = function(i) { return padL + (i + 0.5) * step; };
  var svg = trSvgOpen(w, h, id, spec.aria || '');
  for (var v = 0; v <= top + 1e-9; v += tick) {
    var yy = y(v).toFixed(1);
    svg += '<line class="tr-gridline' + (v > 0 ? ' dash' : '') + '" x1="' + padL + '" x2="' + (w - 4) + '" y1="' + yy + '" y2="' + yy + '"/>';
    if (v > 0) svg += '<text x="' + (padL - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + Math.round(v * 1000) / 10 + '%</text>';
  }
  var run = 0;
  while (run < n && (den[run] == null)) run++;
  if (run > 0) {
    var why = trWhy(spec.key, dates[0]);
    var x1 = padL + run * step;
    svg += '<rect class="' + (why === 'not kept' ? 'tr-gone' : 'tr-none') + '" x="' + padL + '" y="' + padT + '" width="' + (x1 - padL).toFixed(1) + '" height="' + (bottom - padT).toFixed(1) + '" style="fill:url(#hatch-' + id + ')"/>';
    if (why && x1 - padL > 64) svg += '<text class="tr-gone-lbl" x="' + ((padL + x1) / 2).toFixed(1) + '" y="' + ((padT + bottom) / 2).toFixed(1) + '" text-anchor="middle">' + why + '</text>';
  }
  var line = '', on = false;
  roll.forEach(function(r, i) {
    if (!r || r.b < TR_FLOOR) { on = false; return; }
    line += (on ? ' L' : ' M') + cx(i).toFixed(1) + ',' + y(r.r).toFixed(1);
    on = true;
  });
  if (line) svg += '<path class="tr-rate" d="' + line + '"/>';
  dates.forEach(function(d, i) {
    if (den[i] == null || num[i] == null || den[i] === 0) return;
    var low = den[i] < TR_FLOOR;
    svg += '<circle class="tr-pt' + (low ? ' low' : '') + (d === today ? ' today' : '') + '" cx="' + cx(i).toFixed(1) + '" cy="' + y(num[i] / den[i]).toFixed(1) + '" r="' + (low ? 2.5 : 3) + '"/>';
  });
  trMarksOn(dates).forEach(function(mk) {
    var x = cx(mk.i).toFixed(1);
    svg += '<line class="tr-mark" x1="' + x + '" x2="' + x + '" y1="' + padT + '" y2="' + bottom + '"/>';
  });
  var every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 58))));
  for (var i = n - 1; i >= 0; i -= every) {
    if (cx(i) < padL + 18 && i !== n - 1) continue;
    svg += '<text x="' + Math.min(cx(i), w - 20).toFixed(1) + '" y="' + (h - 5) + '" text-anchor="middle">' + trShort(dates[i]) + '</text>';
  }
  svg += '<line class="tr-guide" x1="0" x2="0" y1="' + padT + '" y2="' + bottom + '"/><rect class="tr-hit" x="' + padL + '" y="0" width="' + plotW.toFixed(1) + '" height="' + h + '"/></svg>';
  spec.hit = function(x) {
    var i = Math.floor((x - padL) / step);
    if (i < 0 || i >= n) return null;
    var d = dates[i];
    var html = '<b>' + trShort(d) + (d === today ? ', today so far' : '') + '</b><br>';
    if (den[i] == null) html += trWhy(spec.key, d) || 'no figure';
    else html += trRateText(num[i], den[i]);
    if (roll[i]) html += '<br>7 days: ' + trRateText(roll[i].a, roll[i].b);
    TR.marks.forEach(function(mk) { if (mk.day === d) html += '<br><span class="tr-tip-mark">' + mk.n + '. ' + esc(mk.label) + '</span>'; });
    return { gx: cx(i), html: html };
  };
  return svg;
};
function trRateText(a, b, short) {
  if (!b) return short ? '0 of 0' : 'none to measure';
  if (b < TR_FLOOR) return musFull(a) + ' of ' + musFull(b) + (short ? '' : ', too few for a rate');
  return Math.round(a / b * 100) + '% (' + musFull(a) + ' of ' + musFull(b) + ')';
}

// How far walks go: a step line along the stops, last week as the ghost.
TR_DRAW.steps = function(spec, w, id) {
  var h = spec.h, cur = spec.cur, prev = spec.prev, names = spec.names, n = cur.length;
  var max = 0;
  cur.concat(prev || []).forEach(function(v) { if (v > max) max = v; });
  var nice = trNice(max);
  var label = trTick(nice.top);
  var padL = Math.max(30, label.length * 7 + 10), padT = 8, padB = 22, padR = 6;
  var plotW = w - padL - padR, bottom = h - padB;
  var step = plotW / Math.max(n, 1);
  var y = function(v) { return bottom - (v / nice.top) * (bottom - padT); };
  var svg = trSvgOpen(w, h, id, spec.aria || '') + trYAxis(nice.top, nice.step, padL, w, y);
  var stair = function(list) {
    var d = '';
    list.forEach(function(v, i) {
      var x0 = padL + i * step, x1 = x0 + step, yy = y(v || 0).toFixed(1);
      d += (i === 0 ? 'M' : ' L') + x0.toFixed(1) + ',' + yy + ' L' + x1.toFixed(1) + ',' + yy;
    });
    return d;
  };
  if (prev) svg += '<path class="tr-step-ghost" d="' + stair(prev) + ' L' + (padL + n * step).toFixed(1) + ',' + bottom + ' L' + padL + ',' + bottom + ' Z"/>';
  svg += '<path class="tr-step" d="' + stair(cur) + '"/>';
  var every = step < 22 ? 2 : 1;
  for (var i = 0; i < n; i++) {
    if (i % every && i !== n - 1) continue;
    svg += '<text x="' + (padL + (i + 0.5) * step).toFixed(1) + '" y="' + (h - 5) + '" text-anchor="middle">' + (i + 1) + '</text>';
  }
  svg += '<line class="tr-guide" x1="0" x2="0" y1="' + padT + '" y2="' + bottom + '"/><rect class="tr-hit" x="' + padL + '" y="0" width="' + plotW.toFixed(1) + '" height="' + h + '"/></svg>';
  spec.hit = function(x) {
    var i = Math.floor((x - padL) / step);
    if (i < 0 || i >= n) return null;
    var html = '<b>' + esc(names[i]) + '</b><br>' + spec.curLabel + ' ' + musFull(cur[i]) + (cur[0] > 0 ? ' (' + Math.round(cur[i] / cur[0] * 100) + '% of the first stop)' : '');
    if (prev) html += '<br>' + spec.prevLabel + ' ' + musFull(prev[i]);
    return { gx: padL + (i + 0.5) * step, html: html };
  };
  return svg;
};

// Weekly bars stacked by source family. A week the count does not cover
// whole is drawn lighter.
TR_DRAW.stack = function(spec, w, id) {
  var h = spec.h, weeks = spec.weeks, n = weeks.length;
  var max = 0;
  weeks.forEach(function(wk) { if (wk.total > max) max = wk.total; });
  var nice = trNice(max);
  var label = trTick(nice.top);
  var padL = Math.max(30, label.length * 7 + 10), padT = 8, padB = 22, padR = 6;
  var plotW = w - padL - padR, bottom = h - padB;
  var step = plotW / Math.max(n, 1);
  var bw = Math.min(step * 0.7, 56);
  var y = function(v) { return bottom - (v / nice.top) * (bottom - padT); };
  var svg = trSvgOpen(w, h, id, spec.aria || '') + trYAxis(nice.top, nice.step, padL, w, y);
  weeks.forEach(function(wk, i) {
    var x = padL + i * step + (step - bw) / 2, base = 0;
    TR_FAMILIES.forEach(function(f) {
      var v = wk.by[f.key] || 0;
      if (!v) return;
      var y0 = y(base), y1 = y(base + v);
      svg += '<rect class="tr-src-' + f.key + (wk.part ? ' part' : '') + '" x="' + x.toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, y0 - y1).toFixed(1) + '"/>';
      base += v;
    });
    if (wk.total > 0 && step > 26) svg += '<text class="tr-stack-n" x="' + (x + bw / 2).toFixed(1) + '" y="' + (y(wk.total) - 4).toFixed(1) + '" text-anchor="middle">' + fmt(wk.total) + '</text>';
  });
  var every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 64))));
  for (var i = n - 1; i >= 0; i -= every) {
    svg += '<text x="' + (padL + (i + 0.5) * step).toFixed(1) + '" y="' + (h - 5) + '" text-anchor="middle">' + trShort(weeks[i].to) + '</text>';
  }
  svg += '<line class="tr-guide" x1="0" x2="0" y1="' + padT + '" y2="' + bottom + '"/><rect class="tr-hit" x="' + padL + '" y="0" width="' + plotW.toFixed(1) + '" height="' + h + '"/></svg>';
  spec.hit = function(x) {
    var i = Math.floor((x - padL) / step);
    if (i < 0 || i >= n) return null;
    var wk = weeks[i];
    var html = '<b>' + trShort(wk.from) + ' to ' + trShort(wk.to) + '</b>' + (wk.part ? ' (counted from ' + trShort(wk.first) + ')' : '') + '<br>' + musFull(wk.total) + ' ' + spec.unit;
    TR_FAMILIES.slice().reverse().forEach(function(f) { if (wk.by[f.key]) html += '<br><span class="tr-sw tr-sw-' + f.key + '"></span>' + f.label + ' ' + musFull(wk.by[f.key]); });
    return { gx: padL + (i + 0.5) * step, html: html };
  };
  return svg;
};

function trPaint() {
  var any = false;
  Object.keys(TR.charts).forEach(function(id) {
    var el = document.querySelector('[data-tr="' + id + '"]');
    if (!el) return;
    var w = Math.floor(el.clientWidth);
    if (!w) return;
    any = true;
    var spec = TR.charts[id];
    el.innerHTML = TR_DRAW[spec.type](spec, w, id);
  });
  TR.painted = any;
}

// --- Pieces of the view ---

function trCard(title, body, cls, cap) {
  return '<div class="card tr-card ' + (cls || '') + '"><div class="kpi-label">' + title + '</div>' + body + (cap ? '<div class="mus-cap">' + cap + '</div>' : '') + '</div>';
}
function trDaily(key, dates, height, opts) {
  opts = opts || {};
  var m = TR_M[key] || {};
  return trChart({ type: 'daily', key: opts.whyKey || key, dates: dates, values: opts.values || trValues(key, dates), bytes: !!m.bytes || !!opts.bytes,
    unit: opts.unit || (m.label ? m.label.toLowerCase() : ''), compact: !!opts.compact, yMax: opts.yMax || 0, aria: opts.aria || (m.label || key) + ' per day' }, height);
}
function trPills(name, opts, cur) {
  return '<div class="mus-controls tr-pills" role="group">' + opts.map(function(o) {
    return '<button class="mus-btn' + (String(o.v) === String(cur) ? ' active' : '') + '" data-tr-' + name + '="' + o.v + '" aria-pressed="' + (String(o.v) === String(cur)) + '">' + o.label + '</button>';
  }).join('') + '</div>';
}
// Small multiples on one shared scale: each panel names its figure for the
// last 7 full days and the change against the 7 before.
function trMultiples(panels, dates, key, opts) {
  opts = opts || {};
  // One shared top, set by the typical days: a single day far above them is
  // cut at the top and marked, its figure stays in the tooltip.
  var all = [], avgTop = 0, today = trToday();
  panels.forEach(function(p) {
    p.values.forEach(function(v) { if (v != null) all.push(v); });
    trAvg(p.values, dates, today).forEach(function(a) { if (a && a.v > avgTop) avgTop = a.v; });
  });
  all.sort(function(a, b) { return a - b; });
  var max = all.length ? all[all.length - 1] : 0;
  var typical = all.length ? all[Math.floor((all.length - 1) * 0.97)] : 0;
  max = Math.min(max, Math.max(typical, avgTop * 1.25));
  if (all.length && all[all.length - 1] > max) TR.clipped = true;
  var out = '<div class="tr-multi">';
  panels.forEach(function(p) {
    var w = trWeeks(p.get);
    var fig = w.lastDays ? musFull(w.last) + (w.lastDays < 7 ? ' in ' + w.lastDays + 'd' : '') : 'n/a';
    out += '<div class="tr-panel"><div class="tr-panel-head"><span class="tr-panel-name">' + esc(p.label) + '</span><span class="tr-panel-fig">' + fig + ' ' + trChange(w) + '</span></div>' +
      trChart({ type: 'daily', key: key, dates: dates, values: p.values, compact: true, yMax: max || 1, unit: opts.unit || '', aria: p.label + ' per day' }, 92) + '</div>';
  });
  return out + '</div>';
}
// This week against last week as the dashboard's ghost bars.
function trGhost(items, unit) {
  var base = 1;
  items.forEach(function(it) { base = Math.max(base, it.value || 0, it.prev || 0); });
  if (!items.length) return '<div class="empty-state">No rows yet</div>';
  var out = '<div class="fbar-list tr-ghost">';
  items.forEach(function(it) {
    out += '<div class="fbar-row" title="' + esc(it.label) + ': ' + musFull(it.value) + ' ' + unit + (it.prev != null ? ', the 7 days before ' + musFull(it.prev) : '') + '">' +
      '<span class="fbar-labelwrap"><span class="fbar-label">' + esc(it.label) + '</span>' + (it.sub ? '<span class="fbar-sub2">' + it.sub + '</span>' : '') + '</span>' +
      '<div class="fbar-track">' + (it.prev != null ? '<div class="fbar-ghost" style="width:' + (it.prev / base * 100).toFixed(1) + '%"></div>' : '') +
      '<div class="fbar-fill" style="width:' + ((it.value || 0) / base * 100).toFixed(1) + '%"></div></div>' +
      '<span class="fbar-num"><span class="fbar-val">' + fmt(it.value || 0) + '</span>' + (it.prev != null && it.full ? deltaHtml(it.value || 0, it.prev) : '') + '</span></div>';
  });
  return out + '</div><div class="fbar-legend"><span class="swatch" style="background:var(--gold-subtle)"></span>' + TR.weekWords.cur +
    '<span class="swatch" style="background:color-mix(in srgb, var(--gold-deep) 22%, transparent)"></span>' + TR.weekWords.prev + '</div>';
}
// A count column summed over this week and the week before. Before the
// count's first full day, this week is today so far.
function trCountWeeks(col) {
  var w = trWeeks(function(dates) { return trAlign(dates, col); });
  if (!w.lastDays) return { value: w.today || 0, prev: null, full: false };
  return { value: w.last || 0, prev: w.prevDays ? w.prev || 0 : null, full: w.lastDays === 7 && w.prevDays === 7 };
}
function trKeysOf() {
  var seen = {};
  for (var a = 0; a < arguments.length; a++) Object.keys(arguments[a] || {}).forEach(function(k) { seen[k] = true; });
  return Object.keys(seen);
}

// --- The view ---

async function loadTrends() {
  var el = document.getElementById('trends-museum');
  if (TR.at && Date.now() - TR.at < 240000) {
    if (!TR.painted) renderTrends();
    return;
  }
  if (!TR.cf && !TR.count) el.innerHTML = '<div class="empty-state">Loading the trends...</div>';
  var got = await Promise.all([trFetch('/api/museum/trends'), trFetch('/api/museum/count')]);
  TR.cf = got[0];
  TR.count = got[1];
  TR.at = Date.now();
  TR.painted = false;
  if (S.tab !== 'museum' || MUS.view !== 'trends') return;
  renderTrends();
  document.getElementById('updated-museum').textContent = 'Updated ' + now();
}
function trFetch(path) {
  return fetch(path).then(function(r) { return r.json(); }).catch(function() { return null; });
}

function renderTrends() {
  var el = document.getElementById('trends-museum');
  TR.charts = {};
  TR.seq = 0;
  var cfOk = trCfOk(), cOk = trCountOk();
  TR.cfIdx = cfOk ? trIndex(TR.cf.days.map(function(r) { return r.d; })) : {};
  TR.cIdx = cOk ? trIndex(TR.count.days) : {};
  var today = trToday();
  var ws = trWeeks(function(d) { return d.map(trNul); });
  TR.weekWords = { cur: 'Last 7 full days', prev: 'The 7 before' };
  if (cOk && TR.count.first >= ws.from) TR.weekWords.cur = TR.count.first > ws.to ? 'Today so far' : 'Since ' + trShort(TR.count.first);

  // Marks: the private notes, and the day the count began.
  var notes = TR.cf && TR.cf.notes;
  var marks = notes && notes.events ? notes.events.slice() : [];
  if (cOk && !marks.some(function(e) { return e.day === TR.count.first; })) marks.push({ day: TR.count.first, label: 'The museum' + String.fromCharCode(39) + 's count begins' });
  marks.sort(function(a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : 0; });
  TR.marks = marks.map(function(e, i) { return { day: e.day, label: e.label, n: i + 1 }; });

  if (!cfOk && !cOk && !(TR.count && TR.count.state === 'empty')) {
    el.innerHTML = '<div class="placeholder"><h3>Nothing to show yet</h3><p>' + trCfState() + ' ' + trCountState() + '</p></div>';
    return;
  }
  var dates = trDomain();
  var html = '';

  // What the numbers are, how far back each reaches, and the marks.
  var alerts = '';
  if (TR.cf && TR.cf.gaps) {
    var gaps = TR.cf.gaps;
    if (gaps[0] === 'token' || gaps[0] === 'zone') gaps = [gaps[0]];
    gaps.forEach(function(g) { var t = TR_GAPS[g] || MUS_GAPS[g]; if (t) alerts += '<div class="alert-card a-warn">' + t + '</div>'; });
  }
  html += alerts;
  html += '<div class="mus-note">How the numbers move over the weeks. Cloudflare&rsquo;s totals include bots and our own checks, and a day is Cloudflare&rsquo;s day: it turns at ' + musDayTurn(today) + ' your time. ' +
    'The museum&rsquo;s own count leaves our own test browsers out. A bot that runs scripts can still be in it.</div>';
  html += '<div class="tr-head">' + trPills('range', TR_RANGES.map(function(r) { return { v: r.days, label: r.label }; }), TR.range) +
    '<div class="tr-reach">' + trReachText() + '</div></div>';
  if (TR.marks.length) {
    html += '<div class="tr-marks" aria-label="Marks on the time axis">' + TR.marks.map(function(mk) {
      return '<span class="tr-mark-key"><span class="tr-num">' + mk.n + '</span>' + trShort(mk.day) + ' &middot; ' + esc(mk.label) + '</span>';
    }).join('') + '</div>';
  } else if (TR.cf && !TR.cf.notes) {
    html += '<div class="tr-reach">No marks for posts or ads: the MUSEUM_TREND_NOTES secret is not set.</div>';
  }

  // --- Reach and use ---
  html += '<div class="section-divider">Reach and use</div><div class="tr-grid2">';
  if (cfOk) {
    html += trCard('Arrivals per day', trDaily('arrivals', dates, 220) + trWowLine('arrivals'), '', TR_M.arrivals.cap);
  } else {
    html += trCard('Arrivals per day', '<div class="empty-state">' + trCfState() + '</div>');
  }
  var fullCounted = cOk ? TR.count.days.length - 1 : 0;
  if (cOk && fullCounted >= 7) {
    html += trCard('Real uses per day', trDaily('real', dates, 220) + trWowLine('real'), '', TR_M.real.cap);
  } else if (cfOk) {
    html += trCard('Second stop reached per day, the stand-in', trDaily('second', dates, 220) + trWowLine('second'), '',
      TR_M.second.cap + (cOk ? ' The museum&rsquo;s count began ' + trShort(TR.count.first) + '. Real uses take this place after its first full week.' : ''));
  } else if (cOk) {
    html += trCard('Real uses per day', trDaily('real', dates, 220) + trWowLine('real'), '', TR_M.real.cap);
  }
  html += '</div>';

  // --- Every series ---
  var rows = TR_METRICS.filter(trHas);
  if (rows.length) {
    if (!TR_M[TR.metric] || !trHas(TR_M[TR.metric])) TR.metric = rows[0].key;
    var sel = TR_M[TR.metric];
    var listOf = function(title, group) {
      if (!group.length) return '';
      var out = '<div class="tr-index" role="group" aria-label="' + title + '"><div class="tr-row tr-row-head"><span>' + title + '</span><span>Last 7 full days</span><span class="tr-wide">The 7 before</span><span>Change</span></div>';
      group.forEach(function(m) {
        var w = trWow(m.key);
        var on = m.key === TR.metric;
        out += '<button class="tr-row' + (on ? ' active' : '') + '" data-tr-metric="' + m.key + '" aria-pressed="' + on + '"><span class="tr-row-name">' + m.label + (m.tag === 'stand-in' ? '<small>stand-in for real uses</small>' : '') + '</span>' +
          '<span class="mus-num">' + (w.lastDays === 7 ? trFig(m, w.last) : '<span class="mus-na">' + trDaysWord(w.lastDays) + '</span>') + '</span>' +
          '<span class="mus-num tr-wide">' + (w.prevDays === 7 ? trFig(m, w.prev) : '<span class="mus-na">' + trDaysWord(w.prevDays) + '</span>') + '</span>' +
          '<span class="mus-num">' + trChange(w, m.bytes) + '</span></button>';
      });
      return out + '</div>';
    };
    html += '<div class="section-divider">Every series</div>';
    html += '<div class="card card-full tr-card"><div class="kpi-label">' + sel.label + ' per day</div>' +
      trDaily(sel.key, dates, 240) + trWowLine(sel.key) + '<div class="mus-cap">' + sel.cap + ' ' + trKeepText(sel) + ' Choose another series below.</div>' +
      '<div class="tr-lists">' + listOf('Cloudflare&rsquo;s totals', rows.filter(function(m) { return m.cf; })) +
      listOf('Counted by the museum', rows.filter(function(m) { return m.count; })) + '</div></div>';
  }

  // --- Where the walk loses people ---
  html += '<div class="section-divider">Where the walk loses people</div>';
  var rate = function(title, numKey, denKey, cap) {
    var ready = trHas(TR_M[numKey]) && trHas(TR_M[denKey]);
    var body = ready ? trChart({ type: 'rate', key: numKey, dates: dates, num: trValues(numKey, dates), den: trValues(denKey, dates), aria: title }, 170) + trRateWow(numKey, denKey)
      : '<div class="empty-state">' + (TR_M[numKey].count ? 'From the museum&rsquo;s own count, once it has rows.' : trCfState()) + '</div>';
    return '<div class="tr-panel">' + '<div class="kpi-label">' + title + '</div>' + body + '<div class="mus-cap">' + cap + '</div></div>';
  };
  html += '<div class="card card-full tr-card"><div class="tr-rates">' +
    rate('Walks started per arrival', 'started', 'arrivals', 'Cloudflare. Arrivals hold many bots, so this rate runs low.') +
    rate('Second stop per walk started', 'second', 'started', 'Cloudflare. The second stop&rsquo;s picture against the film&rsquo;s index.') +
    rate('Third stop per walk opened', 'real', 'walks', 'The museum&rsquo;s count. The owner&rsquo;s real use.') +
    '</div><div class="mus-cap">Each dot is one day, the line its last 7 days. A hollow dot stands on fewer than ' + TR_FLOOR + ', and the line leaves out a week with fewer. Hover or tap for the day&rsquo;s figures.</div></div>';

  html += '<div class="grid tr-grid2">';
  if (cOk) {
    var cStops = TR.count.stops || {};
    var nStops = Math.max(cfOk && TR.cf.stops ? TR.cf.stops.ids.length : 0, 17);
    var cur = [], prev = [], anyPrev = false, full = true;
    for (var s = 1; s <= nStops; s++) {
      var cw = trCountWeeks(cStops[String(s)]);
      cur.push(cw.value); prev.push(cw.prev == null ? 0 : cw.prev);
      if (cw.prev != null) anyPrev = true;
      if (!cw.full) full = false;
    }
    html += trCard('How far walks go, counted', trChart({ type: 'steps', cur: cur, prev: anyPrev ? prev : null, names: trStopNames(nStops), curLabel: TR.weekWords.cur, prevLabel: TR.weekWords.prev, aria: 'Walks reaching each stop' }, 200) + trStepsKey(TR.weekWords.cur, anyPrev ? TR.weekWords.prev : ''), '',
      'Walks that reached each stop, counted by the museum. Stop 3 is a real use.');
  }
  if (cfOk && TR.cf.stops) {
    var ids = TR.cf.stops.ids;
    var col = function(k) { return function(dates2) { return trCfCol(dates2, TR.cf.stops.days.map(function(v) { return v ? v[k] : null; })); }; };
    var curS = [], prevS = [], anyP = false;
    ids.forEach(function(idv, k) {
      var w = trWeeks(col(k));
      curS.push(w.last || 0); prevS.push(w.prev || 0);
      if (w.prevDays) anyP = true;
    });
    html += trCard('How far walks go, the stand-in', trChart({ type: 'steps', cur: curS, prev: anyP ? prevS : null, names: ids.map(function(idv, k) { return musStop(idv, k); }), curLabel: 'Last 7 full days', prevLabel: 'The 7 before', aria: 'Pictures asked for at each stop' }, 200) + trStepsKey('Last 7 full days', anyP ? 'The 7 before' : ''), cOk ? '' : 'card-full',
      'How often each stop&rsquo;s picture was asked for. It stands in for stops reached: the player may fetch a picture a step ahead, and a browser that already holds a picture does not ask again.');
  }
  html += '</div>';

  // --- Languages and kinds of page ---
  if (cfOk && TR.cf.byLang) {
    var split = TR.split === 'kind' && TR.cf.byKind ? TR.cf.byKind : TR.cf.byLang;
    var names = TR.split === 'kind' ? MUS_KINDS : MUS_LANGS;
    var of = TR.of === 'pages' ? 'pages' : 'arrivals';
    var panels = split.filter(function(p) { return p[of].some(function(v) { return v; }) || TR.split !== 'kind'; }).map(function(p) {
      var colv = p[of];
      return { label: names[p.key] || cap(p.key), values: trCfCol(dates, colv), get: function(d2) { return trCfCol(d2, colv); } };
    });
    html += '<div class="section-divider">Languages and kinds of page</div>';
    html += '<div class="card card-full tr-card"><div class="mus-head"><div class="kpi-label">' + (of === 'pages' ? 'Pages opened' : 'Arrivals') + ' per day, by ' + (TR.split === 'kind' ? 'kind of page' : 'language of the page') + '</div>' +
      '<div class="mus-controls">' + trPills('split', [{ v: 'lang', label: 'Language' }, { v: 'kind', label: 'Kind of page' }], TR.split) +
      trPills('of', [{ v: 'arrivals', label: 'Arrivals' }, { v: 'pages', label: 'Pages' }], of) + '</div></div>' +
      trMultiples(panels, dates, 'arrivals', { unit: of === 'pages' ? 'pages' : 'arrivals' }) +
      '<div class="mus-cap">All panels share one scale, so a small language stays small. The figure beside each name is its last 7 full days. The language of the page asked for, never of a browser. Cloudflare keeps these ' + TR.cf.reach.pagesKeep + ' days.' + trClipText() + '</div></div>';
  }
  if (cOk) {
    if (!(cfOk && TR.cf.byLang)) html += '<div class="section-divider">Languages</div>';
    html += '<div class="grid tr-grid2">' +
      trCard('Walks by the walk&rsquo;s language, counted', trGhost(trSplitItems(TR.count.lang, MUS_LANGS), 'walks'), '', 'The language the walk was shown in. Under each name: real uses among the walks.') +
      trCard('Page arrivals by language, counted', trGhost(trSplitItems({ walks: TR.count.pages.lang }, MUS_LANGS), 'arrivals'), '', 'The language of the site page opened in a browser.') +
      '</div>';
  }

  // --- Countries ---
  if (cfOk && TR.cf.countries && TR.cf.countries.length) {
    var lands = TR.cf.countries.map(function(c) {
      return { label: musCountry(c.key), values: trCfCol(dates, c.req), get: function(d2) { return trCfCol(d2, c.req); } };
    });
    html += '<div class="section-divider">Countries</div><div class="card card-full tr-card"><div class="kpi-label">Requests per day, the top ' + lands.length + ' countries</div>' +
      trMultiples(lands, dates, 'pages', { unit: 'requests' }) +
      '<div class="mus-cap">Requests, not people: one walk asks for hundreds of files, so a country with a few walkers stands tall. Bots included. Cloudflare keeps these a year.' + trClipText() + '</div></div>';
  }

  // --- The museum's own count ---
  if (cOk) {
    html += '<div class="section-divider">Counted by the museum from ' + trShort(TR.count.first) + '</div>';
    html += trSources();
    html += '<div class="grid tr-grid2">' +
      trCard('Page arrivals by kind of page', trGhost(trPageKinds(), 'arrivals'), '', 'A site page opened in a browser. Under each name: how many read to the middle of the text.') +
      trCard('Door presses by kind of page and place', trDoors(), '', 'A link into the walk pressed, once per page load. Per arrival: presses against page arrivals of that kind, left out under ' + TR_FLOOR + '.') +
      trCard('Walks by how the screen was held', trGhost(trSplitItems(TR.count.hold, TR_HOLDS), 'walks'), '', 'Upright, sideways or wide, as the walk saw it.') +
      trCard('Walks by device', trGhost(trSplitItems(TR.count.device, TR_DEVICES), 'walks'), '', 'Worked out on the server from the browser&rsquo;s own description. The description itself is not kept.') +
      '</div>';
  } else {
    html += '<div class="section-divider">Counted by the museum</div>' + trCard('The museum&rsquo;s own count', '<div class="empty-state">' + trCountState() + '</div>', 'card-full');
  }
  if (TR.count && TR.count.gaps && TR.count.gaps.length) html += '<div class="mus-cap">Some of the count&rsquo;s questions did not answer: ' + esc(TR.count.gaps.join(', ')) + '. The next refresh asks again.</div>';

  el.innerHTML = html;
  trPaint();
}

function trClipText() {
  if (!TR.clipped) return '';
  TR.clipped = false;
  return ' A bar with a small cap on top runs past the shared scale. Hover or tap it for its figure.';
}
function trReachText() {
  var parts = [];
  if (trCfOk()) {
    var r = TR.cf.reach;
    parts.push('Requests, pages opened, visitors, data and countries reach ' + (r.dailyKeep >= 360 ? 'a year' : r.dailyKeep + ' days') + ' back.');
    parts.push('Arrivals, the walk, its stops, languages and kinds of page reach ' + r.pagesKeep + ' days back' + (r.pages && r.pages > r.daily ? ', so their lines start ' + trShort(r.pages) + ' and the hatched days before are not a drop.' : '.'));
  }
  if (trCountOk()) parts.push('The count keeps its rows three months.');
  return parts.join(' ');
}
function trKeepText(m) {
  if (m.count) return 'Counted from ' + trShort(TR.count.first) + ', rows kept three months.';
  if (!trCfOk()) return '';
  return m.keep === 'pages' ? 'Cloudflare keeps this ' + TR.cf.reach.pagesKeep + ' days.' : 'Cloudflare keeps this a year.';
}
function trCfState() {
  if (!TR.cf) return 'Cloudflare&rsquo;s totals did not answer. The next refresh asks again.';
  if (!TR.cf.configured) return 'Cloudflare&rsquo;s totals are not set up: MUSEUM_CF_API_TOKEN and MUSEUM_ZONE_TAG.';
  return '';
}
function trCountState() {
  var c = TR.count;
  if (!c) return 'The museum&rsquo;s count did not answer. The next refresh asks again.';
  var why = c.why ? ' <span class="mus-na">(' + esc(c.why) + ')</span>' : '';
  if (c.state === 'unset') return 'The museum&rsquo;s count is not set up here. It is read with CF_ACCOUNT_ID and CF_API_TOKEN, or with MUSEUM_COUNT_ACCOUNT_ID and MUSEUM_COUNT_API_TOKEN when the museum sits in another account.';
  if (c.state === 'refused') return 'Analytics Engine refused the token for the count&rsquo;s dataset ' + esc(c.dataset) + '. It needs Account Analytics Read on the account that holds it.' + why;
  if (c.state === 'empty') return 'No rows from the museum&rsquo;s count yet. Its charts appear here from the first day with rows.' + why;
  if (c.state === 'failed') return 'The museum&rsquo;s count did not answer. The next refresh asks again.' + why;
  return '';
}
function trRateWow(numKey, denKey) {
  var a = trWeeks(function(d) { return trValues(numKey, d); });
  var b = trWeeks(function(d) { return trValues(denKey, d); });
  if (!b.lastDays) return '<div class="tr-wow">No full day yet</div>';
  var out = (b.lastDays === 7 ? 'Last 7 full days ' : 'The ' + b.lastDays + ' full days so far ') + '<b>' + trRateText(a.last || 0, b.last || 0) + '</b>';
  if (b.lastDays === 7 && b.prevDays === 7 && b.last >= TR_FLOOR && b.prev >= TR_FLOOR) {
    var pp = Math.round(((a.last || 0) / b.last - (a.prev || 0) / b.prev) * 100);
    out += ' &middot; the 7 before ' + Math.round((a.prev || 0) / b.prev * 100) + '% of ' + musFull(b.prev) +
      ' <span class="kpi-delta ' + (pp > 0 ? 'up' : pp < 0 ? 'down' : 'flat') + '">' + (pp > 0 ? '+' : '') + pp + (Math.abs(pp) === 1 ? ' point' : ' points') + '</span>';
  }
  return '<div class="tr-wow">' + out + '</div>';
}
function trStopNames(n) {
  var ids = trCfOk() && TR.cf.stops ? TR.cf.stops.ids : [];
  var out = [];
  for (var i = 0; i < n; i++) out.push(ids[i] ? musStop(ids[i], i) : 'Stop ' + (i + 1));
  return out;
}
function trStepsKey(cur, prev) {
  return '<div class="fbar-legend"><span class="swatch" style="background:var(--gold)"></span>' + cur +
    (prev ? '<span class="swatch" style="background:color-mix(in srgb, var(--gold-deep) 22%, transparent)"></span>' + prev : '') +
    ' &middot; the stops in walk order along the bottom</div>';
}
// Walks (and real uses among them) per key of one of the row's fields.
function trSplitItems(pair, names) {
  if (!pair) return [];
  var keys = trKeysOf(pair.walks, pair.real);
  var order = Object.keys(names);
  keys.sort(function(a, b) { var ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  return keys.map(function(k) {
    var w = trCountWeeks(pair.walks && pair.walks[k]);
    var item = { label: names[k] || cap(k) || 'unnamed', value: w.value, prev: w.prev, full: w.full };
    if (pair.real) {
      var r = trCountWeeks(pair.real[k]);
      item.sub = 'real uses ' + trRateText(r.value, w.value, true);
    }
    return item;
  }).filter(function(it) { return it.value || it.prev; });
}
function trPageKinds() {
  var p = TR.count.pages;
  return trKeysOf(p.arrivals).sort().map(function(k) {
    var a = trCountWeeks(p.arrivals[k]), r = trCountWeeks(p.reads[k]);
    return { label: TR_COUNT_KINDS[k] || MUS_KINDS[k] || cap(k), value: a.value, prev: a.prev, full: a.full, sub: 'read ' + trRateText(r.value, a.value, true) };
  }).filter(function(it) { return it.value || it.prev; }).sort(function(a, b) { return b.value - a.value; });
}
function trDoors() {
  var d = TR.count.doors || {}, arr = TR.count.pages.arrivals || {};
  var places = ['top', 'item', 'end'];
  var rows = Object.keys(d).map(function(k) {
    var tot = 0;
    var cells = places.map(function(p) { var v = trCountWeeks(d[k][p]).value; tot += v; return musFull(v); });
    var a = trCountWeeks(arr[k]).value;
    return { tot: tot, row: [esc(TR_COUNT_KINDS[k] || MUS_KINDS[k] || cap(k))].concat(cells).concat([musFull(tot), trRateText(tot, a, true)]) };
  }).sort(function(a, b) { return b.tot - a.tot; }).map(function(r) { return r.row; });
  return musTable(['Kind', 'Top', 'Item', 'End', 'All', 'Per arrival'], rows, [1, 2, 3]) + '<div class="mus-cap">' + TR.weekWords.cur + '.</div>';
}
// Sources: stacked weekly bars by family, and a table of every word.
function trSources() {
  var c = TR.count, src = c.sources || { walks: {}, uses: {}, site: {} };
  var pick = TR.src === 'site' ? src.site : TR.src === 'uses' ? src.uses : src.walks;
  var unit = TR.src === 'site' ? 'page arrivals that began a visit' : TR.src === 'uses' ? 'uses' : 'walks opened';
  var fam = {};
  TR_FAMILIES.forEach(function(f) { f.words.forEach(function(w) { fam[w] = f.key; }); });
  var today = trToday(), y = trShift(today, -1);
  var weeks = [];
  for (var k = 0; k < 13; k++) {
    var to = trShift(y, -7 * k), from = trShift(to, -6);
    if (to < c.first) break;
    var by = {}, total = 0;
    trDates(from, to).forEach(function(d) {
      var i = TR.cIdx[d];
      if (i == null) return;
      Object.keys(pick).forEach(function(word) {
        var f = fam[word] || 'other';
        var v = pick[word][i] || 0;
        by[f] = (by[f] || 0) + v;
        total += v;
      });
    });
    weeks.unshift({ from: from, to: to, by: by, total: total, part: from < c.first, first: c.first });
  }
  var head = '<div class="mus-head"><div class="kpi-label">' + cap(unit) + ' per week, by source</div>' +
    trPills('src', [{ v: 'walks', label: 'Walks opened' }, { v: 'uses', label: 'Uses' }, { v: 'site', label: 'Page arrivals' }], TR.src) + '</div>';
  var legend = '<div class="tr-legend">' + TR_FAMILIES.filter(function(f) { return TR.src !== 'site' || f.key !== 'inside'; }).map(function(f) {
    return '<span><span class="tr-sw tr-sw-' + f.key + '"></span>' + f.label + '</span>';
  }).join('') + '</div>';
  var chart = weeks.length ? legend + trChart({ type: 'stack', weeks: weeks, unit: unit, aria: cap(unit) + ' per week by source' }, 220)
    : '<div class="empty-state">No full week yet. The first bar stands after the count&rsquo;s first full day. Today so far: ' + musFull(trSum(Object.keys(pick).map(function(w) { var i = TR.cIdx[today]; return i == null ? 0 : pick[w][i] || 0; })) || 0) + ' ' + unit + '.</div>';

  // The table: the last 28 full days, or what the count has of them.
  var from28 = trShift(y, -27), span = trDates(from28 < c.first ? c.first : from28, y);
  var useToday = !span.length || y < c.first;
  if (useToday) span = [today];
  var tot = function(series, word) {
    var s = 0;
    span.forEach(function(d) { var i = TR.cIdx[d]; if (i != null && series[word]) s += series[word][i] || 0; });
    return s;
  };
  var words = trKeysOf(src.walks, src.uses, src.site);
  var rows = words.map(function(wd) {
    var a = tot(src.site, wd), wlk = tot(src.walks, wd), u = tot(src.uses, wd);
    return { n: wlk + a, row: [esc(TR_WORDS[wd] != null ? TR_WORDS[wd] : wd), musFull(a), musFull(wlk), musFull(u), trRateText(u, wlk, true)] };
  }).filter(function(r) { return r.n > 0; }).sort(function(a, b) { return b.n - a.n; }).map(function(r) { return r.row; });
  var spanText = useToday ? 'today so far' : span.length === 28 ? 'the last 28 full days' : 'the ' + span.length + ' full day' + (span.length > 1 ? 's' : '') + ' since ' + trShort(span[0]);
  var table = musTable(['Source', 'Page arrivals', 'Walks opened', 'Uses', 'Uses per walk'], rows, [1]);
  return '<div class="card card-full tr-card">' + head + chart +
    '<div class="mus-cap">One word per visit, worked out when the visit begins. A walk opened from a page of the site after the first one carries no word and counts as From the site. A faded bar is a week the count does not cover whole.</div>' +
    '<div class="kpi-label" style="margin-top:16px">Every source, ' + spanText + '</div>' + table +
    '<div class="mus-cap">Uses are the count&rsquo;s museum_use: the second stop or the first close look. The third stop carries no source word, so real uses by source cannot be read. Under ' + TR_FLOOR + ' walks a rate is left out and the plain figures stand.</div></div>';
}

// --- Hover and tap ---

function trTip() {
  var t = document.getElementById('tr-tip');
  if (!t) {
    t = document.createElement('div');
    t.id = 'tr-tip';
    t.className = 'graph-tooltip tr-tip';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  return t;
}
function trTipHide() {
  var t = document.getElementById('tr-tip');
  if (t) t.style.opacity = '0';
  document.querySelectorAll('.tr-guide.on').forEach(function(g) { g.classList.remove('on'); });
}
function trTipAt(ev) {
  var svg = ev.target && ev.target.closest ? ev.target.closest('svg.tr-svg') : null;
  if (!svg) { trTipHide(); return; }
  var spec = TR.charts[svg.getAttribute('data-trs')];
  if (!spec || !spec.hit) return;
  var box = svg.getBoundingClientRect();
  var hit = spec.hit(ev.clientX - box.left);
  if (!hit) { trTipHide(); return; }
  document.querySelectorAll('.tr-guide.on').forEach(function(g) { g.classList.remove('on'); });
  var g = svg.querySelector('.tr-guide');
  if (g) { g.setAttribute('x1', hit.gx.toFixed(1)); g.setAttribute('x2', hit.gx.toFixed(1)); g.classList.add('on'); }
  var t = trTip();
  t.innerHTML = hit.html;
  t.style.opacity = '1';
  var tw = t.offsetWidth, th = t.offsetHeight;
  var x = box.left + hit.gx + 12;
  if (x + tw > window.innerWidth - 8) x = box.left + hit.gx - tw - 12;
  if (x < 8) x = 8;
  var top = box.top - th - 6;
  if (top < 8) top = Math.min(window.innerHeight - th - 8, ev.clientY + 16);
  t.style.left = x + 'px';
  t.style.top = top + 'px';
}
function trBind() {
  var root = document.getElementById('trends-museum');
  root.addEventListener('pointermove', function(ev) { if (ev.pointerType === 'mouse') trTipAt(ev); });
  root.addEventListener('pointerdown', function(ev) { if (ev.pointerType !== 'mouse') trTipAt(ev); });
  root.addEventListener('pointerleave', function() { trTipHide(); });
  root.addEventListener('click', function(ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-tr-metric], [data-tr-range], [data-tr-split], [data-tr-of], [data-tr-src]') : null;
    if (!b) return;
    if (b.dataset.trMetric) TR.metric = b.dataset.trMetric;
    else if (b.dataset.trRange != null) TR.range = Number(b.dataset.trRange);
    else if (b.dataset.trSplit) TR.split = b.dataset.trSplit;
    else if (b.dataset.trOf) TR.of = b.dataset.trOf;
    else if (b.dataset.trSrc) TR.src = b.dataset.trSrc;
    trTipHide();
    renderTrends();
  });
  document.getElementById('content').addEventListener('scroll', trTipHide, { passive: true });
  var timer = null;
  window.addEventListener('resize', function() {
    clearTimeout(timer);
    timer = setTimeout(function() { if (S.tab === 'museum' && MUS.view === 'trends') { trTipHide(); trPaint(); } }, 150);
  });
}

// Now and Trends inside the Museum tab, each with its own address.
function musMarkView() {
  document.getElementById('tab-museum').setAttribute('data-view', MUS.view);
  document.querySelectorAll('.mus-view').forEach(function(b) {
    var on = b.dataset.musView === MUS.view;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}
function musSetView(view, fromHash) {
  MUS.view = view === 'trends' ? 'trends' : 'now';
  musMarkView();
  trTipHide();
  if (S.tab !== 'museum') return;
  var want = MUS.view === 'trends' ? 'museum/trends' : 'museum';
  if (!fromHash && location.hash.replace('#', '') !== want) location.hash = want;
  loadTab('museum');
}
// --- end of trends ---

function switchTab(tab) {
  S.tab = tab;
  document.body.dataset.tab = tab;
  location.hash = tab === 'museum' && MUS.view === 'trends' ? 'museum/trends' : tab;

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
  else if (tab === 'museum') { if (MUS.view === 'trends') loadTrends(); else loadMuseum(); }
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
  var hash = location.hash.replace('#', '').split('/');
  if (['overview', 'servers', 'product', 'audio', 'adgrants', 'museum'].indexOf(hash[0]) >= 0) {
    S.tab = hash[0];
  }
  if (S.tab === 'museum' && hash[1] === 'trends') { MUS.view = 'trends'; musMarkView(); }

  document.body.dataset.tab = S.tab;
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
    var parts = location.hash.replace('#', '').split('/');
    var h = parts[0];
    var view = parts[1] === 'trends' ? 'trends' : 'now';
    if (h === 'museum' && view !== MUS.view) musSetView(view, true);
    if (h && h !== S.tab && ['overview', 'servers', 'product', 'audio', 'adgrants', 'museum'].indexOf(h) >= 0) {
      switchTab(h);
    }
  });
  document.querySelectorAll('.mus-view').forEach(function(el) {
    el.addEventListener('click', function() { musSetView(el.dataset.musView); });
  });
  trBind();

  // Start loading
  loadServerHealth();
  loadTab(S.tab);

  // Analytics auto-refresh (60s), paused while the tab is hidden so we do not
  // burn the query batch every minute on an unwatched dashboard.
  setInterval(function() {
    if (document.visibilityState === 'hidden') return;
    loadTab(S.tab);
  }, 60000);
  // Refresh immediately on return to visible, so a founder coming back never
  // reads stale numbers that look current.
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') loadTab(S.tab);
  });
}

init();
</script>
</body>
</html>`;
