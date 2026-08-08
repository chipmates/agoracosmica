import { FC, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseButton } from '../Button';
import useTranslation from '../../hooks/useTranslation';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { CatalogCouncil, getLocalizedTitle, getThemeAccentVar } from '../../data/councilCatalog';
import { getCouncilPlate } from './plates';
import { getCouncilOil } from './oils';
import { COUNCIL_OILS } from '../../config/features';
import { inkStyle } from './CouncilPlate';
import { shortRights, creditLineOf } from './plates/rights';

/**
 * Full-plate viewer: the entire uncropped work alone on the night, credit line
 * beneath, tap anywhere to close.
 *
 * An oil brings its own full tier and its own credit record, so it needs
 * neither glob. Engravings keep both: full masters live in
 * plates/full/<council-id>.ts and load on open only, and both globs tolerate
 * absent files, so a council without a full plate shows its wide card master
 * and the credit line waits for plates/credits.ts.
 *
 * The rights token is never assumed. Half these works are museum CC0
 * dedications and half are public-domain reproductions, so the line prints
 * whatever the object's own record asserts.
 */

interface FullPlate {
  full: string;
  aspect: number;
}

interface PlateCredit {
  institution: string;
  title: string;
  artist: string;
  date: string;
  objectUrl: string;
  rights: string;
  aspect: number;
}

const fullModules = import.meta.glob('./plates/full/*.ts') as Record<
  string,
  () => Promise<{ FULL_PLATE: FullPlate }>
>;

const creditModules = import.meta.glob('./plates/credits.ts', { eager: true }) as Record<
  string,
  { PLATE_CREDITS: Record<string, PlateCredit> }
>;
const PLATE_CREDITS: Record<string, PlateCredit> =
  Object.values(creditModules)[0]?.PLATE_CREDITS ?? {};

interface CouncilArtLightboxProps {
  council: CatalogCouncil;
  onClose: () => void;
}

const CouncilArtLightbox: FC<CouncilArtLightboxProps> = ({ council, onClose }) => {
  const { tString, language } = useTranslation();
  const trapRef = useFocusTrap({ onClose, enabled: true });
  const [plate, setPlate] = useState<{ src: string; aspect: number } | null>(null);

  const cardPlate = getCouncilPlate(council.id);
  const oil = COUNCIL_OILS ? getCouncilOil(council.id) : undefined;
  const credit = PLATE_CREDITS[council.id];
  const accentVar = getThemeAccentVar(council.theme);
  const title = getLocalizedTitle(council, language);

  useEffect(() => {
    let alive = true;
    setPlate(null);
    if (oil) return;
    const loader = fullModules[`./plates/full/${council.id}.ts`];
    if (loader) {
      loader()
        .then(m => {
          if (alive) setPlate({ src: m.FULL_PLATE.full, aspect: m.FULL_PLATE.aspect });
        })
        .catch(() => {});
    } else if (cardPlate) {
      // no full master yet: measure the wide card crop and show that
      const probe = new Image();
      probe.onload = () => {
        if (alive && probe.naturalHeight > 0) {
          setPlate({ src: cardPlate.wide, aspect: probe.naturalWidth / probe.naturalHeight });
        }
      };
      probe.src = cardPlate.wide;
    }
    return () => {
      alive = false;
    };
    // cardPlate is registry-stable per council id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [council.id]);

  return createPortal(
    <div
      ref={trapRef}
      className="council-art-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${tString('cosmicCouncil.artwork.label', 'Artwork')} — ${title}`}
      onClick={onClose}
      tabIndex={-1}
    >
      <CloseButton
        onClick={onClose}
        ariaLabel={tString('common.close', 'Close')}
        className="council-art-lightbox__close"
      />
      {oil && (
        <div className="council-art-lightbox__stage">
          {/* The painting sizes itself: no box is declared for it, so it can
              never be letterboxed inside one that guessed its proportion. */}
          <img className="council-art-lightbox__oil" src={oil.full} alt={oil.title} />
          <a
            className="council-art-lightbox__credit"
            href={oil.objectUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
          >
            {creditLineOf({
              institution: oil.institution,
              title: oil.title,
              artist: oil.artist,
              date: oil.year,
              rights: oil.rights,
            })}
          </a>
        </div>
      )}
      {!oil && plate && (
        <div className="council-art-lightbox__stage">
          <div
            className="council-art-lightbox__plate"
            style={{
              aspectRatio: String(plate.aspect),
              width: `min(92vw, 1100px, ${(78 * plate.aspect).toFixed(1)}vh)`,
            }}
          >
            <div
              className="council-art-lightbox__tone"
              style={{ background: `color-mix(in srgb, var(${accentVar}) 8%, var(--bg-card))` }}
            />
            <div
              className="council-art-lightbox__ink"
              style={inkStyle(accentVar, plate.src, '50% 50%')}
            />
            <div className="council-art-lightbox__keyline" />
          </div>
          {credit && (
            <a
              className="council-art-lightbox__credit"
              href={credit.objectUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
            >
              {creditLineOf({
                institution: credit.institution,
                title: credit.title,
                artist: credit.artist,
                date: credit.date,
                rights: shortRights(credit.rights),
              })}
            </a>
          )}
        </div>
      )}
    </div>,
    document.body
  );
};

export default CouncilArtLightbox;
