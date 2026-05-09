// Root layout wrapper for all public pages
// Provides: language context, navbar, footer, breadcrumbs, scroll override
// Remove this file when stripping marketing pages from a fork

import { Outlet } from 'react-router-dom';
import { PublicLangProvider } from './PublicLangContext';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';
import '../../styles/public/public-layout.css';
import '../../styles/public/public-pages.css';
import '../../styles/public/public-cards.css';

export default function PublicLayout() {
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
