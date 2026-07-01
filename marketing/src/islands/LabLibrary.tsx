// Compact "Library" island: a single framed object where the visitor selects
// one of the six ways to learn and its preview swaps in place. All six panels
// are server-rendered into static HTML (the five inactive ones carry the
// `hidden` attribute), so a crawler and a no-JS visitor both see every mode's
// prose; switching just toggles visibility client-side. Audio stops on switch
// via stopAllSamples() (panels no longer unmount, so it must be explicit).

import { useState, type KeyboardEvent } from 'react';
import LabSamplePlayer, { stopAllSamples } from './LabSamplePlayer';
import type { LibMode } from '../components/landing-lab/lab-library';

interface Labels {
  tablistAria: string;
  groupArc: string;
  groupMore: string;
  continueLabel: string;
  playDefault: string;
  footShowing: string; // contains the "{name}" placeholder
  footEvery: string;
  figuresHref: string;
}

interface Props {
  modes: LibMode[];
  portrait: string;
  figureName: string;
  figureId: string;
  labels: Labels;
}

export default function LabLibrary({ modes, portrait, figureName, figureId, labels }: Props) {
  const [active, setActive] = useState(modes[0]?.id);

  const arc = modes.filter(m => m.group !== 'more');
  const more = modes.filter(m => m.group === 'more');

  // Switch tabs. Panels stay mounted (all six are server-rendered), so pause any
  // playing sample explicitly rather than relying on unmount teardown.
  const switchTo = (id: string): void => {
    stopAllSamples();
    setActive(id);
  };

  // Roving arrow-key navigation across the flat tab order (both groups).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const ids = modes.map(m => m.id);
    const i = ids.indexOf(active ?? ids[0]);
    const next = e.key === 'ArrowRight' ? (i + 1) % ids.length : (i - 1 + ids.length) % ids.length;
    switchTo(ids[next]);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-tab-id="${ids[next]}"]`)?.focus();
  };

  const renderTab = (m: LibMode) => (
    <button
      key={m.id}
      type="button"
      role="tab"
      id={`lib-tab-${m.id}`}
      data-tab-id={m.id}
      aria-selected={m.id === active}
      aria-controls={`lib-panel-${m.id}`}
      tabIndex={m.id === active ? 0 : -1}
      className={`lib__tab ${m.id === active ? 'is-active' : ''}`}
      onClick={() => switchTo(m.id)}
    >
      <span className="lib__tab-name">{m.tab}</span>
      <span className="lib__tab-glyph">{m.glyph}</span>
    </button>
  );

  const renderPanel = (m: LibMode) => (
    <div
      key={m.id}
      className="lib__panel"
      role="tabpanel"
      id={`lib-panel-${m.id}`}
      aria-labelledby={`lib-tab-${m.id}`}
      hidden={m.id !== active}
    >
      <div className="lib__figure">
        <img className="lib__portrait" src={portrait} alt="" width="72" height="72" loading="lazy" decoding="async" />
        {m.cast && (
          <div className="lib__cast">
            {m.cast.map(c => (
              <img key={c.name} src={c.src} alt={c.name} title={c.name} width="34" height="34" loading="lazy" decoding="async" />
            ))}
          </div>
        )}
      </div>

      <div className="lib__body">
        {m.step && <p className="lib__step">{m.step}</p>}
        <p className="lib__kicker">{m.kicker}</p>
        <p className="lib__title">{m.title}</p>
        <p className="lib__text">{m.body}</p>

        {m.audioWebm && m.audioMp3 && (
          <LabSamplePlayer
            audioWebm={m.audioWebm}
            audioMp3={m.audioMp3}
            label={m.playLabel ?? labels.playDefault}
            duration={m.duration ?? ''}
            tasteSeconds={m.tasteSeconds}
            continueHref={m.linkHref}
            continueLabel={labels.continueLabel}
          />
        )}

        <div className="lib__meta">
          {m.scale && <span className="lib__scale">{m.scale}</span>}
          <a
            className="lib__link"
            href={m.linkHref}
            {...(m.linkHref.startsWith('/app')
              ? { 'data-agc-cta': 'start-exploring', 'data-agc-figure': figureId }
              : {})}
          >{m.linkLabel} →</a>
        </div>

        {m.disclosure && <p className="lib__disclosure">{m.disclosure}</p>}
      </div>
    </div>
  );

  return (
    <div className="lib">
      <div className="lib__tabs" role="tablist" aria-label={labels.tablistAria} onKeyDown={onKeyDown}>
        <div className="lib__tabgroup lib__tabgroup--arc">
          <span className="lib__tabgroup-label" aria-hidden="true">{labels.groupArc}</span>
          <div className="lib__tabgroup-row">{arc.map(renderTab)}</div>
        </div>
        <div className="lib__tabgroup lib__tabgroup--more">
          <span className="lib__tabgroup-label" aria-hidden="true">{labels.groupMore}</span>
          <div className="lib__tabgroup-row">{more.map(renderTab)}</div>
        </div>
      </div>

      {modes.map(renderPanel)}

      <div className="lib__foot">
        <span className="lib__foot-figure">{labels.footShowing.replace('{name}', figureName)}</span>
        <a className="lib__link" href={labels.figuresHref}>{labels.footEvery}</a>
      </div>
    </div>
  );
}
