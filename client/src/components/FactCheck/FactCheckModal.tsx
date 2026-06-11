// FactCheckModal.tsx - Figure-level factcheck view
// Full-screen modal showing comprehensive factcheck info for a figure
import React, { FC, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseButton } from '../Button';
import { useFactCheck, FactCheckStory, RealPerson, CompositeCharacter, FactCheckDialoguePattern } from '../../hooks/useFactCheck';
import { useTranslation } from '../../hooks/useTranslation';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  BookOpen,
  Users,
  Quotes,
  Archive,
  CaretDown,
  CaretUp,
  CheckCircle,
  Warning,
  Info,
  Calendar,
  User,
  MapPin,
  PencilSimple,
  Scroll,
  MoonStars,
  MaskHappy,
  Sparkle,
  HandHeart
} from '@phosphor-icons/react';
import './FactCheckModal.css';

interface FactCheckModalProps {
  figureId: string;
  figureName?: string;
  onClose: () => void;
}

/**
 * FactCheckModal - Full-screen modal for figure-level factcheck
 * Shows: bio, commitment, real people, composite characters, sources, quotes
 */
export const FactCheckModal: FC<FactCheckModalProps> = ({
  figureId,
  figureName,
  onClose
}) => {
  const { tString } = useTranslation();
  const trapRef = useFocusTrap({ onClose });
  const { factCheck, loading, error } = useFactCheck(figureId);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    dramaticLicense: true, // open by default — the key transparency section
    stories: false,
    councils: false,
    prisms: false,
    realPeople: false,
    compositeCharacters: false,
    quotes: false,
    sources: false,
    shadow: false
  });
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Helper to render content - all returns use portal
  const renderModal = (content: React.ReactNode) => {
    return createPortal(content, document.body);
  };

  if (loading) {
    return renderModal(
      <div className="factcheck-modal">
        <div className="factcheck-modal__loading">
          <div className="factcheck-modal__spinner" />
        </div>
      </div>
    );
  }

  if (error || !factCheck) {
    return renderModal(
      <div className="factcheck-modal">
        <div className="factcheck-modal__header">
          <CloseButton onClick={onClose} />
        </div>
        <div className="factcheck-modal__error">
          <Info size={32} />
          <p>No factcheck data available for this figure.</p>
        </div>
      </div>
    );
  }

  const { figure, foreword, stories, realPeople, compositeCharacters, sources, quotes, specialNote, commitment, shadow, dramaticLicense, councils, prisms, acknowledgments } = factCheck;

  // Helper — render a dialogue pattern card (reused in dramaticLicense, councils, prisms sections)
  const renderPatternCard = (pattern: FactCheckDialoguePattern, cardKey: string) => {
    const isExpanded = !!expandedCards[cardKey];
    const kindLabel = tString(`factCheck.kind.${pattern.kind}`, pattern.kind);
    return (
      <div key={cardKey} className="factcheck-story-card factcheck-story-card--pattern">
        <button
          className="factcheck-story-card__toggle"
          onClick={() => setExpandedCards(prev => ({ ...prev, [cardKey]: !prev[cardKey] }))}
          aria-expanded={isExpanded}
        >
          <div className="factcheck-story-card__header">
            <span
              className={`factcheck-pattern__pill factcheck-pattern__pill--${pattern.kind}`}
              aria-label={kindLabel}
            >
              {kindLabel}
            </span>
            <h3 className="factcheck-story-card__title">{pattern.pattern}</h3>
          </div>
          {isExpanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
        </button>
        {isExpanded && (
          <>
            <div className="factcheck-story-card__section">
              <h4>{tString('factCheck.basisLabel', 'What is documented')}</h4>
              <p>{pattern.basis}</p>
            </div>
            {pattern.note && (
              <div className="factcheck-story-card__note factcheck-story-card__note--no-icon">
                <p>{pattern.note}</p>
              </div>
            )}
            {pattern.appearances.length > 0 && (
              <div className="factcheck-story-card__section">
                <h4>{tString('factCheck.appearancesLabel', 'Appears in')}</h4>
                <ul className="factcheck-pattern__appearances">
                  {pattern.appearances.map((app, idx) => (
                    <li key={idx} className="factcheck-pattern__appearance">
                      <span className="factcheck-pattern__appearance-title">{app.title}</span>
                      <span className="factcheck-pattern__appearance-meta">
                        {' '}· {tString(`factCheck.role.${app.role}`, app.role)}
                        {app.turnOrder != null && ` · ${tString('factCheck.turn', 'turn')} ${app.turnOrder}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return renderModal(
    <div className="factcheck-modal" ref={trapRef} role="dialog" aria-modal="true" aria-label={tString('factCheck.facts')} tabIndex={-1}>
      {/* Header — matches Wisdom Map style */}
      <div className="factcheck-modal__header">
        <div className="factcheck-modal__title-group">
          <h1 className="factcheck-modal__title">
            {((figureName || figure.name).includes('Marc Aurel')
              ? 'Marc Aurel'
              : (figureName || figure.name).split(' ').pop()
            )?.toUpperCase()}'S {tString('factCheck.facts').toUpperCase()}
          </h1>
          <p className="factcheck-modal__subtitle">
            {figure.name} ({figure.dates})
          </p>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      {/* Scrollable content */}
      <div className="factcheck-modal__content">
        {/* Bio Section */}
        <section className="factcheck-section">
          <h2 className="factcheck-section__title">
            <BookOpen size={20} weight="duotone" />
            {tString('factCheck.bio')}
          </h2>
          <p className="factcheck-section__text">{figure.bio}</p>
        </section>

        {/* Commitment Statement */}
        <section className="factcheck-section factcheck-section--highlight">
          <h2 className="factcheck-section__title">
            <CheckCircle size={20} weight="duotone" />
            {tString('factCheck.commitment')}
          </h2>
          <p className="factcheck-section__text">{commitment}</p>
        </section>

        {/* Special Note (if present) */}
        {specialNote && (
          <section className="factcheck-section factcheck-section--note">
            <h2 className="factcheck-section__title">
              <Warning size={20} weight="duotone" />
              {specialNote.title}
            </h2>
            <p className="factcheck-section__text">{specialNote.content}</p>
          </section>
        )}

        {/* ─── STORIES MODE GROUP ─── */}
        <div className="factcheck-mode-header">{tString('factCheck.groupStories', 'Stories')}</div>

        {/* Stories - Collapsible */}
        {stories.length > 0 && (
          <section className="factcheck-section">
            <button
              className="factcheck-section__toggle"
              onClick={() => toggleSection('stories')}
              aria-expanded={expandedSections.stories}
            >
              <Scroll size={20} weight="duotone" />
              <span>{tString('factCheck.allStories')}</span>
              <span className="factcheck-section__count">({stories.length + (foreword ? 1 : 0)})</span>
              {expandedSections.stories ? <CaretUp size={16} /> : <CaretDown size={16} />}
            </button>
            {expandedSections.stories && (
              <div className="factcheck-stories">
                {/* Foreword as Story 0 */}
                {foreword && (
                  <div className="factcheck-story-card">
                    <button
                      className="factcheck-story-card__toggle"
                      onClick={() => setExpandedCards(prev => ({ ...prev, foreword: !prev.foreword }))}
                      aria-expanded={!!expandedCards.foreword}
                    >
                      <div className="factcheck-story-card__header">
                        <span className="factcheck-story-card__number">
                          {tString('factCheck.forewordSection', 'Foreword')}
                        </span>
                        <h3 className="factcheck-story-card__title">{foreword.title}</h3>
                      </div>
                      {expandedCards.foreword ? <CaretUp size={14} /> : <CaretDown size={14} />}
                    </button>

                    {expandedCards.foreword && (
                      <>
                        {foreword.documented.length > 0 && (
                          <div className="factcheck-story-card__section factcheck-story-card__section--documented">
                            <h4>
                              <CheckCircle size={14} weight="duotone" />
                              {tString('factCheck.documented')}
                            </h4>
                            <ul>
                              {foreword.documented.map((fact: string, i: number) => (
                                <li key={`fw-doc-${i}`}>{fact}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {foreword.notes && foreword.notes.length > 0 && (
                          <div className="factcheck-story-card__section">
                            {foreword.notes.map((note: string, i: number) => (
                              <div key={`fw-note-${i}`} className="factcheck-story-card__note factcheck-story-card__note--no-icon">
                                <p>{note}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {stories.map((story: FactCheckStory) => (
                  <div key={story.number} className="factcheck-story-card">
                    <button
                      className="factcheck-story-card__toggle"
                      onClick={() => setExpandedCards(prev => ({ ...prev, [`story-${story.number}`]: !prev[`story-${story.number}`] }))}
                      aria-expanded={!!expandedCards[`story-${story.number}`]}
                    >
                      <div className="factcheck-story-card__header">
                        <span className="factcheck-story-card__number">
                          {tString('factCheck.storyNumber').replace('{number}', String(story.number))}
                        </span>
                        <h3 className="factcheck-story-card__title">{story.title}</h3>
                      </div>
                      {expandedCards[`story-${story.number}`] ? <CaretUp size={14} /> : <CaretDown size={14} />}
                    </button>

                    {expandedCards[`story-${story.number}`] && (
                      <>
                        <div className="factcheck-story-card__meta">
                          <div className="factcheck-story-card__meta-item">
                            <Calendar size={14} />
                            <span>{story.year}</span>
                          </div>
                          <div className="factcheck-story-card__meta-item">
                            <User size={14} />
                            <span>{tString('factCheck.age')}: {story.age}</span>
                          </div>
                        </div>

                        <div className="factcheck-story-card__setting">
                          <MapPin size={14} />
                          <span>{story.setting}</span>
                        </div>

                        {story.documented.length > 0 && (
                          <div className="factcheck-story-card__section factcheck-story-card__section--documented">
                            <h4>
                              <CheckCircle size={14} weight="duotone" />
                              {tString('factCheck.documented')}
                            </h4>
                            <ul>
                              {story.documented.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {story.recreated.length > 0 && (
                          <div className="factcheck-story-card__section factcheck-story-card__section--recreated">
                            <h4>
                              <PencilSimple size={14} weight="duotone" />
                              {tString('factCheck.recreated')}
                            </h4>
                            <ul>
                              {story.recreated.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {story.note && (
                          <div className="factcheck-story-card__note factcheck-story-card__note--no-icon">
                            <p>{story.note}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Real People - Collapsible (in Stories group) */}
        <section className="factcheck-section">
          <button
            className="factcheck-section__toggle"
            onClick={() => toggleSection('realPeople')}
            aria-expanded={expandedSections.realPeople}
          >
            <Users size={20} weight="duotone" />
            <span>{tString('factCheck.realPeople')}</span>
            <span className="factcheck-section__count">({realPeople.length})</span>
            {expandedSections.realPeople ? <CaretUp size={16} /> : <CaretDown size={16} />}
          </button>
          {expandedSections.realPeople && (
            <ul className="factcheck-list">
              {realPeople.map((person: RealPerson, idx: number) => (
                <li key={idx} className="factcheck-list__item">
                  <strong>{person.name}</strong> — {person.role}
                  {person.note && <span className="factcheck-list__note"> ({person.note})</span>}
                  <span className="factcheck-list__stories">
                    Stories: {person.stories.join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Composite Characters - Collapsible */}
        {compositeCharacters.length > 0 && (
          <section className="factcheck-section">
            <button
              className="factcheck-section__toggle"
              onClick={() => toggleSection('compositeCharacters')}
              aria-expanded={expandedSections.compositeCharacters}
            >
              <Users size={20} weight="duotone" />
              <span>{tString('factCheck.compositeCharacters')}</span>
              <span className="factcheck-section__count">({compositeCharacters.length})</span>
              {expandedSections.compositeCharacters ? <CaretUp size={16} /> : <CaretDown size={16} />}
            </button>
            {expandedSections.compositeCharacters && (
              <ul className="factcheck-list">
                {compositeCharacters.map((char: CompositeCharacter, idx: number) => (
                  <li key={idx} className="factcheck-list__item">
                    <strong>{char.name}</strong> (Story {char.story})
                    <span className="factcheck-list__represents"> — {char.represents}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ─── PRISMS MODE GROUP ─── */}
        {prisms && prisms.patterns.length > 0 && (
          <>
            <div className="factcheck-mode-header">{tString('factCheck.groupPrisms', 'Prisms')}</div>
            <section className="factcheck-section">
              <button
                className="factcheck-section__toggle"
                onClick={() => toggleSection('prisms')}
                aria-expanded={expandedSections.prisms}
              >
                <Sparkle size={20} weight="duotone" />
                <span>{tString('factCheck.prismsSection', 'Prisms')}</span>
                <span className="factcheck-section__count">({prisms.appearancesCount})</span>
                {expandedSections.prisms ? <CaretUp size={16} /> : <CaretDown size={16} />}
              </button>
              {expandedSections.prisms && (
                <div className="factcheck-stories">
                  <p className="factcheck-section__text factcheck-section__text--intro">{prisms.approach}</p>
                  {prisms.patterns.map((p, idx) => renderPatternCard(p, `p-${idx}`))}
                  {prisms.documentedUsed && prisms.documentedUsed.length > 0 && (
                    <div className="factcheck-story-card factcheck-story-card--documented-list">
                      <h4>
                        <CheckCircle size={14} weight="duotone" />
                        {tString('factCheck.documentedUsedLabel', 'Documented events used')}
                      </h4>
                      <ul>
                        {prisms.documentedUsed.map((item, i) => <li key={i}>{item}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        )}

        {/* ─── COUNCILS MODE GROUP ─── */}
        {councils && councils.patterns.length > 0 && (
          <>
            <div className="factcheck-mode-header">{tString('factCheck.groupCouncils', 'Councils')}</div>
            <section className="factcheck-section">
              <button
                className="factcheck-section__toggle"
                onClick={() => toggleSection('councils')}
                aria-expanded={expandedSections.councils}
              >
                <Users size={20} weight="duotone" />
                <span>{tString('factCheck.councilsSection', 'Councils')}</span>
                <span className="factcheck-section__count">({councils.appearancesCount})</span>
                {expandedSections.councils ? <CaretUp size={16} /> : <CaretDown size={16} />}
              </button>
              {expandedSections.councils && (
                <div className="factcheck-stories">
                  <p className="factcheck-section__text factcheck-section__text--intro">{councils.approach}</p>
                  {councils.patterns.map((p, idx) => renderPatternCard(p, `c-${idx}`))}
                  {councils.documentedUsed && councils.documentedUsed.length > 0 && (
                    <div className="factcheck-story-card factcheck-story-card--documented-list">
                      <h4>
                        <CheckCircle size={14} weight="duotone" />
                        {tString('factCheck.documentedUsedLabel', 'Documented events used')}
                      </h4>
                      <ul>
                        {councils.documentedUsed.map((item, i) => <li key={i}>{item}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        )}

        {/* ─── ACROSS ALL MODES — cross-cutting synthesis ─── */}
        {dramaticLicense && dramaticLicense.patterns.length > 0 && (
          <>
            <div className="factcheck-mode-header">{tString('factCheck.groupAcrossModes', 'Across All Modes')}</div>
            <section className="factcheck-section factcheck-section--dramatic-license">
              <button
                className="factcheck-section__toggle"
                onClick={() => toggleSection('dramaticLicense')}
                aria-expanded={expandedSections.dramaticLicense}
              >
                <MaskHappy size={20} weight="duotone" />
                <span>{tString('factCheck.dramaticLicense', 'Recurring Patterns')}</span>
                <span className="factcheck-section__count">({dramaticLicense.patterns.length})</span>
                {expandedSections.dramaticLicense ? <CaretUp size={16} /> : <CaretDown size={16} />}
              </button>
              {expandedSections.dramaticLicense && (
                <div className="factcheck-stories">
                  <p className="factcheck-section__text factcheck-section__text--intro">{dramaticLicense.approach}</p>
                  {dramaticLicense.patterns.map((p, idx) => renderPatternCard(p, `dl-${idx}`))}
                </div>
              )}
            </section>
          </>
        )}

        {/* ─── REFERENCE GROUP ─── */}
        <div className="factcheck-mode-header">{tString('factCheck.groupReference', 'Reference')}</div>

        {/* Quotes Approach */}
        <section className="factcheck-section">
          <button
            className="factcheck-section__toggle"
            onClick={() => toggleSection('quotes')}
            aria-expanded={expandedSections.quotes}
          >
            <Quotes size={20} weight="duotone" />
            <span>{tString('factCheck.quotesApproach')}</span>
            {expandedSections.quotes ? <CaretUp size={16} /> : <CaretDown size={16} />}
          </button>
          {expandedSections.quotes && (
            <div className="factcheck-quotes">
              <p className="factcheck-section__text">{quotes.approach}</p>
              {quotes.documented.length > 0 && (
                <ul className="factcheck-quotes__list">
                  {quotes.documented.map((q, idx) => (
                    <li key={idx} className="factcheck-quotes__item">
                      <blockquote>"{q.quote}"</blockquote>
                      <cite>— {q.source}</cite>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* Sources - Collapsible */}
        <section className="factcheck-section">
          <button
            className="factcheck-section__toggle"
            onClick={() => toggleSection('sources')}
            aria-expanded={expandedSections.sources}
          >
            <Archive size={20} weight="duotone" />
            <span>{tString('factCheck.sources')}</span>
            {expandedSections.sources ? <CaretUp size={16} /> : <CaretDown size={16} />}
          </button>
          {expandedSections.sources && (
            <div className="factcheck-sources">
              {sources.primary.length > 0 && (
                <div className="factcheck-sources__group factcheck-sources__group--primary">
                  <h3>{tString('factCheck.primarySources')}</h3>
                  <ul>
                    {sources.primary.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {sources.scholarly.length > 0 && (
                <div className="factcheck-sources__group factcheck-sources__group--scholarly">
                  <h3>{tString('factCheck.scholarlySources')}</h3>
                  <ul>
                    {sources.scholarly.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {sources.archives.length > 0 && (
                <div className="factcheck-sources__group factcheck-sources__group--archives">
                  <h3>{tString('factCheck.archives')}</h3>
                  <ul>
                    {sources.archives.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {foreword && foreword.sources.length > 0 && (
                <div className="factcheck-sources__group factcheck-sources__group--foreword">
                  <h3>{tString('factCheck.forewordSection', 'Foreword')}</h3>
                  <ul>
                    {foreword.sources.map((s: string, idx: number) => (
                      <li key={`fw-${idx}`}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {sources.shadow && sources.shadow.length > 0 && (
                <div className="factcheck-sources__group factcheck-sources__group--shadow">
                  <h3>{tString('factCheck.shadow', 'Shadow')}</h3>
                  <ul>
                    {sources.shadow.map((s: string, idx: number) => (
                      <li key={`sh-${idx}`}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Shadow - Collapsible */}
        {shadow && (shadow.personal.length > 0 || shadow.historical.length > 0 || (shadow.context && shadow.context.length > 0)) && (
          <section className="factcheck-section factcheck-section--shadow">
            <button
              className="factcheck-section__toggle"
              onClick={() => toggleSection('shadow')}
              aria-expanded={expandedSections.shadow}
            >
              <MoonStars size={20} weight="duotone" />
              <span>{tString('factCheck.shadow')}</span>
              {expandedSections.shadow ? <CaretUp size={16} /> : <CaretDown size={16} />}
            </button>
            {expandedSections.shadow && (
              <div className="factcheck-shadow">
                <p className="factcheck-shadow__intro">{tString('factCheck.shadowIntro')}</p>
                {shadow.personal.length > 0 && (
                  <div className="factcheck-shadow__group">
                    <h3>{tString('factCheck.shadowPersonal')}</h3>
                    <ul>
                      {shadow.personal.map((item, idx) => (
                        <li key={`shadow-p-${idx}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {shadow.historical.length > 0 && (
                  <div className="factcheck-shadow__group">
                    <h3>{tString('factCheck.shadowHistorical')}</h3>
                    <ul>
                      {shadow.historical.map((item, idx) => (
                        <li key={`shadow-h-${idx}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {shadow.context && shadow.context.length > 0 && (
                  <div className="factcheck-shadow__group">
                    <h3>{tString('factCheck.shadowContext')}</h3>
                    <ul>
                      {shadow.context.map((item, idx) => (
                        <li key={`shadow-c-${idx}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Acknowledgments */}
        {acknowledgments && acknowledgments.length > 0 && (
          <section className="factcheck-section">
            <h2 className="factcheck-section__title">
              <HandHeart size={20} weight="duotone" />
              {tString('factCheck.acknowledgments')}
            </h2>
            {acknowledgments.map((line, idx) => (
              <p key={`ack-${idx}`} className="factcheck-section__text">{line}</p>
            ))}
          </section>
        )}
      </div>
    </div>
  );
};

export default FactCheckModal;
