// src/pages/LoginPage.tsx

import React, { useState, useEffect, useRef, useCallback, FC } from 'react';
import { Link } from 'react-router-dom';
import './LoginPage.css';
import CosmicBackground from '../components/CosmicBackground';
import LoginContainer from '../components/LoginContainer';
import CharacterLoginForm from '../components/CharacterLoginForm';
import MessagePopup from '../components/MessagePopup';
import LandscapeWarning from '../components/LandscapeWarning';
import ParadisoTransition from '../components/animations/ParadisoTransition';
import FigureController from '../components/animations/CosmicLoginTransition/FigureController';
import { useTranslation } from '../hooks/useTranslation';
import { Gavel, SpeakerSimpleHigh, SpeakerSimpleX, CaretDown, GithubLogo, ArrowSquareOut } from '@phosphor-icons/react';

// Music served from R2 (was bundled via vite import)
const MEDIA_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_MEDIA_BASE_URL || 'https://media.agoracosmica.org');
const backgroundMusic = `${MEDIA_BASE}/images/music/music.webm`;

// Window extension for loginFlashInProgress guard (was in CosmicLoginTransition)
declare global {
  interface Window {
    loginFlashInProgress?: boolean;
  }
}

interface LoginPageProps {
  onComplete: () => void;
}

type PopupType = 'error' | 'info' | 'success' | '';

const LoginPage: FC<LoginPageProps> = ({ onComplete }) => {
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFormVisible, setIsFormVisible] = useState<boolean>(false);
  const [isLandscape, setIsLandscape] = useState<boolean>(false);
  const [showPopup, setShowPopup] = useState<boolean>(false);
  const [popupMessage, setPopupMessage] = useState<string>('');
  const [popupType, setPopupType] = useState<PopupType>('');
  const [loginSuccessful, setLoginSuccessful] = useState<boolean>(false);
  const [showLegalMenu, setShowLegalMenu] = useState<boolean>(false);
  // React-managed overlays — replaces imperative document.createElement approach
  const [showSkipOverlay, setShowSkipOverlay] = useState<boolean>(false);
  // Paradiso rose + figure fade orchestration
  const [figuresActive, setFiguresActive] = useState(false);
  const [figureIndices, setFigureIndices] = useState<number[]>([]);
  const [portalAnimActive, setPortalAnimActive] = useState(false);

  const { t, tString, tNode } = useTranslation();

  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const completingRef = useRef(false);

  const prefersReducedMotion = useRef(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const revealForm = useCallback(() => {
    setIsFormVisible(true);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.5;

    // Start with muted appearance until audio plays
    setIsMuted(true);

    // Attempt to play audio immediately
    const playAudio = () => {
      audio.play()
        .then(() => {
          setIsMuted(false);
        })
        .catch(() => {
          // Autoplay blocked — user can unmute via audio toggle button
        });
    };

    // Play immediately
    playAudio();

    // Also try to play on user interaction with the page (first click/touch)
    const handleFirstInteraction = () => {
      playAudio();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);

    // Listen for when audio actually starts playing
    const handlePlay = () => {
      setIsMuted(false);
    };

    audio.addEventListener('play', handlePlay);

    // Skip initial wait if user prefers reduced motion
    if (prefersReducedMotion.current) {
      revealForm();
    } else {
      timerRef.current = setTimeout(revealForm, 6000);
    }

    const handleOrientation = () => {
      // Only block phone landscape (under 768px width and under 500px height)
      setIsLandscape(
        window.innerWidth > window.innerHeight && 
        window.innerWidth < 768 &&  // Only phones, not tablets
        window.innerHeight < 500     // Very short viewport indicating phone
      );
    };

    window.addEventListener('resize', handleOrientation);
    handleOrientation();

    return () => {
      audio.pause();
      audio.currentTime = 0;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('resize', handleOrientation);
      audio.removeEventListener('play', handlePlay);
    };
  }, [revealForm]);

  // Handle click outside to close legal menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.top-bar-left')) {
        setShowLegalMenu(false);
      }
    };

    if (showLegalMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showLegalMenu]);

  // Post-login: trigger Paradiso rose + figure fade after 500ms
  useEffect(() => {
    if (!loginSuccessful) return;
    const timer = setTimeout(() => {
      setPortalAnimActive(true);
      const figures = document.querySelectorAll<HTMLElement>('.historical-figure');
      setFigureIndices(Array.from(figures).map((_, i) => i));
      setFiguresActive(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [loginSuccessful]);

  // Escape key support for both animation phases
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (loginSuccessful) {
          handleInitialAnimationComplete();
        } else if (!isFormVisible) {
          handlePortalClick();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [loginSuccessful, isFormVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEntryComplete = () => {
    if (loginSuccessful) return; // Prevent double-submit

    // Skip post-login animation entirely if user prefers reduced motion
    if (prefersReducedMotion.current) {
      setLoginSuccessful(true);
      handleInitialAnimationComplete();
      return;
    }

    setShowSkipOverlay(true);
    setLoginSuccessful(true);
  };

  const handleInitialAnimationComplete = () => {
    // Guard against double invocation (Escape + click + ParadisoTransition timer)
    if (completingRef.current) return;
    completingRef.current = true;

    window.loginFlashInProgress = true;

    setShowSkipOverlay(false);

    setTimeout(() => {
      onComplete();
    }, 100);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // If audio hasn't started playing yet, try to play it
    if (audio.paused) {
      playBackgroundSound();
    } else {
      // Toggle mute state
      audio.muted = !audio.muted;
      setIsMuted(audio.muted);
    }
  };

  const playBackgroundSound = () => {
    const audio = audioRef.current;
    if (!audio) {
      console.error('Audio element not found');
      return;
    }
    
    // Ensure src is set (fallback logic from AudioControls)
    if (!audio.src || audio.src === window.location.href) {
      const source = audio.querySelector('source');
      if (source) {
        audio.src = source.src || backgroundMusic || '/assets/music.mp3';
      }
    }
    
    audio.play()
      .then(() => {
        setIsMuted(false);
      })
      .catch((error) => {
        console.error('Audio playback error:', error);
        // Try fallback approach
        audio.src = backgroundMusic || '/assets/music.mp3';
        audio.load();
        audio.play().then(() => {
          setIsMuted(false);
        }).catch(e => console.error('Fallback play failed:', e));
      });
  };

  const handlePortalClick = () => {
    if (!isFormVisible) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      revealForm();
    }
  };

  const showPopupMessage = (message: string, type: PopupType) => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  const closePopup = () => {
    setShowPopup(false);
  };

  if (isLandscape) {
    return <LandscapeWarning />;
  }

  // Full-screen click handler for initial animation skip
  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't intercept clicks on top-bar buttons
    const target = e.target as HTMLElement;
    if (target.closest('.top-bar-left') || target.closest('.top-bar-right')) return;

    // Only skip during initial animation (before form appears)
    if (!isFormVisible && !loginSuccessful) {
      handlePortalClick();
    }
  };

  return (
    <div className="background" onClick={handleBackgroundClick}>
      {/* Modular cosmic background — hide meteors once rose takes over */}
      <CosmicBackground hideMeteors={loginSuccessful} />

      {/* Modular login container with portal reference */}
      <LoginContainer
        ref={portalRef}
        isFormVisible={!loginSuccessful && isFormVisible}
        loginSuccessful={loginSuccessful}
        handlePortalClick={!loginSuccessful ? handlePortalClick : () => {}}
      >
        <CharacterLoginForm onComplete={handleEntryComplete} />
      </LoginContainer>

      {/* Figure fade-out — same sequential disappear as test page */}
      <FigureController active={figuresActive} figureIndices={figureIndices} />

      {/* Celestial Rose — replaces the old CosmicLoginTransition */}
      <ParadisoTransition
        isActive={portalAnimActive}
        variant={1}
        onAnimationComplete={handleInitialAnimationComplete}
        autoCompleteMs={15000}
      />

      {/* Full-screen skip overlay for post-login animation */}
      {loginSuccessful && showSkipOverlay && (
        <div
          className="skip-animation-overlay"
          onClick={handleInitialAnimationComplete}
          role="button"
          tabIndex={0}
          aria-label="Skip animation"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
              handleInitialAnimationComplete();
            }
          }}
        />
      )}

      {/* Split top bars - legal left, audio right */}
      <div className="top-bar-left">
        <button 
          className="legal-menu-button"
          onClick={() => setShowLegalMenu(!showLegalMenu)}
          aria-label={tString('legal.menuLabel', 'Legal information')}
          aria-expanded={showLegalMenu}
        >
          <Gavel size={18} className="legal-menu-icon" />
          <CaretDown size={14} className={`legal-menu-chevron ${showLegalMenu ? 'rotate' : ''}`} />
        </button>
        
        {showLegalMenu && (
          <div className="legal-dropdown">
            <Link to="/about" className="legal-dropdown-link">
              {tNode('legal.links.about')}
            </Link>
            <Link to="/impressum" className="legal-dropdown-link">
              {tNode('legal.links.imprint')}
            </Link>
            <Link to="/datenschutz" className="legal-dropdown-link">
              {tNode('legal.links.privacy')}
            </Link>
            <Link to="/nutzungsbedingungen" className="legal-dropdown-link">
              {tNode('legal.links.terms')}
            </Link>
            <Link to="/cookie-policy" className="legal-dropdown-link">
              {tNode('legal.links.cookiePolicy')}
            </Link>
            <a
              href="https://github.com/chipmates/agoracosmica"
              target="_blank"
              rel="noopener noreferrer"
              className="legal-dropdown-link"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <GithubLogo size={14} weight="regular" />
              <span>{tNode('legal.links.github')}</span>
              <ArrowSquareOut size={11} weight="regular" style={{ marginLeft: 'auto', opacity: 0.6 }} aria-hidden="true" />
            </a>
          </div>
        )}
      </div>
      
      <footer className={`site-attribution ${loginSuccessful ? 'site-attribution--hidden' : ''}`}>
        {tNode('app.attribution')}
      </footer>

      <div className="top-bar-right">
        <button
          className="audio-toggle-button"
          onClick={toggleMute}
          aria-label={isMuted ? tString('audio.unmute', 'Unmute') : tString('audio.mute', 'Mute')}
        >
          {isMuted ? (
            <SpeakerSimpleX size={18} className="audio-icon" />
          ) : (
            <SpeakerSimpleHigh size={18} className="audio-icon" />
          )}
        </button>
      </div>
      
      <audio ref={audioRef} loop preload="none">
        <source src={backgroundMusic} type="audio/webm" />
        {tNode('audio.browserNotSupported')}
      </audio>
      
      {/* Loading overlay removed — transition is fast enough without it */}

      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite">
        {isFormVisible && tNode('entry.formReady')}
      </div>

      {/* Modular message popup */}
      <MessagePopup
        showPopup={showPopup}
        popupMessage={popupMessage}
        popupType={popupType}
        closePopup={closePopup}
      />
      
    </div>
  );
};

export default LoginPage;
