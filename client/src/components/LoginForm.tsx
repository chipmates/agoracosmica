// src/components/LoginForm.tsx
import React, { useState, FormEvent, FC } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { preferencesIndexedDbAdapter } from '../storage/preferencesIndexedDbAdapter';
import AvatarUpload from './AvatarUpload';
import './LoginForm.css';

// User avatar thumbnail served from R2
const MEDIA_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_MEDIA_BASE_URL || 'https://media.agoracosmica.org');
const userThumbnail = `${MEDIA_BASE}/images/figures/user/thumbnail/320.webp`;

interface LoginFormProps {
  onComplete: () => void;
}

/**
 * LoginForm - Entry page form component
 *
 * BYOK Architecture: No authentication, just profile creation
 * - Collects user name and optional avatar
 * - Stores profile in IndexedDB (not server)
 * - Enables direct entry without authentication
 *
 * Component name kept as "LoginForm" for routing/import compatibility,
 * even though it's now an entry form, not authentication.
 */
const LoginForm: FC<LoginFormProps> = ({ onComplete }) => {
  const { t, tString, tNode, language } = useTranslation();

  const [name, setName] = useState<string>(() => tString('entry.defaultName', 'Seeker'));
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name.trim()) {
      return;
    }

    setSaving(true);

    try {
      setSaveError(null);
      // Save profile to encrypted IndexedDB (AES-256-GCM)
      await preferencesIndexedDbAdapter.setUserProfile({
        name: name.trim(),
        avatar,
        locale: language,
      });

      // Navigate to app (callback handled by parent)
      onComplete();
    } catch (error) {
      console.error('Failed to save profile:', error);
      setSaveError(tString('entry.saveFailed', 'Couldn\'t save your profile. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="entry-form">
      {/* Poetic entry text */}
      <div className="entry-poem">
        <span className="poem-line-1">
          {tNode('entry.poem.line1')}
        </span>
        <span className="poem-line-2">
          {tNode('entry.poem.line2')}
        </span>
      </div>

      {/* Avatar upload */}
      <div className="avatar-section">
        <AvatarUpload
          value={avatar}
          onChange={setAvatar}
          defaultImage={userThumbnail}
        />
      </div>

      {/* Name input */}
      <div className="name-section">
        <input
          type="text"
          id="name"
          name="name"
          className="name-input"
          value={name}
          aria-label={tString('entry.nameLabel', 'Your name')}
          onChange={(e) => setName(e.target.value)}
          placeholder={tString('entry.namePlaceholder', '')}
          maxLength={50}
          autoComplete="name"
          required
        />
      </div>

      {/* Error message */}
      {saveError && (
        <div role="alert" className="entry-error" style={{
          color: 'var(--error-color, #ef4444)',
          fontSize: '14px',
          textAlign: 'center',
          padding: '8px 0',
        }}>
          {saveError}
        </div>
      )}

      {/* Submit button */}
      <div className="form-actions">
        <button
          type="submit"
          className="enter-button"
          disabled={saving || !name.trim()}
        >
          {saving ? tNode('entry.saving') : tNode('entry.button')}
        </button>
      </div>
    </form>
  );
};

export default LoginForm;
