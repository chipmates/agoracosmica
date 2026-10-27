import type { ReactNode } from 'react';

// The player's icons, drawn on a 24 grid. Text inside an icon sets no stroke
// (an inherited stroke turns a small "15" into a blot).

const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function svg(children: ReactNode, filled = false) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...(filled ? { fill: 'currentColor' } : line)}>
      {children}
    </svg>
  );
}

export const Icon = {
  play: svg(<path d="M8.2 5.3v13.4c0 .5.5.8.9.5l10.3-6.7a.6.6 0 0 0 0-1L9.1 4.8c-.4-.3-.9 0-.9.5z" />, true),
  pause: svg(<><rect x="6.6" y="5" width="3.8" height="14" rx="1" /><rect x="13.6" y="5" width="3.8" height="14" rx="1" /></>, true),
  back15: svg(<>
    <path d="M6.3 6.6A8.4 8.4 0 1 1 3.6 12.4" />
    <path d="M6.6 2.6v4.3H2.3" />
    <text x="12.6" y="15.4" textAnchor="middle" fontSize="7.6" fontWeight="700" fill="currentColor" stroke="none">15</text>
  </>),
  fwd15: svg(<>
    <path d="M17.7 6.6A8.4 8.4 0 1 0 20.4 12.4" />
    <path d="M17.4 2.6v4.3h4.3" />
    <text x="11.4" y="15.4" textAnchor="middle" fontSize="7.6" fontWeight="700" fill="currentColor" stroke="none">15</text>
  </>),
  next: svg(<><path d="M5.8 6.2v11.6c0 .5.5.8.9.5l8.6-5.8a.6.6 0 0 0 0-1L6.7 5.7c-.4-.3-.9 0-.9.5z" /><rect x="16.6" y="5.6" width="2.4" height="12.8" rx="1" /></>, true),
  prev: svg(<><path d="M18.2 6.2v11.6c0 .5-.5.8-.9.5l-8.6-5.8a.6.6 0 0 1 0-1l8.6-5.8c.4-.3.9 0 .9.5z" /><rect x="5" y="5.6" width="2.4" height="12.8" rx="1" /></>, true),
  close: svg(<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />),
  book: svg(<path d="M12 6.6C9.7 5 6.6 4.7 3.5 5.6v12.8c3.1-.9 6.2-.6 8.5 1M12 6.6c2.3-1.6 5.4-1.9 8.5-1v12.8c-3.1-.9-6.2-.6-8.5 1M12 6.6v12.8" />),
  back: svg(<path d="M15 5l-7 7 7 7" />),
  up: svg(<path d="M6 14.5l6-6 6 6" />),
  down: svg(<path d="M6 9.5l6 6 6-6" />),
  minus: svg(<path d="M6 12h12" />),
  plus: svg(<path d="M6 12h12M12 6v12" />),
  mark: svg(<path d="M6.5 4h11v16l-5.5-4-5.5 4z" />),
  markFilled: svg(<path d="M6.5 4h11v16l-5.5-4-5.5 4z" />, true),
  checkCircle: svg(<><circle cx="12" cy="12" r="8.5" /><path d="M8.2 12.3l2.6 2.6 5-5.2" /></>),
  pencil: svg(<><path d="M4.5 19.5l1-4L15.8 5.2a2 2 0 0 1 2.9 0l.1.1a2 2 0 0 1 0 2.9L8.5 18.5z" /><path d="M14 7l3 3" /></>),
  info: svg(<><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.2M12 7.8v.2" /></>),
  share: svg(<><path d="M12 15V4" /><path d="M8 7.5L12 3.5l4 4" /><path d="M6 11v8.5h12V11" /></>),
  calendar: svg(<><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>),
  user: svg(<><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c1-4 3.8-6 7-6s6 2 7 6" /></>),
  pin: svg(<><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>),
  /** The ring of small dots inside a play disc's rim, on a 100 grid: 36 dots, round caps on dashes of no length. */
  dots: <svg className="sp-dots" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="43" /></svg>,
  trash: svg(<><path d="M5 7h14M9.5 7V5h5v2M7 7l1 12.5h8L17 7" /></>),
};
