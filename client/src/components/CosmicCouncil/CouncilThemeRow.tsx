import { FC, useRef, useState, useEffect, useCallback } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import useTranslation from '../../hooks/useTranslation';
import { CatalogCouncil, CatalogTheme } from '../../data/councilCatalog';
import CouncilCard from './CouncilCard';

interface CouncilThemeRowProps {
  theme: CatalogTheme;
  councils: CatalogCouncil[];
  onSelect: (council: CatalogCouncil) => void;
}

const CouncilThemeRow: FC<CouncilThemeRowProps> = ({ theme, councils, onSelect }) => {
  const { tString } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, setCanScrollLeft] = useState(false);
  const [, setCanScrollRight] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Cache layout measurements — only recalculated on resize, not on scroll
  const layoutRef = useRef({ step: 0, cardCount: 0 });

  const updateLayout = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cards = el.querySelectorAll('.council-theme-row__card-wrapper');
    if (cards.length === 0) return;
    const cardWidth = (cards[0] as HTMLElement).offsetWidth;
    const gap = parseFloat(getComputedStyle(el).gap) || 0;
    layoutRef.current = { step: cardWidth + gap, cardCount: cards.length };
  }, []);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);

    const { step, cardCount } = layoutRef.current;
    if (step > 0 && cardCount > 0) {
      const idx = Math.round(el.scrollLeft / step);
      setActiveIndex(Math.min(idx, cardCount - 1));
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateLayout();
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(() => {
      updateLayout();
      updateScrollState();
    });
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [updateLayout, updateScrollState]);

  // On desktop: intercept wheel events on the horizontal scroll container
  // and forward vertical scroll to the modal, preventing the row from
  // capturing the scroll and causing micro-movement / blocking page scroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!window.matchMedia('(hover: hover)').matches) return;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        const modal = el.closest('.council-setup-modal');
        if (modal) {
          modal.scrollTop += e.deltaY;
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;

    const cards = el.querySelectorAll('.council-theme-row__card-wrapper');
    if (cards.length === 0) return;
    const cardWidth = (cards[0] as HTMLElement).offsetWidth;
    const gap = parseFloat(getComputedStyle(el).gap) || 0;
    const step = cardWidth + gap;

    if (dir === 'right') {
      if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 4) {
        // At end → loop to start
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: step, behavior: 'smooth' });
      }
    } else {
      if (el.scrollLeft <= 4) {
        // At start → loop to end
        el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: -step, behavior: 'smooth' });
      }
    }
  };

  if (councils.length === 0) return null;

  return (
    <div className="council-theme-row" data-theme={theme.id} role="region" aria-label={tString(theme.labelKey, theme.id)}>
      <div className="council-theme-row__header">
        <h3 className="council-theme-row__label">
          {tString(theme.labelKey, theme.id)}
        </h3>
        <div className="council-theme-row__bars" aria-hidden="true">
          {councils.map((_, i) => (
            <span
              key={i}
              className={`council-theme-row__bar ${i === activeIndex ? 'council-theme-row__bar--active' : ''}`}
            />
          ))}
        </div>
      </div>
      <div className="council-theme-row__scroll-container">
        <button
          className="council-theme-row__arrow council-theme-row__arrow--left"
          onClick={() => scroll('left')}
          aria-label="Scroll left"
          tabIndex={-1}
        >
          <CaretLeft size={18} weight="bold" />
        </button>
        <div ref={scrollRef} className="council-theme-row__scroll" role="list">
          {councils.map(council => (
            <div key={council.id} className="council-theme-row__card-wrapper" role="listitem">
              <CouncilCard council={council} onSelect={onSelect} />
            </div>
          ))}
        </div>
        <button
          className="council-theme-row__arrow council-theme-row__arrow--right"
          onClick={() => scroll('right')}
          aria-label="Scroll right"
          tabIndex={-1}
        >
          <CaretRight size={18} weight="bold" />
        </button>
      </div>
    </div>
  );
};

export default CouncilThemeRow;
