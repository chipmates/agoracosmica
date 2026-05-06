// Visual learning path overview for figure detail pages
// Shows the structured chapter journey + extras (audio library, custom councils)
// Remove this file when stripping marketing pages from a fork

import { usePublicLang } from './PublicLangContext';

interface JourneyOverviewProps {
  figureName: string;
  storyMinutes: number;
  storyChapters: number;
  seedCount: number;
  councilCount: number;
}

export default function JourneyOverview({
  figureName,
  storyMinutes,
  storyChapters,
  seedCount,
  councilCount,
}: JourneyOverviewProps) {
  const { t } = usePublicLang();

  const chapters = [
    { num: 1, mode: t('journey.modeStory'), type: 'listen' as const,
      detail: `${storyChapters} ${t('journey.chapters')}, ~${storyMinutes} min` },
    { num: 2, mode: t('journey.modeWisdom'), type: 'talk' as const,
      detail: `${seedCount} ${t('journey.teachings')}` },
    { num: 3, mode: t('journey.modePrism'), type: 'listen' as const,
      detail: t('journey.multiPerspective') },
    { num: 4, mode: t('journey.modeQuest'), type: 'talk' as const,
      detail: t('journey.socraticChallenge') },
  ];

  return (
    <section className="pub-section pub-journey">
      <h2 className="pub-section__title">
        {t('journey.title').replace('{name}', figureName)}
      </h2>

      <div className="pub-journey__path">
        {chapters.map((ch, i) => (
          <div key={ch.num} className="pub-journey__step">
            <div className="pub-journey__node">
              <div className="pub-journey__num">{ch.num}</div>
              <div className="pub-journey__mode">
                <span className="pub-journey__mode-name">{ch.mode}</span>
                <span className={`pub-journey__badge pub-journey__badge--${ch.type}`}>
                  {t(`journey.${ch.type}`)}
                </span>
              </div>
              <span className="pub-journey__detail">{ch.detail}</span>
            </div>
            {i < chapters.length - 1 && <div className="pub-journey__connector" />}
          </div>
        ))}
      </div>

      <div className="pub-journey__extras">
        <span className="pub-hero__badge">+ {t('journey.freetalk')}</span>
        <span className="pub-hero__badge">+ {t('journey.audioLibrary')}</span>
        {councilCount > 0 && (
          <span className="pub-hero__badge">+ {councilCount} {t('journey.debates')}</span>
        )}
        <span className="pub-hero__badge">+ {t('journey.customCouncils')}</span>
      </div>
    </section>
  );
}
