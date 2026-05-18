// Echo framing for public detail pages. A compact note explaining what an
// "echo" is, shown on figure and theme pages so the concept is introduced
// before a visitor enters the app.

import { usePublicLang } from './PublicLangContext';

interface EchoNoteProps {
  variant: 'figure' | 'theme';
  /** Figure name, used by the 'figure' variant. */
  name?: string;
}

export default function EchoNote({ variant, name }: EchoNoteProps) {
  const { t } = usePublicLang();

  const text =
    variant === 'figure'
      ? t('echo.figureNote').replace('{name}', name ?? '')
      : t('echo.themeNote');

  return (
    <section className="pub-section">
      <p
        className="pub-section__text"
        style={{
          margin: 0,
          paddingLeft: '1rem',
          borderLeft: '2px solid color-mix(in srgb, var(--gold-subtle) 50%, transparent)',
          fontStyle: 'italic',
          opacity: 0.85,
        }}
      >
        {text}
      </p>
    </section>
  );
}
