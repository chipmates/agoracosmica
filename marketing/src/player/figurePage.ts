// The head of a player figure page: the same title, description, canonical
// and structured data the figure template builds (pages/figures/[slug].astro),
// without the trailer's AudioObject, since a player page no longer shows the
// trailer. Build time only.

import { figureImage } from '../lib/figureImages';
import { getT } from '../i18n';
import { breadcrumbSchema, personSchema, faqSchema, itemListSchema } from '../lib/schemas';
import { getSeedsFor } from '../lib/seeds';
import { dickinsonPoemsFaqEn, dickinsonPoemsFaqDe } from '../lib/dickinsonPoemsFaq';
import { SITE_URL } from '../lib/urls';
import { getFigureById } from '@client/data/public/figuresCatalog';
import { getFigureSeo } from '@client/data/public/figureSeo';
import { getFigureQA } from '@client/data/public/figureQA';
import { getFigurePageContent } from '@client/data/public/figurePageContent';
import type { PlayerLang } from './strings';

export function figurePageHead(figureId: string, slug: string, lang: PlayerLang) {
  const de = lang === 'de';
  const t = getT(lang);
  const figure = getFigureById(figureId, lang);
  if (!figure) throw new Error(`Unknown figure: ${figureId}`);
  const seo = getFigureSeo(figureId, lang);

  const aboutParas = figure.about.split('\n').map(p => p.trim()).filter(Boolean);
  const metaDescription = seo?.description || aboutParas[0] || '';
  const figureUrl = `${SITE_URL}${de ? '/de' : ''}/figures/${slug}/`;
  const figurePortrait = figureImage(figureId, 'main', 1200);

  const figQA = getFigureQA(figureId, lang);
  const qaPairs = figQA ? figQA.pairs.slice(1) : [];
  const figQaItems = (figureId !== 'dickinson' && figQA) ? [...qaPairs, figQA.disclosure] : [];
  const ideaSeeds = getSeedsFor(figureId, lang);
  const pageContent = getFigurePageContent(figureId, lang);
  const schemaWorks = pageContent?.works?.length ? pageContent.works.map(w => w.title) : figure.primaryWorks;
  const personDescription = figQA?.pairs[0]?.a || aboutParas[0] || figure.about;

  const schemas = [
    personSchema({
      name: figure.name,
      about: personDescription,
      period: figure.period,
      tradition: figure.tradition,
      slug,
      lang,
      image: figurePortrait,
      concepts: figure.keyConcepts.map(c => c.term),
      works: schemaWorks,
    }),
    breadcrumbSchema([
      { name: t('breadcrumbs.home'), url: `${SITE_URL}${de ? '/de/' : '/'}` },
      { name: t('breadcrumbs.figures'), url: `${SITE_URL}${de ? '/de' : ''}/figures` },
      { name: figure.name, url: figureUrl },
    ]),
    ...(figureId === 'dickinson' ? [faqSchema(de ? dickinsonPoemsFaqDe : dickinsonPoemsFaqEn, figureUrl)] : []),
    ...(figQaItems.length ? [faqSchema(figQaItems, figureUrl)] : []),
    ...(ideaSeeds.length
      ? [itemListSchema(ideaSeeds.map((s, i) => ({
          name: s.title,
          url: `${figureUrl}#idea-${i + 1}`,
          description: s.summary,
        })))]
      : []),
  ];

  return {
    figure,
    layout: {
      title: `${figure.name} - ${t('figures.life')} & ${t('figures.teachings')}`,
      fullTitle: seo?.seoTitle,
      description: metaDescription,
      canonicalPath: `/figures/${slug}`,
      lang,
      stickyCta: false,
      reading: true,
      storyPage: true,
      ogType: 'profile' as const,
      ogImage: figurePortrait,
      ogImageAlt: de ? `KI-generiertes Porträt: ${figure.name}` : `AI-generated portrait: ${figure.name}`,
      schemas,
    },
  };
}
