// Public SEO pages - figure ID ↔ URL slug mapping
// Remove this file when stripping marketing pages from a fork

export const figureSlugToId: Record<string, string> = {
  'marcus-aurelius': 'aurelius',
  'maya-angelou': 'angelou',
  'jane-austen': 'austen',
  'simone-de-beauvoir': 'beauvoir',
  'hildegard-von-bingen': 'bingen',
  'william-blake': 'blake',
  'joseph-campbell': 'campbell',
  'leonardo-da-vinci': 'vinci',
  'emily-dickinson': 'dickinson',
  'dogen-zenji': 'zenji',
  'meister-eckhart': 'eckhart',
  'albert-einstein': 'einstein',
  'galileo-galilei': 'galilei',
  'mahatma-gandhi': 'gandhi',
  'siddhartha-gautama': 'gautama',
  'johann-wolfgang-von-goethe': 'goethe',
  'carl-gustav-jung': 'jung',
  'frida-kahlo': 'kahlo',
  'martin-luther-king-jr': 'king',
  'laozi': 'laozi',
  'ada-lovelace': 'lovelace',
  'nelson-mandela': 'mandela',
  'wolfgang-amadeus-mozart': 'mozart',
  'friedrich-nietzsche': 'nietzsche',
  'plato': 'plato',
  'rumi': 'rumi',
  'arthur-schopenhauer': 'schopenhauer',
  'william-shakespeare': 'shakespeare',
  'harriet-tubman': 'tubman',
  'virginia-woolf': 'woolf',
};

// Inverse mapping: figure ID → URL slug
export const figureIdToSlug: Record<string, string> = Object.fromEntries(
  Object.entries(figureSlugToId).map(([slug, id]) => [id, slug])
);

// All valid slugs for prerendering
export const allFigureSlugs = Object.keys(figureSlugToId);
