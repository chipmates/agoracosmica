import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTranslation } from '../../hooks/useTranslation';
import type { Translation, Language } from '../../types/global';

// Hoist the mock state so vi.mock can reference it
const mockState = vi.hoisted(() => ({
  language: {
    current: 'en' as Language,
    uiTranslations: {} as Translation,
    seedTitlesTranslations: {},
    helpersTranslations: {},
    isLoading: false,
    error: null
  },
  setLanguage: vi.fn(),
  isLanguageSupported: vi.fn(() => true),
  getSupportedLanguages: vi.fn(() => ['en', 'de']),
  getSeedTitle: vi.fn(() => null)
}));

vi.mock('../../stores/domainStore', () => ({
  useDomainStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockState);
    }
    return mockState;
  }
}));

describe('Translation System - Critical Path', () => {
  const setupMockStore = (translations: Translation, language: Language = 'en') => {
    mockState.language.current = language;
    mockState.language.uiTranslations = translations;
  };

  it('should return string for simple key', () => {
    setupMockStore({
      settings: {
        title: 'Settings',
      }
    });

    const { result } = renderHook(() => useTranslation());
    const text = result.current.t('settings.title');

    expect(typeof text).toBe('string');
    expect(text).toBe('Settings');
  });

  it('should handle nested objects', () => {
    setupMockStore({
      settings: {
        audio: {
          title: 'Audio Settings'
        }
      }
    });

    const { result } = renderHook(() => useTranslation());
    const text = result.current.t('settings.audio.title');

    expect(typeof text).toBe('string');
    expect(text).toBe('Audio Settings');
  });

  it('should return key if translation missing', () => {
    setupMockStore({
      settings: {
        title: 'Settings'
      }
    });

    const { result } = renderHook(() => useTranslation());
    const text = result.current.t('nonexistent.key');

    expect(text).toBe('nonexistent.key');
  });

  it('should handle variable interpolation', () => {
    setupMockStore({
      welcome: {
        message: 'Hello, {name}!'
      }
    });

    const { result } = renderHook(() => useTranslation());
    const text = result.current.t('welcome.message', { name: 'Michel' });

    expect(typeof text).toBe('string');
    expect(text).toBe('Hello, Michel!');
  });

  it('should handle arrays', () => {
    setupMockStore({
      menu: {
        items: ['Home', 'Settings', 'About']
      }
    });

    const { result } = renderHook(() => useTranslation());
    const items = result.current.t('menu.items');

    expect(Array.isArray(items)).toBe(true);
    expect(items).toHaveLength(3);
    expect(items).toEqual(['Home', 'Settings', 'About']);
  });

  it('should return current language', () => {
    setupMockStore({}, 'de');

    const { result } = renderHook(() => useTranslation());

    expect(result.current.language).toBe('de');
  });

  it('should handle empty translation object gracefully', () => {
    setupMockStore({});

    const { result } = renderHook(() => useTranslation());
    const text = result.current.t('any.key');

    expect(text).toBe('any.key');
  });

  it('should handle deeply nested paths', () => {
    setupMockStore({
      app: {
        nav: {
          menu: {
            user: {
              profile: 'User Profile'
            }
          }
        }
      }
    });

    const { result } = renderHook(() => useTranslation());
    const text = result.current.t('app.nav.menu.user.profile');

    expect(typeof text).toBe('string');
    expect(text).toBe('User Profile');
  });
});
