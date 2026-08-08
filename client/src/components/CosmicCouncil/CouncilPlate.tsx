import React, { CSSProperties, FC } from 'react';
import { getCouncilPlate } from './plates';
import { getCouncilOil } from './oils';
import { COUNCIL_OILS } from '../../config/features';

/**
 * The plate window on a council card: the art layer the cartouche sits on.
 *
 * An ink plate carries marks only, the paper is dropped into the image's alpha,
 * so the card paints the marks with the theme accent at runtime. One asset per
 * crop serves every theme, and a palette change needs no re-bake.
 *
 * An oil is the opposite: it carries its own colour, so it renders as an image
 * and the theme accent stays on the chrome. Where a council has a baked oil and
 * the switch is on, the oil takes the window; everything else keeps its ink.
 *
 * The two differ in shape as well as in material. A cartouche over an ink
 * plate costs marks; over a painting it deletes the subject, which sits in the
 * middle of the canvas. So an oil gets a window nothing overlaps, one ratio at
 * every width, and one crop. Councils without a plate fall back to their
 * existing artwork component.
 */

interface CouncilPlateProps {
  councilId: string;
  accentVar: string;
  fallback?: React.ReactNode;
}

export const inkStyle = (accentVar: string, src: string, focal: string): CSSProperties => ({
  background: `var(${accentVar})`,
  WebkitMaskImage: `url(${src})`,
  maskImage: `url(${src})`,
  WebkitMaskPosition: focal,
  maskPosition: focal,
});

const CouncilPlate: FC<CouncilPlateProps> = ({ councilId, accentVar, fallback }) => {
  const plate = getCouncilPlate(councilId);
  const oil = COUNCIL_OILS ? getCouncilOil(councilId) : undefined;

  if (oil) {
    // The oil window is 16:9 at every width, which is the wide tier's own
    // shape, so one crop serves both and nothing is re-cut by the card.
    // A single-surface work has no honest wide cut, so it stands whole on the
    // card's tone instead, the way it already does in the sheet band.
    const src = oil.wideMasked ? oil.full : oil.wide;
    return (
      <div
        className="council-card__plate council-card__plate--oil"
        data-whole={oil.wideMasked ? 'true' : undefined}
        aria-hidden="true"
      >
        <div className="council-card__plate-tone" />
        <img
          className="council-card__plate-oil"
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ objectPosition: oil.wideFocal }}
        />
        <div className="council-card__plate-keyline" />
      </div>
    );
  }

  return (
    <div className="council-card__plate" aria-hidden="true">
      <div className="council-card__plate-tone" />
      {plate ? (
        <>
          <div
            className="council-card__plate-ink council-card__plate-ink--wide"
            style={inkStyle(accentVar, plate.wide, plate.focal)}
          />
          <div
            className="council-card__plate-ink council-card__plate-ink--square"
            style={inkStyle(accentVar, plate.square, plate.focal)}
          />
        </>
      ) : (
        <div className="council-card__plate-legacy">{fallback}</div>
      )}
      <div className="council-card__plate-keyline" />
    </div>
  );
};

export default CouncilPlate;
