// Contact page
// Remove this file when stripping marketing pages from a fork

import { usePublicLang } from '../../components/public/PublicLangContext';
import Breadcrumbs from '../../components/public/Breadcrumbs';
import MetaTags from '../../components/public/MetaTags';
import JsonLd, { organizationSchema } from '../../components/public/JsonLd';

export default function ContactPage() {
  const { lang, t } = usePublicLang();

  return (
    <div className="pub-content">
      <MetaTags
        title={t('contact.pageTitle')}
        description={t('contact.pageDescription')}
        canonicalPath="/contact"
        lang={lang}
      />
      <JsonLd data={{
        ...organizationSchema(),
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'agoracosmica@chipmates.ai',
          contactType: 'customer service',
          availableLanguage: ['English', 'German'],
        },
      }} />

      <Breadcrumbs items={[{ label: t('breadcrumbs.contact') }]} />

      <h1 className="pub-hero__title">{t('contact.heading')}</h1>
      <p className="pub-section__text" style={{ marginBottom: '2rem' }}>
        {t('contact.description')}
      </p>

      <section className="pub-section">
        <h2 className="pub-section__title">{t('contact.email')}</h2>
        <p className="pub-section__text">
          <a
            href="mailto:agoracosmica@chipmates.ai"
            style={{ color: 'var(--gold-primary)', textDecoration: 'none' }}
          >
            agoracosmica@chipmates.ai
          </a>
        </p>
      </section>

      <section className="pub-section">
        <h2 className="pub-section__title">{t('contact.address')}</h2>
        <address className="pub-section__text" style={{ fontStyle: 'normal' }}>
          ChipMates gemeinnützige GmbH<br />
          Schusterstr. 50<br />
          79098 Freiburg im Breisgau<br />
          {lang === 'de' ? 'Deutschland' : 'Germany'}
        </address>
      </section>

      <section className="pub-section">
        <h2 className="pub-section__title">{t('contact.social')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <a
            href={lang === 'de'
              ? 'https://open.spotify.com/show/5i63mEKJuCVniSIViXbEP8'
              : 'https://open.spotify.com/show/3V02q5c8NAnFD1W2kQBYzd'}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--gold-primary)', textDecoration: 'none' }}
          >
            Spotify - Agora Cosmica{lang === 'de' ? ' Deutsch' : ''}
          </a>
          <a
            href={lang === 'de'
              ? 'https://www.youtube.com/@agoracosmicade'
              : 'https://www.youtube.com/@agoracosmica'}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--gold-primary)', textDecoration: 'none' }}
          >
            YouTube - Agora Cosmica{lang === 'de' ? ' Deutsch' : ''}
          </a>
          <a
            href={lang === 'de'
              ? 'https://podcasts.apple.com/us/podcast/agora-cosmica-deutsch/id1871505945'
              : 'https://podcasts.apple.com/us/podcast/agora-cosmica/id1871505788'}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--gold-primary)', textDecoration: 'none' }}
          >
            Apple Podcasts - Agora Cosmica{lang === 'de' ? ' Deutsch' : ''}
          </a>
          <a
            href="https://github.com/chipmates/agoracosmica"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--gold-primary)', textDecoration: 'none' }}
          >
            GitHub - chipmates/agoracosmica
          </a>
        </div>
      </section>
    </div>
  );
}
