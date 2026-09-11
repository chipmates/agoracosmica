import inscriptionsText from '../words/data/inscriptions.json?raw';
import { FAMOUS_FOLIOS, SOURCE_READINGS, TABLE_UI, folioKey, hasItalian, type Language, type PageRecord } from './content';
import panelCss from './panel.css?raw';

interface Inscription {
  id: string;
  text_en: string;
  text_de: string | null;
  folio_siglum: string;
}
const inscriptions = JSON.parse(inscriptionsText) as { passages: Inscription[] };
const openingInscription = inscriptions.passages.find((passage) => passage.id === 'richter-4');

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function sourceLink(label: string, url: string): HTMLAnchorElement {
  const link = node('a', 'vt-source-link', label);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

export function createPanel(pages: PageRecord[], onOpen: (folio: string) => void) {
  let lang: Language = 'en';
  let reading: 'it' | 'fr' = 'it';
  let page = pages[0];
  const leaves = pages.filter((record) => record.page_kind === 'facsimile');
  const element = node('aside', 'vinci-table-panel');
  const style = document.createElement('style');
  style.textContent = panelCss;
  document.head.append(style);
  element.setAttribute('aria-label', TABLE_UI.en.title);
  const shelf = node('section', 'vinci-table-shelf');
  shelf.hidden = true;
  let shelfShown = false;

  const pageKind = (record: PageRecord): string => {
    const copy = TABLE_UI[lang];
    const labels: Record<string, string> = {
      facsimile: copy.facsimile, translation: copy.translation,
      title: copy.titlePage, editorial: copy.editorial, blank: copy.blank,
      end_matter: copy.endMatter, missing_notice: copy.missingNotice,
    };
    return labels[record.page_kind] ?? copy.editionMatter;
  };

  function selector(label: string, kind: string, records: PageRecord[]) {
    const wrapper = node('label', 'vt-select-label');
    wrapper.append(node('span', 'vt-small-label', label));
    const select = node('select', 'vt-select');
    select.name = kind;
    select.setAttribute('aria-label', label);
    if (kind === 'folio' && page?.page_kind !== 'facsimile') {
      const placeholder = node('option', '', TABLE_UI[lang].editionMatter);
      placeholder.value = '';
      placeholder.disabled = true;
      placeholder.selected = true;
      select.append(placeholder);
    }
    for (const record of records) {
      const key = folioKey(record);
      const identity = record.codex && record.folio !== null
        ? `${record.codex} ${record.folio}${record.side === 'recto' ? 'r' : 'v'} · ` : '';
      const description = lang === 'en' ? record.what_it_shows_en : record.what_it_shows_de;
      const labelText = kind === 'folio'
        ? `${identity}${description.replace(/\.$/, '').slice(0, 80)}`
        : `${record.edition_index + 1} · ${identity}${pageKind(record)}`;
      const option = node('option', '', labelText);
      option.value = kind === 'folio' ? key : `edition:${record.edition_index}`;
      option.selected = record.file === page?.file;
      select.append(option);
    }
    select.addEventListener('change', () => { if (select.value) onOpen(select.value); });
    wrapper.append(select);
    return wrapper;
  }

  function languageSelector() {
    const copy = TABLE_UI[lang];
    const label = node('label', 'vt-language');
    label.setAttribute('aria-label', copy.readingLanguage);
    const select = node('select', 'vt-language-select');
    select.name = 'language';
    select.setAttribute('aria-label', copy.readingLanguage);
    for (const [value, title] of [['en', 'EN'], ['de', 'DE']] as const) {
      const option = node('option', '', title);
      option.value = value;
      option.selected = value === lang;
      select.append(option);
    }
    select.addEventListener('change', () => {
      const next = select.value === 'de' ? 'de' : 'en';
      language(next);
      element.dispatchEvent(new CustomEvent('tablelanguagechange', { bubbles: true, detail: { language: next } }));
    });
    label.append(select);
    return label;
  }

  function render() {
    if (!page) return;
    const browseOpen = element.querySelector<HTMLDetailsElement>('.vt-browse')?.open ?? false;
    const sourceOpen = element.querySelector<HTMLDetailsElement>('.vt-source-details')?.open ?? false;
    const activeControl = element.contains(document.activeElement) && document.activeElement instanceof HTMLSelectElement
      ? document.activeElement.name : '';
    const activeReading = element.contains(document.activeElement) && document.activeElement instanceof HTMLButtonElement
      ? document.activeElement.dataset.reading : undefined;
    const current = page;
    const copy = TABLE_UI[lang];
    element.lang = lang;
    element.setAttribute('aria-label', copy.title);
    element.dataset.edition = String(current.edition_index);
    element.dataset.folio = folioKey(current);
    const header = node('header', 'vt-panel-header');
    const eyebrow = node('div', 'vt-heading-row');
    const codexCaption = current.codex ? `${copy.manuscript} ${current.codex}` : copy.edition;
    eyebrow.append(node('p', 'vt-kicker', current.page_kind === 'translation' ? `${codexCaption} · ${copy.translation}` : codexCaption));
    const identity = current.codex && current.folio !== null && current.side
      ? `${current.folio} ${current.side === 'recto' ? copy.recto : copy.verso}`
      : pageKind(current);
    const title = node('h2', 'vt-folio-title', identity);
    title.tabIndex = -1;
    const provenance = current.codex && current.folio !== null
      ? lang === 'en'
        ? `${identity}, from the 1883 facsimile. The original is in the Institut de France.`
        : `${identity}, aus dem Faksimile von 1883. Das Original befindet sich im Institut de France.`
      : lang === 'en'
        ? 'From Ravaisson-Mollien’s 1883 edition of manuscripts B and D.'
        : 'Aus Ravaisson-Molliens Ausgabe der Manuskripte B und D von 1883.';
    const titleRow = node('div', 'vt-heading-row');
    titleRow.append(title, languageSelector());
    header.append(eyebrow, titleRow);
    const namedLeaf = FAMOUS_FOLIOS.find((leaf) => folioKey(current) === `B:${leaf.folio}`);
    if (namedLeaf) header.append(node('p', 'vt-leaf-name', namedLeaf[lang]));
    if (current.machine_sources.some((source) => source.relation === 'related_context')) header.append(node('p', 'vt-relation', copy.related));
    header.append(node('p', 'vt-provenance', provenance));
    const navigation = node('details', 'vt-browse');
    navigation.open = browseOpen;
    navigation.append(node('summary', 'vt-source-summary', `${copy.browse} · ${current.edition_index + 1}/${pages.length}`));
    const selectors = node('div', 'vt-page-selectors');
    selectors.append(selector(copy.editionPage, 'edition', pages), selector(copy.manuscriptLeaf, 'folio', leaves));
    navigation.append(selectors);
    const description = node('p', 'vt-description', lang === 'en' ? current.what_it_shows_en : current.what_it_shows_de);
    if (current.machine_sources.some((source) => source.relation === 'related_context')) {
      navigation.append(node('p', 'vt-relation', copy.related));
    }
    navigation.append(node('p', 'vt-small-label', copy.catalogueDescription), description);
    if (current.page_kind === 'facsimile') {
      const certainty = node('p', 'vt-folio-certainty', copy.documentedFolio);
      certainty.dataset.certainty = 'documented';
      navigation.append(certainty);
    }
    header.append(navigation);

    const body = node('div', 'vt-panel-reading');
    const loadError = node('p', 'vt-load-error', copy.imageUnavailable);
    loadError.setAttribute('role', 'status');
    body.append(loadError);
    const italian = node('section', 'vt-text-section');
    italian.setAttribute('aria-label', copy.italian);
    italian.append(node('h3', 'vt-text-heading', copy.italian), node('p', 'vt-text-caption', copy.italianDetail));
    const italianText = node('p', hasItalian(current) ? 'vt-source-text' : 'vt-source-text vt-unavailable', hasItalian(current) ? current.transcription_it ?? '' : copy.unavailable);
    italianText.dataset.text = 'transcription';
    if (hasItalian(current)) italianText.lang = 'it';
    if (current.ocr_confidence === 'low') italian.append(node('p', 'vt-ocr-note', copy.lowOcr));
    italian.append(italianText);
    const french = node('section', 'vt-text-section');
    french.setAttribute('aria-label', copy.french);
    french.append(node('h3', 'vt-text-heading', copy.french), node('p', 'vt-text-caption', copy.frenchDetail));
    const frenchText = node('p', current.translation_fr ? 'vt-source-text' : 'vt-source-text vt-unavailable', current.translation_fr ?? copy.frenchUnavailable);
    frenchText.dataset.text = 'translation';
    if (current.translation_fr) frenchText.lang = 'fr';
    french.append(frenchText);
    const readings = node('div', 'vt-reader-controls');
    readings.setAttribute('role', 'group');
    readings.setAttribute('aria-label', copy.sourceReading);
    const readingButtons: HTMLButtonElement[] = [];
    const selectReading = (next: 'it' | 'fr') => {
      reading = next;
      italian.hidden = next !== 'it';
      french.hidden = next !== 'fr';
      for (const button of readingButtons) button.setAttribute('aria-pressed', String(button.dataset.reading === next));
    };
    for (const source of SOURCE_READINGS) {
      const button = node('button', 'vt-reader-button', source.label);
      button.type = 'button';
      button.lang = source.key;
      button.dataset.reading = source.key;
      button.addEventListener('click', () => selectReading(source.key));
      readingButtons.push(button);
      readings.append(button);
    }
    selectReading(reading);
    // Keep both verbatim witnesses mounted; the controls only change visibility.
    body.append(readings, italian, french);

    if (current.page_kind !== 'facsimile' && current.page_kind !== 'translation' && current.edition_text_ocr?.trim()) {
      const editionText = node('section', 'vt-text-section');
      editionText.append(node('h3', 'vt-text-heading', copy.editionMatter), node('p', 'vt-source-text', current.edition_text_ocr));
      body.append(editionText);
    }
    const sources = node('details', 'vt-source-details');
    sources.open = sourceOpen;
    sources.append(node('summary', 'vt-source-summary', copy.source), node('p', 'vt-source-note', copy.reproduction));
    if (current.ocr_note_en) sources.append(node('p', 'vt-source-note', lang === 'en' ? current.ocr_note_en : current.ocr_note_de ?? current.ocr_note_en));
    sources.append(sourceLink(copy.sourceImage, current.source_url));
    const folioUrl = current.machine_sources.find((source) => source.folio_source_url)?.folio_source_url;
    if (folioUrl) sources.append(sourceLink(copy.folioSource, folioUrl));
    sources.append(node('p', 'vt-licence', current.licence_line));
    body.append(sources);
    element.replaceChildren(header, body);
    if (activeControl) element.querySelector<HTMLSelectElement>(`select[name="${activeControl}"]`)?.focus({ preventScroll: true });
    if (activeReading === 'it' || activeReading === 'fr') element.querySelector<HTMLButtonElement>(`.vt-reader-button[data-reading="${activeReading}"]`)?.focus({ preventScroll: true });
    renderShelf();
  }

  function renderShelf() {
    const copy = TABLE_UI[lang];
    shelf.lang = lang;
    shelf.setAttribute('aria-label', copy.famous);
    const heading = node('header', 'vt-shelf-heading');
    heading.append(node('p', 'vt-kicker', copy.shelfIntro), node('h2', 'vt-shelf-title', copy.famous));
    const list = node('ol', 'vt-shelf-list');
    for (const famous of FAMOUS_FOLIOS) {
      const record = leaves.find((leaf) => folioKey(leaf) === `B:${famous.folio}`);
      if (!record) continue;
      const item = node('li', 'vt-shelf-item');
      const button = node('button', 'vt-shelf-button');
      button.type = 'button';
      button.setAttribute('aria-label', `${famous[lang]}, B ${famous.folio}`);
      button.setAttribute('aria-current', page?.file === record.file ? 'page' : 'false');
      button.append(node('span', 'vt-shelf-number', famous.folio), node('span', 'vt-shelf-name', famous[lang]));
      if (record.machine_sources.some((source) => source.relation === 'related_context')) button.append(node('span', 'vt-shelf-related', copy.related));
      button.addEventListener('click', () => {
        const restoreFocus = document.activeElement === button;
        onOpen(`B:${famous.folio}`);
        if (restoreFocus) {
          const destination = element.querySelector<HTMLElement>('.vt-folio-title');
          // The host removes its shelf layout on the next frame. Focus only
          // after the reading title is visible, and preserve any newer input.
          requestAnimationFrame(() => requestAnimationFrame(() => {
            if (destination?.isConnected && document.activeElement === document.body
              && destination.getBoundingClientRect().height > 0) destination.focus({ preventScroll: true });
          }));
        }
      });
      item.append(button);
      list.append(item);
    }
    const absence = node('div', 'vt-shelf-absence');
    absence.append(node('p', 'vt-absence-status', copy.absent), node('h3', 'vt-absence-title', copy.birds), node('p', 'vt-absence-holder', copy.birdsHolder), node('p', 'vt-source-note', copy.birdsAbsence));
    shelf.replaceChildren(heading, list, absence);
    if (openingInscription) {
      const inscription = node('details', 'vt-inscription');
      inscription.append(node('summary', 'vt-source-summary', copy.inscription));
      const quotation = node('blockquote', 'vt-inscription-text', lang === 'de' ? openingInscription.text_de ?? openingInscription.text_en : openingInscription.text_en);
      quotation.lang = lang;
      inscription.append(quotation, node('p', 'vt-inscription-citation', `${copy.quotationSource} · ${openingInscription.folio_siglum}`), node('p', 'vt-source-note', lang === 'de' ? copy.germanWitness : copy.englishWitness), node('p', 'vt-shelf-source', copy.shelfSource));
      shelf.append(inscription);
    }
    shelf.hidden = !shelfShown;
  }

  function language(next: Language) {
    if (lang === next) return;
    const scrollTop = element.scrollTop;
    lang = next;
    render();
    element.scrollTop = scrollTop;
  }

  render();
  return {
    element,
    shelf,
    update(next: PageRecord) {
      const changed = next.file !== page?.file;
      page = next;
      render();
      if (changed) element.scrollTop = 0;
    },
    showShelf(on: boolean) {
      shelfShown = on;
      shelf.hidden = !on;
    },
    language,
    dispose() { element.remove(); shelf.remove(); style.remove(); },
  };
}
