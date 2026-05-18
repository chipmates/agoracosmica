/**
 * CharacterLoginForm — Simple swipeable character selection.
 *
 * Swipe on mobile, click arrows on desktop.
 * Portrait, name, and tagline change together.
 */
import React, { useState, useRef, useCallback, FormEvent, FC } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import OptimizedImage from './OptimizedImage';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { preferencesIndexedDbAdapter } from '../storage/preferencesIndexedDbAdapter';
import './LoginForm.css';

// User avatar thumbnail served from R2
const MEDIA_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_MEDIA_BASE_URL || 'https://media.agoracosmica.org');
const userThumbnail = `${MEDIA_BASE}/images/figures/user/thumbnail/320.webp`;

interface Character {
  id: string;
  name: string;
  tagline: string;
  imageName: string | null;
}

const CHARACTERS: Character[] = [
  {
    id: 'seeker',
    name: '', // Filled from translation (Seeker / Suchende)
    tagline: '',
    imageName: null,
  },
  {
    id: 'dante',
    name: 'Dante',
    tagline: '',
    imageName: 'dante',
  },
  {
    id: 'beatrice',
    name: 'Beatrice',
    tagline: '',
    imageName: 'beatrice',
  },
  {
    id: 'custom',
    name: '',
    tagline: '',
    imageName: null,
  },
];

interface CharacterLoginFormProps {
  onComplete: () => void;
  beatriceImage?: string;
}

const CharacterLoginForm: FC<CharacterLoginFormProps> = ({ onComplete, beatriceImage = 'beatrice' }) => {
  const { tNode, tString, language } = useTranslation();

  const [index, setIndex] = useState(0);
  const [customName, setCustomName] = useState('');
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const touchStartX = useRef(0);

  const char = CHARACTERS[index];
  const seekerName = tString('entry.defaultName', 'Seeker');
  const displayName = char.id === 'custom' ? customName : char.id === 'seeker' ? seekerName : char.name;
  const isCustom = char.id === 'custom';

  const goTo = useCallback((next: number) => {
    const wrapped = ((next % CHARACTERS.length) + CHARACTERS.length) % CHARACTERS.length;
    if (wrapped === index) return;
    setTransitioning(true);
    setTimeout(() => {
      setIndex(wrapped);
      setTransitioning(false);
    }, 200);
  }, [index]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      goTo(dx < 0 ? index + 1 : index - 1);
    }
  }, [goTo, index]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    // Determine avatar value:
    // - Dante/Beatrice: store "figure:<id>" marker so ChatBox renders their portrait
    // - Custom: store data URL from uploaded image
    // - Wanderer: null (default cosmic avatar)
    let avatar: string | null = null;
    if (char.id === 'dante' || char.id === 'beatrice') {
      avatar = `figure:${char.id}`;
    } else if (char.id === 'custom' && customAvatar) {
      avatar = customAvatar;
    }

    try {
      await preferencesIndexedDbAdapter.setUserProfile({
        name: displayName.trim(),
        avatar,
        locale: language,
      });
    } catch (error) {
      console.error('Failed to save profile:', error);
    }

    onComplete();
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="entry-form">
      <style>{`
        .cs-tagline {
          text-align: center;
          color: var(--gold-subtle);
          font-style: italic;
          font-size: 0.8rem;
          line-height: 1.3;
          min-height: 2.4em;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s ease;
          margin-bottom: 0.15rem;
        }
        .cs-fade { opacity: 0; }

        .cs-identity-label {
          text-align: center;
          color: color-mix(in srgb, var(--text-primary) 52%, transparent);
          font-size: 0.72rem;
          letter-spacing: 0.04em;
          line-height: 1;
          margin: 0 0 0.45rem;
        }

        .cs-selector {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin: 0.25rem 0 0;
          user-select: none;
          touch-action: pan-y;
        }

        .cs-portrait {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid var(--gold-subtle);
          box-shadow: 0 0 14px color-mix(in srgb, var(--gold-subtle) 30%, transparent);
          transition: opacity 0.2s ease, transform 0.2s ease;
          flex-shrink: 0;
        }
        .cs-portrait.cs-fade {
          opacity: 0;
          transform: scale(0.92);
        }
        .cs-portrait img,
        .cs-portrait picture {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;

        }

        .cs-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: color-mix(in srgb, var(--bg-card) 60%, transparent);
          color: color-mix(in srgb, var(--gold-subtle) 50%, transparent);
          font-size: 1.4rem;
        }
        .cs-avatar-input {
          display: none;
        }

        .cs-arrow {
          background: none;
          border: none;
          cursor: pointer;
          color: color-mix(in srgb, var(--gold-subtle) 60%, transparent);
          padding: 4px;
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s ease;
          flex-shrink: 0;
        }
        .cs-arrow:hover {
          color: var(--gold-subtle);
        }

        /* Responsive portrait sizing */
        @media (min-width: 1366px) and (min-height: 800px) {
          .cs-portrait {
            width: 100px;
            height: 100px;
          }
          .cs-tagline {
            font-size: 0.9rem;
          }
        }
        @media (min-width: 1920px) {
          .cs-portrait {
            width: 120px;
            height: 120px;
          }
          .cs-tagline {
            font-size: 1rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .cs-portrait,
          .cs-tagline,
          .cs-charname {
            transition: none;
          }
        }
      `}</style>

      {/* Carousel label — card header, frames name + image as the user's own identity */}
      <div className="cs-identity-label">{tNode('entry.identityLabel')}</div>

      {/* Tagline — same style for all, Wanderer uses translated poem */}
      <div className={`cs-tagline ${transitioning ? 'cs-fade' : ''}`}>
        {char.id === 'seeker' ? (
          <>{tNode('entry.poem.line1')} {tNode('entry.poem.line2')}</>
        ) : (
          tNode(`entry.motto.${char.id}`)
        )}
      </div>

      {/* Portrait with arrows */}
      <div
        className="cs-selector"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          className="cs-arrow"
          onClick={() => goTo(index - 1)}
          aria-label="Previous character"
        >
          <CaretLeft size={28} weight="bold" />
        </button>

        <div className={`cs-portrait ${transitioning ? 'cs-fade' : ''}`}>
          {char.imageName ? (
            <OptimizedImage
              name={char.id === 'beatrice' ? beatriceImage : char.imageName}
              height="120px"
              alt={char.name}
              className=""
            />
          ) : char.id === 'seeker' ? (
            <img src={userThumbnail} alt={seekerName} />
          ) : (
            <label htmlFor="cs-avatar-upload" style={{ cursor: 'pointer', width: '100%', height: '100%', display: 'block' }}>
              {customAvatar ? (
                <img src={customAvatar} alt="Custom avatar" />
              ) : (
                <div className="cs-placeholder">+</div>
              )}
            </label>
          )}
        </div>

        <button
          type="button"
          className="cs-arrow"
          onClick={() => goTo(index + 1)}
          aria-label="Next character"
        >
          <CaretRight size={28} weight="bold" />
        </button>
      </div>

      {/* Custom avatar upload — hidden input, portrait circle triggers it */}
      {isCustom && (
        <input
          type="file"
          accept="image/*"
          className="cs-avatar-input"
          id="cs-avatar-upload"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => setCustomAvatar(reader.result as string);
            reader.readAsDataURL(file);
          }}
        />
      )}

      {/* Name input */}
      <div className="name-section">
        <input
          type="text"
          id="name"
          name="name"
          className="name-input"
          value={displayName}
          aria-label={tString('entry.nameLabel', 'Your name')}
          onChange={(e) => { if (isCustom) setCustomName(e.target.value); }}
          placeholder={isCustom ? tString('entry.namePlaceholder', 'Your name') : ''}
          maxLength={50}
          autoComplete="name"
          readOnly={!isCustom}
          required
        />
      </div>

      {/* Submit */}
      <div className="form-actions">
        <button type="submit" className="enter-button" disabled={!displayName.trim()}>
          {tNode('entry.button')}
        </button>
      </div>
    </form>
  );
};

export default CharacterLoginForm;
