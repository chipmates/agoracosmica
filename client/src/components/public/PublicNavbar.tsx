// Public page navigation bar
// Remove this file when stripping marketing pages from a fork

import { useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePublicLang } from './PublicLangContext';
import { publicUrl, stripLangPrefix } from '../../utils/public/publicSeo';
import { sendConversion } from '../../utils/public/gclidCapture';

export default function PublicNavbar() {
  const { lang, t } = usePublicLang();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = useCallback(() => setMenuOpen(prev => !prev), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // The "Start Exploring" CTA in the navbar is the explicit entry into the
  // funnel. Fire the conversion synchronously inside the click; sendConversion
  // is idempotent per tab and no-ops if no gclid was captured. The link is a
  // hard <a href> that navigates away, so the fetch uses keepalive to survive
  // page unload.
  const handleStartExploring = useCallback((): void => {
    sendConversion('start_exploring');
    closeMenu();
  }, [closeMenu]);

  const basePath = stripLangPrefix(location.pathname);
  const otherLang = lang === 'de' ? 'en' : 'de';
  const langSwitchUrl = otherLang === 'de' ? `/de${basePath}` : basePath;

  const navLinks = [
    { to: publicUrl(lang, '/figures'), label: t('nav.figures') },
    { to: publicUrl(lang, '/themes'), label: t('nav.themes') },
    { to: publicUrl(lang, '/about'), label: t('nav.about') },
    { to: publicUrl(lang, '/contact'), label: t('nav.contact') },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="pub-navbar liquid-glass--sidebar">
      <div className="pub-navbar__inner">
        <Link to={publicUrl(lang, '/figures')} className="pub-navbar__logo" onClick={closeMenu}>
          <span className="pub-navbar__logo-name">Agora Cosmica</span>
          <span className="pub-navbar__logo-tagline">{t('footer.tagline')}</span>
        </Link>

        <nav
          className={`pub-navbar__nav ${menuOpen ? 'pub-navbar__nav--open' : ''}`}
          aria-label="Main navigation"
        >
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`pub-navbar__link ${isActive(link.to) ? 'pub-navbar__link--active' : ''}`}
              onClick={closeMenu}
            >
              {link.label}
            </Link>
          ))}

          <Link
            to={langSwitchUrl}
            className="pub-navbar__lang"
            onClick={closeMenu}
            aria-label={`Switch to ${otherLang === 'de' ? 'German' : 'English'}`}
          >
            {otherLang.toUpperCase()}
          </Link>

          <a href="/" className="pub-navbar__cta" onClick={handleStartExploring}>
            {t('nav.startExploring')}
          </a>
        </nav>

        <button
          className="pub-navbar__burger"
          onClick={toggleMenu}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? t('nav.closeMenu') : t('nav.menu')}
        >
          <span className="pub-navbar__burger-line" />
          <span className="pub-navbar__burger-line" />
          <span className="pub-navbar__burger-line" />
        </button>
      </div>
    </header>
  );
}
