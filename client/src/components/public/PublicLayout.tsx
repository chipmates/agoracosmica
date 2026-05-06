// Root layout wrapper for all public pages
// Provides: language context, navbar, footer, breadcrumbs, scroll override
// Remove this file when stripping marketing pages from a fork

import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { PublicLangProvider } from './PublicLangContext';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';
import { captureGclid } from '../../utils/public/gclidCapture';
import '../../styles/public/public-layout.css';
import '../../styles/public/public-pages.css';
import '../../styles/public/public-cards.css';

export default function PublicLayout() {
  // Capture gclid from URL on first render (Google Ads click tracking)
  useEffect(() => { captureGclid(); }, []);

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
