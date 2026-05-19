// The four-step learning path on figure detail pages. The four modes form one
// arc per teaching: receive, engage, connect, demonstrate. See docs/CHAPTERS.md.
// Remove this file when stripping marketing pages from a fork

import { usePublicLang } from './PublicLangContext';

interface JourneyOverviewProps {
  figureName: string;
}

export default function JourneyOverview({ figureName }: JourneyOverviewProps) {
  const { t } = usePublicLang();

  const steps = [
    {
      n: 1, mode: 'story', name: t('journey.modeStory'),
      label: t('journey.listen'), meta: t('journey.storyDuration'),
      line: t('journey.storyLine'),
    },
    {
      n: 2, mode: 'wisdom', name: t('journey.modeWisdom'),
      label: t('journey.talk'), meta: '',
      line: t('journey.wisdomLine'),
    },
    {
      n: 3, mode: 'prism', name: t('journey.modePrism'),
      label: t('journey.listen'), meta: '',
      line: t('journey.prismLine'),
    },
    {
      n: 4, mode: 'quest', name: t('journey.modeQuest'),
      label: t('journey.talk'), meta: '',
      line: t('journey.questLine'),
    },
  ];

  return (
    <section className="pub-section pub-path-section">
      <h2 className="pub-section__title">
        {t('journey.heading').replace('{name}', figureName)}
      </h2>
      <p className="pub-path-intro">{t('journey.intro')}</p>

      <ol className="pub-path">
        {steps.map(step => (
          <li key={step.n} className={`pub-path__step pub-path__step--${step.mode}`}>
            <div className="pub-path__node">{step.n}</div>
            <div className="pub-path__body">
              <div className="pub-path__head">
                <span className="pub-path__name">{step.name}</span>
                <span className="pub-path__pill">
                  {step.meta ? `${step.label} · ${step.meta}` : step.label}
                </span>
              </div>
              <p className="pub-path__line">{step.line}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="pub-path-aside">{t('journey.aside')}</p>
      <p className="pub-path-nudge">{t('journey.nudge')}</p>
    </section>
  );
}
