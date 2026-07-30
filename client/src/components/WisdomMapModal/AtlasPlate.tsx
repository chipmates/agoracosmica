// AtlasPlate.tsx - The engraved plate of the Celestial Atlas.
//
// Proto B's winning language rendered from REAL app data: the constellation
// silhouette in faint construction lines (every segment of the authored
// pattern from ZodiacConstellation.ts), gathered links as lit gold hairlines,
// a dashed via sapientiae, graticule arcs, the tilted CARTOUCHE (translated
// constellation name, "after {figure}", "N of M stars gathered") and italic
// Caslon marginalia (the constellation's own translated description).
//
// Purely presentational: sits inside the atlas world layer, under the
// interactive DOM stars. All strings arrive translated via useTranslation.

import { FC, useMemo } from 'react';
import useTranslation from '../../hooks/useTranslation';
import { getConstellationTranslationKey } from '../../utils/constellationTranslationHelper';

interface PlateSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface AtlasPlateProps {
  width: number;
  height: number;
  segments: PlateSegment[];
  /** How many leading segments run between gathered stars (lit gold). */
  litCount: number;
  constellationName: string;
  constellationDescription: string;
  /** Figure name without the Echo prefix, for the cartouche epithet. */
  figureCleanName: string;
  gatheredCount: number;
  totalSeeds: number;
  /** All seeds gathered: the plate is complete (gold ink, inscription). */
  isComplete: boolean;
  /** Phones drop the cartouche and marginalia: they would sit on the stars.
   *  Their text moves to the info panel behind the toolbar. */
  showAnnotations?: boolean;
}

const AtlasPlate: FC<AtlasPlateProps> = ({
  width,
  height,
  segments,
  litCount,
  constellationName,
  constellationDescription,
  figureCleanName,
  gatheredCount,
  totalSeeds,
  isComplete,
  showAnnotations = true,
}) => {
  const { t, tString } = useTranslation();

  const nameKey = getConstellationTranslationKey(constellationName);
  const translatedName = nameKey ? tString(nameKey, constellationName) : constellationName;
  let translatedDescription = constellationDescription;
  if (nameKey) {
    const descKey = nameKey.replace('names.', 'descriptions.');
    const d = tString(descKey, constellationDescription);
    if (d && d !== descKey) translatedDescription = d;
  }

  const epithet = String(t('wisdomAtlas.after', { figure: figureCleanName }));
  const progressLine = String(
    t('wisdomAtlas.starsGathered', { gathered: gatheredCount, total: totalSeeds })
  );
  const completeLine = tString('wisdomAtlas.plateComplete', 'The plate is complete');

  // Graticule arcs and the via sapientiae, computed for this plate size.
  const paths = useMemo(() => {
    if (width < 2 || height < 2) return null;
    const grat: string[] = [];
    // three gentle horizontal arcs across the page
    for (const fy of [0.22, 0.5, 0.78]) {
      const y = height * fy;
      grat.push(`M 0 ${(y + 14).toFixed(1)} Q ${(width / 2).toFixed(1)} ${(y - 14).toFixed(1)} ${width.toFixed(1)} ${(y + 14).toFixed(1)}`);
    }
    // two meridian bends
    for (const fx of [0.3, 0.7]) {
      const x = width * fx;
      const bend = (fx - 0.5) * -36;
      grat.push(`M ${x.toFixed(1)} 0 Q ${(x + bend).toFixed(1)} ${(height / 2).toFixed(1)} ${x.toFixed(1)} ${height.toFixed(1)}`);
    }
    // The via sapientiae runs beneath the constellation. On portrait plates
    // the centered cartouche owns the lower band, so the via rides higher
    // there to keep its label readable. On phones the figure takes the whole
    // height instead, so the via drops to the foot and loses its label.
    const portrait = height > width * 1.2;
    const vy = height * (portrait ? (showAnnotations ? 0.78 : 0.94) : 0.86);
    const via = `M ${(-width * 0.05).toFixed(1)} ${(vy + height * 0.03).toFixed(1)} Q ${(width / 2).toFixed(1)} ${(vy - height * 0.055).toFixed(1)} ${(width * 1.05).toFixed(1)} ${(vy + height * 0.03).toFixed(1)}`;
    return { grat, via, viaLabelX: width * 0.4, viaLabelY: vy - height * 0.028 };
  }, [width, height, showAnnotations]);

  if (!paths) return null;

  return (
    <>
      <svg
        className={`atlas-plate ${isComplete ? 'is-complete' : ''}`}
        width="100%"
        height="100%"
        aria-hidden="true"
        focusable="false"
      >
        {/* graticule */}
        {paths.grat.map((d, i) => (
          <path key={`g-${i}`} d={d} className="atlas-graticule" />
        ))}

        {/* via sapientiae */}
        <path d={paths.via} className="atlas-via" />
        {showAnnotations && (
          <text x={paths.viaLabelX} y={paths.viaLabelY} className="atlas-via-label">
            via sapientiae
          </text>
        )}

        {/* construction-line silhouette: the whole figure, faintly present,
            the way an engraver leaves a figure unfinished */}
        {segments.map((s, i) => (
          <line
            key={`c-${i}`}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            className="atlas-construction"
          />
        ))}

        {/* lit links between gathered stars: hairline gold ink */}
        {segments.slice(0, Math.max(0, litCount)).map((s, i) => (
          <line
            key={`l-${i}`}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            className="atlas-link-lit"
          />
        ))}
      </svg>

      {showAnnotations && (
        <>
          {/* the tilted cartouche: real names, real counts */}
          <div className={`atlas-cartouche ${isComplete ? 'is-complete' : ''}`} aria-hidden="false">
            <span className="atlas-cartouche-star" aria-hidden="true">✦</span>
            <h3 className="atlas-cartouche-name">{translatedName}</h3>
            <p className="atlas-cartouche-epithet">{epithet}</p>
            <svg
              className="atlas-cartouche-flourish"
              viewBox="0 0 216 14"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M 0 8 Q 54 14 108 8 Q 162 2 216 8" />
            </svg>
            <p className="atlas-cartouche-progress">{progressLine}</p>
            {isComplete && <p className="atlas-cartouche-complete">{completeLine}</p>}
          </div>

          {/* marginalia: the constellation's own description, an annotation in
              the margin of the plate */}
          <p className="atlas-marginalia">{translatedDescription}</p>
        </>
      )}
    </>
  );
};

export default AtlasPlate;
