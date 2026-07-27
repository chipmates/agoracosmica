import React, { CSSProperties, FC } from 'react';
import { getCouncilPlate } from './plates';

/**
 * The plate window on a council card: the art layer the cartouche sits on.
 *
 * An ink plate carries marks only, the paper is dropped into the image's alpha,
 * so the card paints the marks with the theme accent at runtime. One asset per
 * crop serves every theme, and a palette change needs no re-bake.
 *
 * Both crops render and CSS picks by card ratio, which keeps the choice with
 * the media query that owns the geometry. Councils without a plate fall back to
 * their existing artwork component.
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
