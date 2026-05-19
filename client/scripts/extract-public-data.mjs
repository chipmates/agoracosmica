#!/usr/bin/env node

// Build-time data extraction for public SEO pages
// Reads full seed data, voice profiles, figure translations, and story files
// Outputs lightweight summaries for prerendering and client display

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const CLIENT_DIR = join(import.meta.dirname, '..');
const SEEDS_DIR = join(CLIENT_DIR, 'src/assets/translations/seeds');
const VOICE_DIR = join(CLIENT_DIR, 'src/assets/voice_profiles/en');
const FIGURES_DIR = join(CLIENT_DIR, 'src/assets/translations/figures');
const STORIES_DIR = join(CLIENT_DIR, 'src/assets/stories');
const OUTPUT_DIR = join(CLIENT_DIR, 'src/data/public');

const LANGUAGES = ['en', 'de'];

const FIGURE_IDS = [
  'laozi', 'angelou', 'austen', 'aurelius', 'beauvoir', 'bingen',
  'campbell', 'zenji', 'dickinson', 'einstein', 'eckhart', 'galilei',
  'gandhi', 'goethe', 'gautama', 'jung', 'kahlo', 'king', 'lovelace',
  'mandela', 'mozart', 'blake', 'nietzsche', 'plato', 'rumi',
  'schopenhauer', 'shakespeare', 'woolf', 'tubman', 'vinci',
];

// Category translations (seed metadata categories)
const CATEGORY_DE = {
  'Sage': 'Weiser',
  'Visionary': 'Vision\u00e4r',
  'Seeker': 'Suchender',
  'Creator': 'Sch\u00f6pfer',
  'Liberator': 'Befreier',
  'Explorer': 'Entdecker',
  'Mystic': 'Mystiker',
  'Architect': 'Architekt',
};

// Clean, short tradition labels for card display (the voice profile field is too long)
const SHORT_TRADITIONS = {
  aurelius: { en: 'Stoicism', de: 'Stoizismus' },
  angelou: { en: 'Poetry & Civil Rights', de: 'Poesie & B\u00fcrgerrechte' },
  austen: { en: 'Literary Realism', de: 'Literarischer Realismus' },
  beauvoir: { en: 'Existentialist Feminism', de: 'Existentialistischer Feminismus' },
  bingen: { en: 'Christian Mysticism', de: 'Christliche Mystik' },
  blake: { en: 'Visionary Poetry', de: 'Vision\u00e4re Poesie' },
  campbell: { en: 'Comparative Mythology', de: 'Vergleichende Mythologie' },
  zenji: { en: 'Zen Buddhism', de: 'Zen-Buddhismus' },
  dickinson: { en: 'American Poetry', de: 'Amerikanische Poesie' },
  einstein: { en: 'Theoretical Physics', de: 'Theoretische Physik' },
  eckhart: { en: 'Christian Mysticism', de: 'Christliche Mystik' },
  galilei: { en: 'Natural Philosophy', de: 'Naturphilosophie' },
  gandhi: { en: 'Nonviolent Resistance', de: 'Gewaltloser Widerstand' },
  goethe: { en: 'German Classicism', de: 'Weimarer Klassik' },
  gautama: { en: 'Buddhism', de: 'Buddhismus' },
  jung: { en: 'Depth Psychology', de: 'Tiefenpsychologie' },
  kahlo: { en: 'Art & Identity', de: 'Kunst & Identit\u00e4t' },
  king: { en: 'Civil Rights & Theology', de: 'B\u00fcrgerrechte & Theologie' },
  laozi: { en: 'Taoism', de: 'Taoismus' },
  lovelace: { en: 'Mathematics & Computing', de: 'Mathematik & Computing' },
  mandela: { en: 'Ubuntu & Liberation', de: 'Ubuntu & Befreiung' },
  mozart: { en: 'Classical Music', de: 'Klassische Musik' },
  nietzsche: { en: 'Existential Philosophy', de: 'Existenzphilosophie' },
  plato: { en: 'Classical Philosophy', de: 'Klassische Philosophie' },
  rumi: { en: 'Sufi Mysticism', de: 'Sufi-Mystik' },
  schopenhauer: { en: 'Philosophy of Will', de: 'Willensphilosophie' },
  shakespeare: { en: 'Renaissance Drama', de: 'Renaissance-Drama' },
  woolf: { en: 'Modernist Literature', de: 'Modernistische Literatur' },
  tubman: { en: 'Liberation & Faith', de: 'Befreiung & Glaube' },
  vinci: { en: 'Renaissance Polymath', de: 'Renaissance-Universalgelehrter' },
};

// Theme-to-tag keyword mapping for cross-referencing seeds to themes
const THEME_KEYWORDS = {
  'meaning-purpose': ['meaning', 'purpose', 'eudaimonia', 'fulfillment', 'direction', 'calling', 'vocation', 'intentional-living', 'values', 'worth'],
  'loss-grief': ['grief', 'loss', 'suffering', 'death', 'mourning', 'transience', 'impermanence', 'memento-mori', 'mortality', 'pain'],
  'who-am-i': ['identity', 'self', 'consciousness', 'ego', 'soul', 'individuation', 'anatta', 'not-self', 'shadow', 'persona'],
  'mind-creativity': ['creativity', 'imagination', 'ideas', 'art', 'innovation', 'intuition', 'thought-experiment', 'inspiration', 'curiosity', 'wonder'],
  'love-connection': ['love', 'connection', 'relationship', 'compassion', 'empathy', 'ishq', 'metta', 'loving-kindness', 'oikeiosis', 'attachment'],
  'freedom-justice': ['freedom', 'justice', 'liberation', 'rights', 'equality', 'nonviolence', 'duty', 'resistance', 'ubuntu', 'social'],
  'faith-death-mystery': ['faith', 'death', 'mystery', 'transcendence', 'divine', 'sacred', 'nirvana', 'fana', 'providence', 'cosmic'],
  'moral-life': ['ethics', 'virtue', 'moral', 'good', 'duty', 'character', 'courage', 'temperance', 'wisdom', 'justice-dikaiosyne'],
};

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return null; }
}

function readText(path) {
  try { return readFileSync(path, 'utf-8'); } catch { return null; }
}

function firstNSentences(text, n) {
  if (!text) return '';
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.slice(0, n).join(' ').trim();
}

function wordCount(text) {
  return text ? text.split(/\s+/).filter(w => w.length > 0).length : 0;
}

// ─── Seeds Extraction ───

function extractSeedSummary(seed) {
  return {
    id: seed.id,
    title: seed.title,
    summary: seed.summary || '',
    quote: seed.quote || '',
    tags: seed.tags || [],
    concept: firstNSentences(seed.overview?.concept, 2),
    coreInsights: (seed.coreInsights || []).slice(0, 3),
    connections: (seed.connections || []).map(c => ({
      figure: c.figure,
      seedTitle: c.seedTitle,
      type: c.type,
    })),
  };
}

function extractSeeds() {
  console.log('Extracting seed summaries...');
  for (const lang of LANGUAGES) {
    const outDir = join(OUTPUT_DIR, 'seeds', lang);
    mkdirSync(outDir, { recursive: true });
    let count = 0;
    for (const id of FIGURE_IDS) {
      const data = readJson(join(SEEDS_DIR, lang, `${id}-seeds.json`));
      if (!data?.seeds) { console.warn(`  Missing seeds: ${id}/${lang}`); continue; }
      writeFileSync(join(outDir, `${id}.json`), JSON.stringify({
        figure: data.figure,
        metadata: {
          tradition: data.metadata?.tradition || '',
          category: data.metadata?.category || '',
          period: data.metadata?.historicalPeriod || '',
        },
        seeds: data.seeds.map(extractSeedSummary),
      }, null, 2));
      count++;
    }
    console.log(`  Seeds ${lang}: ${count} figures`);
  }
}

// ─── Story Chapters Extraction ───

function extractStories() {
  console.log('Extracting story chapters...');
  for (const lang of LANGUAGES) {
    const outDir = join(OUTPUT_DIR, 'stories', lang);
    mkdirSync(outDir, { recursive: true });
    let count = 0;
    for (const id of FIGURE_IDS) {
      const storyDir = join(STORIES_DIR, id, lang);
      if (!existsSync(storyDir)) { console.warn(`  Missing stories: ${id}/${lang}`); continue; }

      const chapters = [];
      let totalWords = 0;
      for (let seg = 0; seg <= 12; seg++) {
        const txt = readText(join(storyDir, `${id}_${seg}_${lang}.txt`));
        if (!txt) continue;
        const words = wordCount(txt);
        totalWords += words;
        const lines = txt.trim().split('\n').filter(l => l.trim());
        const firstLine = lines[0] || '';
        // For segment 0, first line is the title ("A Note on...")
        // For segments 1+, first line is the narrative opening
        const hook = seg === 0
          ? firstNSentences(lines.slice(2).join(' '), 2)
          : firstNSentences(txt, 2);

        chapters.push({
          segment: seg,
          title: seg === 0 ? firstLine : `Chapter ${seg}`,
          opening: firstLine,
          hook,
          words,
          minutes: Math.round(words / 150), // TTS speaking rate ~150 wpm
        });
      }

      writeFileSync(join(outDir, `${id}.json`), JSON.stringify({
        figure: id,
        chapters,
        totalWords,
        totalMinutes: Math.round(totalWords / 150),
      }, null, 2));
      count++;
    }
    console.log(`  Stories ${lang}: ${count} figures`);
  }
}

// ─── Tag Aggregation ───

function aggregateTags() {
  console.log('Aggregating tags per figure...');
  const tagsByFigure = {};
  for (const lang of LANGUAGES) {
    tagsByFigure[lang] = {};
    for (const id of FIGURE_IDS) {
      const data = readJson(join(SEEDS_DIR, lang, `${id}-seeds.json`));
      if (!data?.seeds) continue;
      const tagCounts = {};
      for (const seed of data.seeds) {
        for (const tag of (seed.tags || [])) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }
      tagsByFigure[lang][id] = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([tag]) => tag);
    }
  }
  return tagsByFigure;
}

// ─── Theme-Seed Cross-Reference ───

function buildThemeCrossRef() {
  console.log('Building theme-seed cross-references...');
  const crossRef = {};

  // Collect all seeds with their tags
  const allSeeds = [];
  for (const id of FIGURE_IDS) {
    for (const lang of LANGUAGES) {
      const data = readJson(join(SEEDS_DIR, lang, `${id}-seeds.json`));
      if (!data?.seeds) continue;
      for (const seed of data.seeds) {
        allSeeds.push({
          figureId: id,
          figureName: data.figure,
          lang,
          seedId: seed.id,
          title: seed.title,
          quote: seed.quote || '',
          tags: seed.tags || [],
        });
      }
    }
  }

  for (const [themeId, keywords] of Object.entries(THEME_KEYWORDS)) {
    crossRef[themeId] = {};
    for (const lang of LANGUAGES) {
      const langSeeds = allSeeds.filter(s => s.lang === lang);
      // Score each seed by tag overlap with theme keywords
      const scored = langSeeds.map(s => {
        const overlap = s.tags.filter(t =>
          keywords.some(k => t.toLowerCase().includes(k))
        ).length;
        return { ...s, overlap };
      }).filter(s => s.overlap > 0);

      // Sort by overlap, deduplicate by figure (one best seed per figure)
      scored.sort((a, b) => b.overlap - a.overlap);
      const seen = new Set();
      const best = [];
      for (const s of scored) {
        if (seen.has(s.figureId)) continue;
        seen.add(s.figureId);
        best.push({
          figureId: s.figureId,
          figureName: s.figureName,
          seedTitle: s.title,
          quote: s.quote.slice(0, 200),
          overlap: s.overlap,
        });
        if (best.length >= 8) break;
      }
      crossRef[themeId][lang] = best;
    }
  }

  const tsContent = `// Auto-generated by scripts/extract-public-data.mjs
// Theme-seed cross-reference: best matching seeds per theme
// Do not edit manually. Run: pnpm build:extract

export interface ThemeSeedMatch {
  figureId: string;
  figureName: string;
  seedTitle: string;
  quote: string;
  overlap: number;
}

export const themeSeedCrossRef: Record<string, Record<string, ThemeSeedMatch[]>> = ${JSON.stringify(crossRef, null, 2)};

export function getThemeSeeds(themeId: string, lang: 'en' | 'de'): ThemeSeedMatch[] {
  return themeSeedCrossRef[themeId]?.[lang] || [];
}
`;
  writeFileSync(join(OUTPUT_DIR, 'themeSeedCrossRef.ts'), tsContent);
  console.log(`  Cross-refs built for ${Object.keys(crossRef).length} themes`);
}

// ─── Figures Catalog (enhanced) ───

function buildFiguresCatalog(tagsByFigure) {
  console.log('Building figures catalog...');
  const catalog = {};

  for (const lang of LANGUAGES) {
    catalog[lang] = [];
    for (const id of FIGURE_IDS) {
      const figTrans = readJson(join(FIGURES_DIR, lang, `${id}.json`));
      const voice = readJson(join(VOICE_DIR, `${id}.json`));
      const seedData = readJson(join(SEEDS_DIR, 'en', `${id}-seeds.json`));

      const voiceExcerpt = voice ? {
        essence: voice.essence || '',
        tradition: voice.philosophy?.tradition || '',
        keyConcepts: (voice.philosophy?.keyConcepts || []).slice(0, 3).map(c => ({
          term: c.term,
          definition: firstNSentences(c.definition, 2),
        })),
        period: voice.metadata?.period || '',
        primaryWorks: (voice.metadata?.primaryWorks || []).slice(0, 3),
      } : null;

      const name = figTrans?.name?.replace(/^Echo of /, '').replace(/^Echo von /, '') || voice?.name || id;

      // For German, pull keyConcepts from DE seeds (voice profiles are English only)
      const langSeedData = readJson(join(SEEDS_DIR, lang, `${id}-seeds.json`));
      const langKeyConcepts = lang === 'de' && langSeedData?.seeds
        ? langSeedData.seeds.slice(0, 3).map(s => ({
            term: s.title,
            definition: firstNSentences(s.summary, 2),
          }))
        : voiceExcerpt?.keyConcepts || [];

      catalog[lang].push({
        id,
        name,
        about: figTrans?.about || '',
        learn: figTrans?.learn || '',
        tradition: SHORT_TRADITIONS[id]?.[lang] || seedData?.metadata?.tradition?.split(',')[0]?.trim() || '',
        category: lang === 'de' ? CATEGORY_DE[seedData?.metadata?.category] || '' : seedData?.metadata?.category || '',
        period: lang === 'de'
          ? (voiceExcerpt?.period || '').replace(/\bAD\b/g, 'n. Chr.').replace(/\bBC\b/g, 'v. Chr.').replace(/\bBCE\b/g, 'v. Chr.').replace(/\bCE\b/g, 'n. Chr.')
          : voiceExcerpt?.period || seedData?.metadata?.historicalPeriod || '',
        essence: lang === 'de' ? '' : (voiceExcerpt?.essence || ''),
        keyConcepts: langKeyConcepts,
        primaryWorks: lang === 'de' ? [] : (voiceExcerpt?.primaryWorks || []),
        topTags: tagsByFigure[lang]?.[id] || [],
      });
    }
  }

  const tsContent = `// Auto-generated by scripts/extract-public-data.mjs
// Do not edit manually. Run: pnpm build:extract

export interface PublicFigure {
  id: string;
  name: string;
  about: string;
  learn: string;
  tradition: string;
  category: string;
  period: string;
  essence: string;
  keyConcepts: { term: string; definition: string }[];
  primaryWorks: string[];
  topTags: string[];
}

export const figuresCatalogEn: PublicFigure[] = ${JSON.stringify(catalog.en, null, 2)};

export const figuresCatalogDe: PublicFigure[] = ${JSON.stringify(catalog.de, null, 2)};

export function getFiguresCatalog(lang: 'en' | 'de'): PublicFigure[] {
  return lang === 'de' ? figuresCatalogDe : figuresCatalogEn;
}

export function getFigureById(id: string, lang: 'en' | 'de'): PublicFigure | undefined {
  return getFiguresCatalog(lang).find(f => f.id === id);
}
`;
  writeFileSync(join(OUTPUT_DIR, 'figuresCatalog.ts'), tsContent);
  console.log(`  Catalog: ${catalog.en.length} figures per language (with topTags)`);
}

// ─── Run All ───

console.log('=== Public Data Extraction ===');
extractSeeds();
extractStories();
const tagsByFigure = aggregateTags();
buildThemeCrossRef();
buildFiguresCatalog(tagsByFigure);
console.log('=== Done ===');
