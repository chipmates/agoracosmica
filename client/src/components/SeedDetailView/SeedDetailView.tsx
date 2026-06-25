// SeedDetailView.tsx - Beautiful full-page reading view for seeds
// Replaces accordion view with reading-optimized design from test page
import { FC, useEffect, useRef, useState } from 'react';
import { Seed } from '../../types/global';
import useTranslation from '../../hooks/useTranslation';
import useResponsive from '../../hooks/useResponsive';
import { CloseButton } from '../Button';
import { Lightbulb, Target, Link, Books, Brain } from '@phosphor-icons/react';
import './SeedDetailView.css';

interface SeedDetailViewProps {
  seeds: Seed[];
  initialSeedNumber?: number; // Which seed to scroll to initially (1-based)
  onClose: () => void;
  figureName?: string; // For display
}

/**
 * SeedDetailView - Reading-optimized full-page view for all seeds
 * Features:
 * - Displays ALL seeds in scrollable reading layout
 * - Sticky navigation bar to jump between seeds
 * - Auto-scrolls to specific seed on mount
 * - Beautiful v3.0 design from test page
 */
export const SeedDetailView: FC<SeedDetailViewProps> = ({
  seeds,
  initialSeedNumber = 1,
  onClose,
  figureName = ''
}) => {
  const { tString } = useTranslation();
  const { isMobile } = useResponsive();
  const [activeSeedNumber, setActiveSeedNumber] = useState(initialSeedNumber);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});
  const seedRefs = useRef<{ [key: number]: HTMLElement | null }>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null); // Ref to .seed-detail-view (the scroll container)

  // Toggle collapsible section
  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Helper to render source (handles both string and object formats)
  const renderSource = (source: any): string => {
    if (typeof source === 'string') {
      return source;
    }
    if (typeof source === 'object' && source.text) {
      // Handle {text, edition/note} format
      if (source.edition) {
        return `${source.text} — ${source.edition}`;
      }
      if (source.note) {
        return `${source.text} (${source.note})`;
      }
      return source.text;
    }
    return String(source);
  };

  // Extract last name for display (same logic as WisdomMapModal)
  const getLastNameForDisplay = (name: string): string => {
    // Remove "Echo of/von/de/etc" prefix
    const prefixPattern = /^(Echo (of|von|de|del|di|des))\s+/i;
    const cleanName = name.replace(prefixPattern, '');

    // Special cases
    if (cleanName.includes('King Jr')) return 'King Jr.';
    if (cleanName.includes('Luther King')) return 'King';
    if (cleanName.includes('da Vinci')) return 'da Vinci';
    if (cleanName.includes('von Bingen')) return 'von Bingen';
    if (cleanName.includes('van Gogh')) return 'van Gogh';
    if (cleanName.includes('de Beauvoir')) return 'de Beauvoir';
    if (cleanName.toLowerCase().includes('zenji')) return 'Zenji';
    if (cleanName.includes('Lao')) return 'Laozi';
    if (cleanName.includes('Mark Aurel')) return 'Mark Aurel';

    // For regular names, return just the last part
    const parts = cleanName.split(' ');
    return parts[parts.length - 1];
  };

  const displayName = getLastNameForDisplay(figureName || '');

  // Auto-scroll to initial seed on mount
  useEffect(() => {
    // Delay to ensure refs are set and DOM is fully rendered
    const timer = setTimeout(() => {
      if (seedRefs.current[initialSeedNumber]) {
        scrollToSeed(initialSeedNumber);
      } else {
        // Retry after another delay
        setTimeout(() => {
          if (seedRefs.current[initialSeedNumber]) {
            scrollToSeed(initialSeedNumber);
          }
        }, 200);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [initialSeedNumber]);

  // Scroll to specific seed
  const scrollToSeed = (seedNumber: number) => {
    const seedElement = seedRefs.current[seedNumber];
    const scrollContainer = scrollContainerRef.current;

    if (!seedElement || !scrollContainer) {
      console.warn(`[SeedDetailView] Missing refs - seed: ${!!seedElement}, container: ${!!scrollContainer}`);
      return;
    }

    // Calculate offsets
    const navHeight = 76; // Sticky navigation bar height
    const cosmicHeaderHeight = window.innerWidth > 768 ? 76 : 0; // Desktop only
    const totalOffset = navHeight + cosmicHeaderHeight + 20; // Nav + header + buffer

    // Get element position relative to container's scroll position
    const containerRect = scrollContainer.getBoundingClientRect();
    const elementRect = seedElement.getBoundingClientRect();

    // Calculate scroll position within container
    const scrollPosition = scrollContainer.scrollTop + (elementRect.top - containerRect.top) - totalOffset;

    scrollContainer.scrollTo({
      top: scrollPosition,
      behavior: 'smooth'
    });

    setActiveSeedNumber(seedNumber);
  };

  // Track which seed is visible while scrolling
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const navHeight = 76;
          const threshold = navHeight + 100;

          // Find which seed is currently in view (check from bottom to top)
          for (let i = seeds.length; i >= 1; i--) {
            const seedElement = seedRefs.current[i];
            if (seedElement) {
              const rect = seedElement.getBoundingClientRect();
              // If top of seed is above the threshold, it's the active one
              if (rect.top <= threshold && rect.bottom > navHeight) {
                setActiveSeedNumber(i);
                break;
              }
            }
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    // Listen to scroll on the container element, not window!
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [seeds.length]);

  return (
    <div className="seed-detail-view" ref={scrollContainerRef}>
      {/* Close button - desktop only (mobile uses button in nav bar) */}
      {!isMobile && (
        <CloseButton
          onClick={onClose}
          size="medium"
          aria-label={tString('common.close', 'Close and return to map')}
          className="detail-view-close"
        />
      )}

      {/* Desktop Only: Cosmic Header with Figure Name */}
      <header className="cosmic-header">
        <h1 className="figure-name-cosmic">
          {displayName ? `${displayName}'s Wisdom` : 'Wisdom'}
        </h1>
      </header>

      {/* Sticky Navigation Bar */}
      <nav className="seed-navigator" role="navigation" aria-label="Seed navigation">
        <span className="seed-nav-label">{tString('seeds.navigation.jumpTo', 'Jump to:')}</span>

        <div className="nav-buttons-container">
          {seeds.map((seed, index) => {
            const seedNumber = index + 1;
            return (
              <button
                key={seed.id}
                className={`seed-nav-button ${seedNumber === activeSeedNumber ? 'active' : ''}`}
                onClick={() => scrollToSeed(seedNumber)}
                aria-label={`Jump to seed ${seedNumber}`}
              >
                {seedNumber}
              </button>
            );
          })}

          {/* Close button - matches seed button style on mobile */}
          <button
            className="seed-nav-button close-nav-button"
            onClick={onClose}
            aria-label={tString('common.close', 'Close and return to map')}
          >
            ×
          </button>
        </div>
      </nav>

      {/* Content Container */}
      <div className="container">
        <div className="content-wrapper">

          {seeds.map((seed, index) => {
            const seedNumber = index + 1;

            return (
              <article
                key={seed.id}
                className="seed"
                id={`seed-${seedNumber}`}
                data-seed-number={seedNumber}
                ref={(el) => { seedRefs.current[seedNumber] = el; }}
              >

                {/* Quote + Attribution */}
                {seed.quote && (
                  <div className="quote-container">
                    <div className="quote-mark">"</div>
                    <blockquote className="quote-text">{seed.quote}</blockquote>
                    {seed.sources?.primary?.[0] && (
                      <p className="quote-attribution">{renderSource(seed.sources.primary[0])}</p>
                    )}
                  </div>
                )}

                {/* Header */}
                <header className="detail-seed-header">
                  <div className="detail-seed-number">Wisdom #{seedNumber}</div>
                  <h2 className="detail-seed-title">{seed.title}</h2>

                  {/* Tags */}
                  {seed.tags && seed.tags.length > 0 && (
                    <div className="detail-seed-tags">
                      {seed.tags.map((tag, i) => (
                        <span key={i} className="detail-tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </header>

                <div className="seed-content">

                  {/* Summary */}
                  {seed.summary && (
                    <section className="section">
                      <p className="summary">{seed.summary}</p>
                    </section>
                  )}

                  {seed.summary && <hr className="section-divider" />}

                  {/* Overview (3-part structure) */}
                  {seed.overview && (
                    <>
                      <section className="section">
                        {seed.overview.concept && (
                          <div className="overview-section">
                            <p className="overview-text">{seed.overview.concept}</p>
                          </div>
                        )}
                        {seed.overview.context && (
                          <div className="overview-section">
                            <p className="overview-text">{seed.overview.context}</p>
                          </div>
                        )}
                        {seed.overview.relevance && (
                          <div className="overview-section">
                            <p className="overview-text">{seed.overview.relevance}</p>
                          </div>
                        )}
                      </section>
                      <hr className="section-divider" />
                    </>
                  )}

                  {/* Core Insights */}
                  {seed.coreInsights && seed.coreInsights.length > 0 && (
                    <>
                      <section className="section">
                        <h3 className="section-heading">
                          <Lightbulb size={24} weight="duotone" className="section-icon" />
                          {tString('seeds.sections.coreInsights', 'Key Insights')}
                        </h3>
                        <ul className="insight-list">
                          {seed.coreInsights.map((insight, i) => (
                            <li key={i}>{insight}</li>
                          ))}
                        </ul>
                      </section>
                      <hr className="section-divider" />
                    </>
                  )}

                  {/* Outcomes */}
                  {seed.outcomes && seed.outcomes.length > 0 && (
                    <>
                      <section className="section">
                        <h3 className="section-heading">
                          <Target size={24} weight="duotone" className="section-icon" />
                          {tString('seeds.sections.outcomes', 'What You\'ll Gain')}
                        </h3>
                        <ul className="outcome-list">
                          {seed.outcomes.map((outcome, i) => (
                            <li key={i}>{outcome}</li>
                          ))}
                        </ul>
                      </section>
                      <hr className="section-divider" />
                    </>
                  )}

                  {/* Featured Connection */}
                  {seed.connections && Array.isArray(seed.connections) && (() => {
                    const featured = seed.connections.find(c => c.featured) || seed.connections[0];
                    if (!featured) return null;
                    return (
                      <>
                        <section className="featured-connection">
                          <h3 className="section-heading">
                            <Link size={24} weight="duotone" className="section-icon" />
                            {tString('seeds.sections.featuredConnection', 'Featured Connection')}
                          </h3>
                          <div className="connection-header">
                            <span className="connection-star">★</span>
                            <span className={`connection-type-badge ${featured.type}`}>
                              {featured.type}
                            </span>
                            <span className="connection-figure">{featured.figure.charAt(0).toUpperCase() + featured.figure.slice(1)}</span>
                            {featured.seedTitle && (
                              <span className="connection-seed-title">— {featured.seedTitle}</span>
                            )}
                          </div>
                          <p className="connection-explanation">{featured.explanation}</p>
                        </section>
                        <hr className="section-divider" />
                      </>
                    );
                  })()}

                  {/* Related Connections (Collapsible) */}
                  {seed.connections && Array.isArray(seed.connections) && (() => {
                    const related = seed.connections.filter(c => !c.featured);
                    if (related.length === 0) return null;
                    return (
                      <>
                        <div className="collapsible-section">
                          <button
                            className="section-toggle"
                            aria-expanded={expandedSections[`${seed.id}-related-connections`] || false}
                            onClick={() => toggleSection(`${seed.id}-related-connections`)}
                          >
                            <span className="toggle-label">
                              <Link size={20} weight="duotone" className="section-icon" />
                              <span>{tString('seeds.sections.relatedConnections', 'Related Connections')}</span>
                              <span className="toggle-count">(+{related.length} more)</span>
                            </span>
                            <span className="toggle-icon">▶</span>
                          </button>
                          <div className={`collapsible-content ${expandedSections[`${seed.id}-related-connections`] ? 'expanded' : ''}`}>
                            <div className="related-connections-inner">
                              <h4 className="related-heading">{tString('seeds.sections.moreConnectedWisdom', 'More Connected Wisdom')}</h4>
                              {related.map((conn, i) => (
                                <div key={i} className="related-connection">
                                  <div className="related-connection-title">
                                    <span className={`connection-type-badge ${conn.type}`}>
                                      {conn.type}
                                    </span>
                                    {conn.figure.charAt(0).toUpperCase() + conn.figure.slice(1)} — {conn.seedTitle || conn.relationship}
                                  </div>
                                  <p className="related-connection-summary">
                                    {conn.summary || conn.explanation}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <hr className="section-divider" />
                      </>
                    );
                  })()}

                  {/* Sources & Verification (Collapsible) */}
                  {seed.sources && (seed.sources.primary || seed.sources.secondary || seed.sources.furtherReading) && (() => {
                    const totalSources = (seed.sources.primary?.length || 0) +
                                       (seed.sources.secondary?.length || 0) +
                                       (seed.sources.furtherReading?.length || 0);
                    return (
                      <>
                        <div className="collapsible-section">
                          <button
                            className="section-toggle"
                            aria-expanded={expandedSections[`${seed.id}-sources`] || false}
                            onClick={() => toggleSection(`${seed.id}-sources`)}
                          >
                            <span className="toggle-label">
                              <Books size={20} weight="duotone" className="section-icon" />
                              <span>{tString('seeds.sections.sourcesVerification', 'Sources & Verification')}</span>
                              <span className="toggle-count">({totalSources} sources)</span>
                            </span>
                            <span className="toggle-icon">▶</span>
                          </button>
                          <div className={`collapsible-content ${expandedSections[`${seed.id}-sources`] ? 'expanded' : ''}`}>
                            <div className="sources-inner">
                              {seed.sources.primary && seed.sources.primary.length > 0 && (
                                <div className="source-category">
                                  <h4 className="source-category-title">
                                    {tString('seeds.sections.primarySources', 'Primary Sources')}
                                  </h4>
                                  <ul className="source-list">
                                    {seed.sources.primary.map((source, i) => (
                                      <li key={i}>{renderSource(source)}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {seed.sources.secondary && seed.sources.secondary.length > 0 && (
                                <div className="source-category">
                                  <h4 className="source-category-title">
                                    {tString('seeds.sections.secondarySources', 'Secondary Sources')}
                                  </h4>
                                  <ul className="source-list">
                                    {seed.sources.secondary.map((source, i) => (
                                      <li key={i}>{renderSource(source)}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {seed.sources.furtherReading && seed.sources.furtherReading.length > 0 && (
                                <div className="source-category">
                                  <h4 className="source-category-title">
                                    {tString('seeds.sections.furtherReading', 'Further Reading')}
                                  </h4>
                                  <ul className="source-list">
                                    {seed.sources.furtherReading.map((source, i) => (
                                      <li key={i}>
                                        {source.title}
                                        {source.author && ` — ${source.author}`}
                                        {source.year && ` (${source.year})`}
                                        {source.type && (
                                          <span className="source-type-badge">
                                            {source.type}
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Optional Practice (Collapsible) */}
                  {seed.practicalSuggestion && (
                    <>
                      <div className="collapsible-section">
                        <button
                          className="section-toggle"
                          aria-expanded={expandedSections[`${seed.id}-practice`] || false}
                          onClick={() => toggleSection(`${seed.id}-practice`)}
                        >
                          <span className="toggle-label">
                            <Brain size={20} weight="duotone" className="section-icon" />
                            <span>{tString('seeds.sections.practice', 'Optional Practice')} (Outside App)</span>
                          </span>
                          <span className="toggle-icon">▶</span>
                        </button>
                        <div className={`collapsible-content ${expandedSections[`${seed.id}-practice`] ? 'expanded' : ''}`}>
                          <p className="practice-disclaimer">
                            {tString('seeds.practiceDisclaimer', 'This practice is outside Agora Cosmica\'s scope. Explore on your own if interested.')}
                          </p>
                          <p className="practice-text">{seed.practicalSuggestion}</p>
                        </div>
                      </div>
                    </>
                  )}

                </div>

                {/* Seed Separator (except for last seed) */}
                {index < seeds.length - 1 && (
                  <div className="seed-separator">
                    <div className="separator-ornament">✦ ✦ ✦</div>
                  </div>
                )}

              </article>
            );
          })}

        </div>
      </div>
    </div>
  );
};

export default SeedDetailView;
