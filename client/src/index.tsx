import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css'; // Base design system must load first
// Global styles now in index.css only
// Browser fixes and typography now in index.css
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import NetworkStatusBanner from './components/NetworkStatusBanner';
import RateLimitModal from './components/RateLimitModal';
import BYOKSetupModal from './components/BYOKSetupModal';
import { useDomainStore } from './stores/domainStore';
import { initializeSeedsCache } from './services/seedCacheInitializer';
import { LocalStorageAdapter } from './storage/localAdapter';
import { captureGclid } from './utils/public/gclidCapture';
import { captureEntryIntentFromUrl } from './utils/public/entryIntent';
import { sendPageBeacon } from './utils/pageBeacon';
import { migrateHistoryToEncrypted } from './services/history/historyEncryptionMigration';

// Capture gclid from the landing URL before any router redirect can strip it.
// Must run synchronously at module load. Running inside a React effect is too
// late, because the catch-all Navigate in App.tsx rewrites the URL before
// App's effect fires.
captureGclid();

// Capture a figure/council deep-link (?figure=/?council=) from the landing URL
// before the catch-all router redirect can strip it, for the same reason as
// gclid above. Writes sessionStorage that the onboarding / returning-visitor
// consumer reads, so a shared or new-tab /app?figure=marcus-aurelius lands on
// that figure's mode selector.
captureEntryIntentFromUrl();

// Page-load beacon: count this arrival in analytics. Anonymous, fire-and-forget.
// Closes the gap between landing-page render and the existing engagement events
// (chat, playback) so we can measure true bounce rate.
sendPageBeacon();
// Service Worker registration (DISABLED until Q1 2026 - Offline Mode implementation)
// Currently causes 404 errors since service-worker.js doesn't exist yet
// Roadmap: CLAUDE.md Q1 2026 - Offline Mode with service worker
/*
if ('serviceWorker' in navigator && import.meta.env.MODE === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered:', registration.scope);

        // Check for updates every time the app loads
        registration.update();

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content available, could show update prompt here
                console.log('[PWA] New content available - refresh to update');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[PWA] Service Worker registration failed:', error);
      });
  });
}
*/

// Helper function to detect browser language (same logic as in LanguageContext)
const detectBrowserLanguage = (): string => {
  // Check if user has already selected a language
  const savedLanguage = LocalStorageAdapter.getString('selectedLanguage');
  if (savedLanguage) {
    return savedLanguage;
  }
  
  // Get browser language
  const browserLang = navigator.language || 'en';
  
  // Check if it's a German variant (de, de-DE, de-AT, de-CH, etc.)
  if (browserLang.toLowerCase().startsWith('de')) {
    return 'de';
  }
  
  // Default to English for all other languages
  return 'en';
};

// Initialize language in Zustand store (must happen before React render)
// This ensures language is available synchronously for the first render
const selectedLanguage: string = detectBrowserLanguage();

// Initialize the language store immediately
useDomainStore.getState().initializeLanguage();

// Initialize seeds cache for enhanced seed data processing
initializeSeedsCache(selectedLanguage).catch((error: Error) => {
  if (import.meta.env.MODE === 'development') {
    console.warn(`Seeds cache initialization failed for ${selectedLanguage}:`, error);
  }
});

// Global handler for unhandled promise rejections — prevents silent crashes
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global] Unhandled promise rejection:', event.reason);
  // Don't crash the app — just log it
  event.preventDefault();
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);

// Production-optimized: StrictMode only in development
const AppRoot: React.FC = () => (
  <ErrorBoundary>
    <NetworkStatusBanner />
    <RateLimitModal />
    <BYOKSetupModal />
    <App />
  </ErrorBoundary>
);

root.render(
  import.meta.env.MODE === 'development' ? (
    <React.StrictMode>
      <AppRoot />
    </React.StrictMode>
  ) : (
    <AppRoot />
  )
);

// After first paint, encrypt any legacy plaintext conversation histories at
// rest. Idempotent, non-blocking, and never destroys data.
void migrateHistoryToEncrypted();
