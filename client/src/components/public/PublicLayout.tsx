// Root layout wrapper for all public pages
// Provides: language context, navbar, footer, breadcrumbs, scroll override
// Remove this file when stripping marketing pages from a fork

import { useEffect } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { PublicLangProvider } from './PublicLangContext';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';
import '../../styles/public/public-layout.css';
import '../../styles/public/public-pages.css';
import '../../styles/public/public-cards.css';

export default function PublicLayout() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  // Reset scroll to the top when navigating between public pages. Without this
  // a route change keeps the previous scroll position, so a page opens partway
  // down. Browser back and forward (POP) are left alone so the previous
  // position can restore.
  useEffect(() => {
    if (navigationType !== 'POP') {
      window.scrollTo(0, 0);
    }
  }, [pathname, navigationType]);

  return (
    <PublicLangProvider>
      <div className="public-page">
        <PublicNavbar />
        <main className="pub-main" id="main-content">
          <Outlet />
        </main>
        <PublicFooter />
      </div>
    </PublicLangProvider>
  );
}
