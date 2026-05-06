// Public page footer
// Remove this file when stripping marketing pages from a fork

import { Link } from 'react-router-dom';
import { usePublicLang } from './PublicLangContext';
import { publicUrl } from '../../utils/public/publicSeo';

export default function PublicFooter() {
  const { lang, t } = usePublicLang();

  return (
    <footer className="pub-footer">
      <div className="pub-footer__inner">
        <div className="pub-footer__brand">
          <span className="pub-footer__name">Agora Cosmica</span>
          <p className="pub-footer__tagline">{t('footer.tagline')}</p>
        </div>

        <div className="pub-footer__links">
          <div className="pub-footer__col">
            <Link to={publicUrl(lang, '/figures')}>{t('nav.figures')}</Link>
            <Link to={publicUrl(lang, '/themes')}>{t('nav.themes')}</Link>
            <Link to={publicUrl(lang, '/about')}>{t('nav.about')}</Link>
            <Link to={publicUrl(lang, '/contact')}>{t('nav.contact')}</Link>
          </div>
          <div className="pub-footer__col">
            <Link to="/impressum">{t('footer.impressum')}</Link>
            <Link to="/datenschutz">{t('footer.datenschutz')}</Link>
            <Link to="/cookie-policy">{t('footer.cookiePolicy')}</Link>
            <Link to="/nutzungsbedingungen">{t('footer.terms')}</Link>
          </div>
          <div className="pub-footer__col">
            <a href="https://open.spotify.com/show/3V02q5c8NAnFD1W2kQBYzd" target="_blank" rel="noopener noreferrer">Spotify</a>
            <a href="https://www.youtube.com/@agoracosmica" target="_blank" rel="noopener noreferrer">YouTube</a>
            <a href="https://podcasts.apple.com/us/podcast/agora-cosmica/id1871505788" target="_blank" rel="noopener noreferrer">Apple Podcasts</a>
            <a href="https://github.com/chipmates/agoracosmica" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
        </div>

        <div className="pub-footer__bottom">
          <p className="pub-footer__project">{t('footer.projectOf')}</p>
          <p className="pub-footer__trust">{t('footer.trustSignals')}</p>
        </div>
      </div>
    </footer>
  );
}
