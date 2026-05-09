import { FC, ReactNode } from 'react';
import { CaretDown, CaretRight, BookOpen } from '@phosphor-icons/react';

interface SummaryContentProps {
  content: string;
  selectedSeedId: string | null;
  expandedSections: { [key: string]: boolean };
  toggleSection: (sectionId: string) => void;
  summaryTitleLabel: ReactNode;
}

const SummaryContent: FC<SummaryContentProps> = ({
  content,
  selectedSeedId,
  expandedSections,
  toggleSection,
  summaryTitleLabel
}) => {
  if (!content) return null;
  const sections = content.split(/\n(?=[A-Z][A-Z\s]+:)/).filter(Boolean);

  return (
    <div className="summary-content">
      <div className="summary-header">
        <span className="summary-icon">
          <BookOpen size={16} weight="duotone" />
        </span>
        <span className="summary-title">{summaryTitleLabel}</span>
      </div>
      {sections.map((section, idx) => {
        const [title, ...lines] = section.split('\n');
        const sectionId = `section-${selectedSeedId}-${idx}`;
        const sectionTitle = title.replace(':', '').trim();
        const isExp = expandedSections[sectionId];

        return (
          <div key={sectionId} className="summary-section" data-section={sectionTitle}>
            <button
              className="summary-section-header"
              onClick={() => toggleSection(sectionId)}
              aria-expanded={isExp}
            >
              <span className="section-title">{sectionTitle}</span>
              {isExp ? <CaretDown size={20} weight="duotone" /> : <CaretRight size={20} weight="duotone" />}
            </button>
            <div className={`section-content ${!isExp ? 'collapsed' : ''}`}>
              {(() => {
                const elements: ReactNode[] = [];
                let bulletBuffer: ReactNode[] = [];
                const flushBullets = () => {
                  if (bulletBuffer.length > 0) {
                    elements.push(<ul key={`ul-${elements.length}`} className="summary-bullets">{bulletBuffer}</ul>);
                    bulletBuffer = [];
                  }
                };
                lines.forEach((line, i) => {
                  const t = line.trim();
                  if (!t) return;
                  if (t.startsWith('-') || t.startsWith('*')) {
                    bulletBuffer.push(<li key={i} className="summary-bullet">{t.substring(1).trim()}</li>);
                  } else {
                    flushBullets();
                    if (t.startsWith('"')) {
                      elements.push(<blockquote key={i} className="summary-quote">{t}</blockquote>);
                    } else if (t.endsWith(':')) {
                      elements.push(<h4 key={i} className="summary-subsection-title">{t}</h4>);
                    } else {
                      elements.push(<p key={i} className="summary-paragraph">{t}</p>);
                    }
                  }
                });
                flushBullets();
                return elements;
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SummaryContent;
