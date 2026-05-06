// Public SEO pages - remove this import and the pages/public +
// components/public dirs to strip marketing pages from a fork

import React from 'react';
import type { RouteObject } from 'react-router-dom';

const PublicLayout = React.lazy(() => import('../components/public/PublicLayout'));
const FiguresCatalogPage = React.lazy(() => import('../pages/public/FiguresCatalogPage'));
const FigureDetailPage = React.lazy(() => import('../pages/public/FigureDetailPage'));
const ThemesCatalogPage = React.lazy(() => import('../pages/public/ThemesCatalogPage'));
const ThemeDetailPage = React.lazy(() => import('../pages/public/ThemeDetailPage'));
const AboutPage = React.lazy(() => import('../pages/public/AboutPage'));
const ContactPage = React.lazy(() => import('../pages/public/ContactPage'));

const Suspend = ({ children }: { children: React.ReactNode }) => (
  <React.Suspense fallback={<div style={{ padding: '4rem 1.5rem', color: 'var(--text-primary, #fff)' }}>Loading...</div>}>
    {children}
  </React.Suspense>
);

function wrap(Component: React.LazyExoticComponent<React.ComponentType>) {
  return <Suspend><Component /></Suspend>;
}

export const publicRouteObjects: RouteObject[] = [
  {
    element: <Suspend><PublicLayout /></Suspend>,
    children: [
      // English (default, no prefix)
      { path: '/figures', element: wrap(FiguresCatalogPage) },
      { path: '/figures/:slug', element: wrap(FigureDetailPage) },
      { path: '/themes', element: wrap(ThemesCatalogPage) },
      { path: '/themes/:theme', element: wrap(ThemeDetailPage) },
      { path: '/about', element: wrap(AboutPage) },
      { path: '/contact', element: wrap(ContactPage) },
      // German (/de/ prefix)
      { path: '/de/figures', element: wrap(FiguresCatalogPage) },
      { path: '/de/figures/:slug', element: wrap(FigureDetailPage) },
      { path: '/de/themes', element: wrap(ThemesCatalogPage) },
      { path: '/de/themes/:theme', element: wrap(ThemeDetailPage) },
      { path: '/de/about', element: wrap(AboutPage) },
      { path: '/de/contact', element: wrap(ContactPage) },
    ],
  },
];
