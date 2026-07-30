// Question of the day. The full list of 55 questions is server-rendered right
// below this panel, so the island carries only the build-day pick as props and
// re-picks from the rendered list once it hydrates. Nothing here fetches, and
// the panel degrades to a real, working question with JS off.

import { useEffect, useState } from 'react';

export interface QotdItem {
  question: string;
  who: string;
  href: string;
  figureId: string;
}

interface Props {
  initial: QotdItem;
  label: string;
  caption: string;
  /** Selector for the SSR'd question doors this panel picks from. */
  poolSelector: string;
}

function text(node: Element | null): string {
  return node?.textContent?.trim() ?? '';
}

export default function QuestionOfTheDay({ initial, label, caption, poolSelector }: Props) {
  const [item, setItem] = useState<QotdItem>(initial);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLAnchorElement>(poolSelector));
    if (nodes.length === 0) return;
    // Day number since the epoch, so the pick is stable for a whole local day
    // and walks the list one step at a time.
    const day = Math.floor(
      (Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000,
    );
    const node = nodes[day % nodes.length];
    const question = text(node.querySelector('.tq-door__q'));
    if (!question) return;
    setItem({
      question,
      who: text(node.querySelector('.tq-door__who')),
      href: node.getAttribute('href') ?? initial.href,
      figureId: node.getAttribute('data-agc-figure') ?? initial.figureId,
    });
  }, [poolSelector]);

  return (
    <section className="tq-qotd">
      <p className="tq-qotd__label">{label}</p>
      <p className="tq-qotd__q">{item.question}</p>
      <a
        className="tq-qotd__door"
        href={item.href}
        data-agc-cta="start-exploring"
        data-agc-figure={item.figureId}
        data-agc-door="themes_qotd"
      >
        {item.who}
      </a>
      <p className="tq-qotd__caption">{caption}</p>
    </section>
  );
}
