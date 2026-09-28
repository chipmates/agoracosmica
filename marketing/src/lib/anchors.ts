// Section anchors that links and ads can point at: a readable slug of the
// heading, unique within one page.

const FOLD: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };

export function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äöüß]/g, ch => FOLD[ch] ?? ch)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Hands out heading ids for one page; a repeat gets -2, -3, and a taken id is never reused. */
export function anchorIds(taken: Iterable<string> = []): (text: string) => string {
  const used = new Set(taken);
  return (text: string) => {
    const base = headingSlug(text) || 'section';
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    return id;
  };
}
