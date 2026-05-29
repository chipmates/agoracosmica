import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  useLocation
} from 'react-router-dom';
// HomePage is the post-login app shell with the audio engine, council suite,
// chat, modals, and the rest of the in-app surface. Lazy-loaded so first-paint
// on / doesn't drag the whole bundle down. LoginPage stays eager — it IS the
// page at / for unauthenticated visitors, so an extra round-trip would be
// silly.
const HomePage = React.lazy(() => import('./pages/HomePage'));
import LoginPage from './pages/LoginPage';
import ImpressumPage from './pages/ImpressumPage';
import DatenschutzPage from './pages/DatenschutzPage';
import CookiePolicyPage from './pages/CookiePolicyPage';
import NutzungsbedingungenPage from './pages/NutzungsbedingungenPage';
// Public marketing pages now ship from the sibling Astro project (../marketing).
// CF Pages serves the prerendered HTML for /figures/*, /themes/*, /about,
// /contact directly; this React SPA only handles `/`, `/de/`, and the legal
// pages (Impressum, Datenschutz, Cookie Policy, Nutzungsbedingungen).
// Entry/signup beacons + the profile_created conversion now fire from the
// WelcomeDisclosureModal "Begin" (where profile + consent complete), not here.
// captureGclid() still runs in index.tsx; sendConversion reads sessionStorage.
// Dev/test pages — only imported in dev mode so Vite excludes them from production build.
// Kept lean: contributor-facing diagnostics and benchmarks only. Internal A/B harnesses
// and visual-design experiments live in the private workspace.
const devPages = import.meta.env.DEV ? {
  ColorContrastTest: React.lazy(() => import('./components/ColorContrastTest')),
  WebGPUDiagnostic: React.lazy(() => import('./pages/WebGPUDiagnostic').then(m => ({ default: m.WebGPUDiagnostic }))),
  TTSBench: React.lazy(() => import('./pages/TTSBench').then(m => ({ default: m.TTSBench }))),
  TtsQualityLab: React.lazy(() => import('./pages/TtsQualityLab').then(m => ({ default: m.TtsQualityLab }))),
} : {} as Record<string, React.LazyExoticComponent<any>>;
const SuspenseWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <React.Suspense fallback={<div style={{ padding: 40, color: 'var(--text-primary)' }}>Loading...</div>}>
    {children}
  </React.Suspense>
);
import SkipLinks from './components/Accessibility/SkipLinks';
import LiveRegion from './components/Accessibility/LiveRegion';
import { OrientationLock } from './components/OrientationLock';
const FigureTestModal = import.meta.env.DEV
  ? React.lazy(() => import('./components/FigureTestModal').then(m => ({ default: m.FigureTestModal })))
  : null;
import { initBatteryMonitoring } from './utils/deviceDetection';
import { createSessionController, createConversationController, createCouncilController } from './controllers';
import type { SessionController, ConversationController, CouncilControllerInstance } from './controllers';
import { subscribeSessionControllerHandlers } from './controllers/sessionControllerRegistry';
import { subscribeConversationControllerHandlers } from './controllers/conversationControllerRegistry';
import { useDomainStore } from './stores';
import { LocalStorageAdapter } from './storage/localAdapter';
import { preferencesIndexedDbAdapter } from './storage/preferencesIndexedDbAdapter';
import { useAutoplayGate } from './hooks/useAutoplayGate';
import { initAudioQueue } from './services/audio/audioQueueManager';
import { useSelfHostKeyGate } from './hooks/useSelfHostKeyGate';

// Touch target utilities — only in development
if (import.meta.env.DEV) {
  import('./utils/accessibility/touchTargetValidator');
  import('./utils/accessibility/touchTargetTest');
}

// Design System Migration - Phase 1 Complete!
// Global styles in index.css

// Simplified viewport handling (PWA removed for now - 0% usage in beta)
// Viewport styles now in index.css
// import './styles/viewport-fixes.css';     // 371 lines of PWA handling - DISABLED
// import './styles/layout-overrides.css';   // 237 lines of conflict fixes - NOT NEEDED

// Extend window interface for global settings modal
declare global {
  interface Window {
    openSettingsModal: (tab?: string) => void;
  }
}

// Catch-all redirect that preserves the current URL's search string. Default
// <Navigate to="/" /> drops query params, which would lose the gclid on
// landings that fall through to the catch-all (e.g. unknown sub-path with
// ?gclid=… should still arrive at / with gclid intact).
function NavigateKeepingSearch({ to }: { to: string }): React.ReactElement {
  const { search } = useLocation();
  return <Navigate to={{ pathname: to, search }} replace />;
}

function App(): React.ReactElement {
  // Initialize from localStorage hint (synchronous) to avoid login flash on refresh
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(
    () => LocalStorageAdapter.getString('isLoggedIn') === 'true'
  );
  const [showTestModal, setShowTestModal] = useState<boolean>(false); // Figure Test Modal
  const sessionControllerRef = useRef<SessionController | null>(null);
  const conversationControllerRef = useRef<ConversationController | null>(null);
  const councilControllerRef = useRef<CouncilControllerInstance | null>(null);

  // ✅ Production-grade audio gate (resettable promise barrier + muted priming)
  const { unlock, waitUntilReady, getContext, getAudioElement, state } = useAutoplayGate();

  // Self-host builds gate the app behind BYOK key setup once the user is
  // logged in. No-op in the hosted build.
  useSelfHostKeyGate(isLoggedIn);

  useEffect(() => {
    // Dev helpers to inspect Zustand state quickly
    if (import.meta.env.DEV) {
      const w = window as any;
      if (!w.__dumpStore) {
        w.__dumpStore = () => useDomainStore.getState();
      }
      if (!w.__dumpSelection) {
        w.__dumpSelection = () => {
          const s = useDomainStore.getState();
          return {
            figureId: s.figures.selectedId,
            seedId: s.seeds.selectedId,
            mode: s.mode.selected,
            historyKey: s.conversation.historyKey,
            pendingRequestId: s.conversation.pendingRequestId,
            messagesCount: s.conversation.messages.length,
          };
        };
      }
      console.log('[Mode2Triage] Dev helpers available: __dumpStore(), __dumpSelection()');
    }

    // Keyboard shortcut: Ctrl/Cmd + Shift + T to open test modal (dev only)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (import.meta.env.DEV && (e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        setShowTestModal(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Set performance tier attribute on <html> for global CSS adaptation
    import('./utils/performanceDetector').then(({ getCachedPerformanceTier }) => {
      document.documentElement.setAttribute('data-perf-tier', getCachedPerformanceTier());
    });

    // Check if user profile exists in IndexedDB (BYOK architecture)
    preferencesIndexedDbAdapter.hasUserProfile().then(hasProfile => {
      if (hasProfile) {
        setIsLoggedIn(true);
      }
    });
    
    // PWA viewport fixes removed - no longer needed
    
    
    // One-time migration: clear old mobile audio flags
    if (LocalStorageAdapter.getString('hasShownMobileTTSNotice') || LocalStorageAdapter.getString('ttsConfigured')) {
      LocalStorageAdapter.remove('hasShownMobileTTSNotice');
      LocalStorageAdapter.remove('ttsConfigured');
      LocalStorageAdapter.remove('mobileAudioConfigured');
    }

    // ✅ PRODUCTION-GRADE UNIVERSAL AUDIO UNLOCK (2025 Best Practices)
    // Captures ANY first user interaction to unlock audio globally
    // Uses resettable promise barrier + muted HTMLAudioElement priming
    //
    // Benefits:
    // - One-tap unlock (not per-component)
    // - Always validates AudioContext state (not just localStorage)
    // - Works after backgrounding
    // - No fallback button needed!

    const unlockOnFirstTouch = async () => {
      if (import.meta.env.DEV) {
        console.log('[App] 🎯 Universal unlock triggered by user interaction');
      }

      try {
        // Unlock both AudioContext AND HTMLAudioElement
        await unlock();

        // Get the primed element (CRITICAL: must reuse this exact instance!)
        const primedElement = getAudioElement();

        // Initialize audio queue with promise barrier AND primed element
        const ctx = getContext();
        initAudioQueue(ctx, waitUntilReady, primedElement, {
          maxItems: 100,
          maxBytes: 64 * 1024 * 1024  // 64MB
        });

        // Persist unlock state (hint for next reload)
        LocalStorageAdapter.setString('audioUnlocked', 'true');

        if (import.meta.env.DEV) {
          console.log('[App] ✅ Audio unlocked and queue initialized with PRIMED element');
        }
      } catch (error) {
        console.error('[App] ❌ Universal unlock failed:', error);
      }
    };

    // CRITICAL: Always check AudioContext state, don't trust localStorage alone
    // AudioContext is ALWAYS suspended on page load, even if we unlocked in previous session
    const ctx = getContext();

    if (ctx.state !== 'running' || state !== 'unlocked') {
      // Need to unlock - register listeners for first user interaction
      // localStorage is just a hint; actual state check is authoritative

      document.addEventListener('touchstart', unlockOnFirstTouch, {
        once: true,
        passive: true
      });
      document.addEventListener('click', unlockOnFirstTouch, {
        once: true
      });

      if (import.meta.env.DEV) {
        console.log('[App] 🎧 Universal unlock listeners registered', {
          contextState: ctx.state,
          gateState: state,
          wasUnlockedBefore: LocalStorageAdapter.getString('audioUnlocked') === 'true'
        });
      }
    } else {
      // Context is already running (shouldn't happen on page load, but handle it)
      const primedElement = getAudioElement();
      initAudioQueue(ctx, waitUntilReady, primedElement, {
        maxItems: 100,
        maxBytes: 64 * 1024 * 1024
      });

      if (import.meta.env.DEV) {
        console.log('[App] ✅ AudioContext already running, queue initialized with primed element');
      }
    }

    // Initialize battery monitoring for animation optimization
    initBatteryMonitoring();
    
    // Set up global access to settings for notifications
    window.openSettingsModal = (tab?: string) => {
      // Dispatch an event that components can listen for
      window.dispatchEvent(new CustomEvent('openSettingsRequest', { 
        detail: { tab: tab || 'voice' }
      }));
    };

    // Mobile audio restrictions REMOVED (October 2025)
    // With self-hosted TTS + STT on GEX130, mobile users now have audio enabled by default.

    // Cleanup function
    return () => {
      // Remove keyboard shortcut listener
      window.removeEventListener('keydown', handleKeyDown);
      // Note: Touch/click listeners auto-remove via { once: true }
    };
  }, []); // ✅ Empty deps - only run once on mount (listeners are stable)

  useEffect(() => {
    if (!sessionControllerRef.current) {
      sessionControllerRef.current = createSessionController();
    }

    const controller = sessionControllerRef.current;
    const unsubscribeHandlers = subscribeSessionControllerHandlers((handlers) => {
      controller.updateHandlers(handlers);
    });

    controller.start();

    return () => {
      unsubscribeHandlers();
      controller.stop();
    };
  }, []);

  useEffect(() => {
    if (!conversationControllerRef.current) {
      conversationControllerRef.current = createConversationController();
    }

    const controller = conversationControllerRef.current;
    const unsubscribeHandlers = subscribeConversationControllerHandlers((deps) => {
      controller.updateHandlers(deps);
    });

    controller.start();
    if (import.meta.env.DEV) {
      console.log('[Mode2Triage][Controller] started');
    }

    return () => {
      unsubscribeHandlers();
      controller.stop();
    };
  }, []);

  useEffect(() => {
    if (!councilControllerRef.current) {
      councilControllerRef.current = createCouncilController();
    }

    const controller = councilControllerRef.current;
    controller.start();

    return () => {
      controller.stop();
    };
  }, []);

  const handleEntryComplete = (): void => {
    // Clean up any overlays that might be blocking interaction
    const cleanupOverlays = (): void => {
      // Remove animation overlays by ID
      const skipOverlay = document.getElementById('skip-animation-overlay');
      if (skipOverlay && document.body.contains(skipOverlay)) {
        document.body.removeChild(skipOverlay);
      }
      
      // Remove any elements that might be blocking interaction
      document.querySelectorAll<HTMLDivElement>('div[style*="position: fixed"][style*="width: 100%"][style*="height: 100%"]').forEach(el => {
        if (el.parentNode === document.body) {
          document.body.removeChild(el);
        }
      });
      
      // Remove any cosmic login transition elements
      document.querySelectorAll('.cosmic-login-transition').forEach(el => {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
      
      // Ensure body has pointer events enabled
      document.body.style.pointerEvents = 'auto';
    };
    
    // The cinematic only plays for visitors without a stored profile, so they
    // all need the welcome step next. Profile creation, consent, the entry /
    // signup beacons, and the profile_created conversion now live there (the
    // WelcomeDisclosureModal "Begin"); this just opens it.
    sessionStorage.setItem('showOnboarding', 'true');

    // Clean up before setting logged in state
    cleanupOverlays();

    // Set login state (persist hint for page refresh)
    LocalStorageAdapter.setString('isLoggedIn', 'true');
    setIsLoggedIn(true);

    // Clean up again after a short delay (in case React rerenders add new elements)
    setTimeout(cleanupOverlays, 100);
  };

  const handleLogout = (): void => {
    // Clear the session, then send the user back to the public homepage.
    // The entry page is now a cinematic (no profile form), so dropping back
    // into it on logout would loop oddly — agoracosmica.org is the right place
    // to land. Delete the profile first, then navigate.
    LocalStorageAdapter.remove('isLoggedIn');
    preferencesIndexedDbAdapter.deleteUserProfile()
      .catch((err) => console.error('Failed to delete profile:', err))
      .finally(() => { window.location.href = '/'; });

    // Conversation history, selected figure, onboarding status, and preferences
    // are intentionally preserved between sessions.
  };

  // Create router with future flags — memoized to prevent recreation on unrelated re-renders
  const router = useMemo(() => createBrowserRouter([
    {
      path: "/",
      element: (
        <div className="App">
          <SkipLinks />
          <LiveRegion />
          <OrientationLock />
          <Outlet />
          {/* Test Modal - Press Ctrl/Cmd + Shift + T to toggle (dev only) */}
          {import.meta.env.DEV && FigureTestModal && (
            <FigureTestModal
              isOpen={showTestModal}
              onClose={() => setShowTestModal(false)}
            />
          )}
          {/* <PWAInstallPrompt /> REMOVED - PWA disabled */}
        </div>
      ),
      children: [
        {
          path: "impressum",
          element: <ImpressumPage />
        },
        {
          path: "datenschutz",
          element: <DatenschutzPage />
        },
        {
          path: "cookie-policy",
          element: <CookiePolicyPage />
        },
        {
          path: "nutzungsbedingungen",
          element: <NutzungsbedingungenPage />
        },
        {
          path: "terms",
          element: <NutzungsbedingungenPage />
        },
        // Dev/test routes — only accessible in development builds
        ...(import.meta.env.DEV ? [
          { path: "color-test", element: <devPages.ColorContrastTest /> },
          { path: "diagnostic/webgpu", element: <devPages.WebGPUDiagnostic /> },
          { path: "bench/tts", element: <SuspenseWrap><devPages.TTSBench /></SuspenseWrap> },
          { path: "test/tts-quality", element: <SuspenseWrap><devPages.TtsQualityLab /></SuspenseWrap> },
        ] : []),
        {
          index: true,
          element: isLoggedIn ? (
            <SuspenseWrap>
              <HomePage
                onLogout={handleLogout}
                onSelectFigure={() => {}}
              />
            </SuspenseWrap>
          ) : (
            <LoginPage onComplete={handleEntryComplete} />
          )
        },
        {
          path: "*",
          element: <NavigateKeepingSearch to="/app" />
        }
      ]
    }
  ], {
    // The React SPA shell is served from /app (and /app/*) — the static
    // marketing homepage owns /. basename keeps React Router matching the
    // index route against location.pathname "/app" instead of bouncing to
    // the catch-all and redirecting out to the static homepage.
    basename: "/app",
    // Add future flags to prepare for React Router v7
    future: {
      // v7_startTransition: true, // Not yet in type definitions
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true
    } as any // Type assertion for forward compatibility
  }), [isLoggedIn, showTestModal]);

  return <RouterProvider router={router} />;
}

export default App;
