// src/hooks/useTranslation.ts

import React, { useCallback } from 'react';
import { useDomainStore } from '../stores/domainStore';
import { Language, Translation } from '../types/global';

// Define translation variables type
interface TranslationVariables {
  returnObjects?: boolean;
  [key: string]: any;
}

// Define translation result type (can be string, array, or object)
type TranslationResult = string | string[] | Translation | Translation[];

interface UseTranslationResult {
  t: (key: string, variables?: TranslationVariables) => TranslationResult;
  tString: (key: string, fallback?: string) => string;
  tNode: (key: string) => React.ReactNode;
  tArray: (key: string) => string[];
  language: Language;
  setLanguage: (lang: string) => void;
  isLanguageSupported: (lang: string | null | undefined) => boolean;
  getSupportedLanguages: () => string[];
}

/**
 * Custom hook for accessing translated text
 * Uses Zustand domainStore to get current language and translation data
 *
 * @returns Translation utilities
 */
export function useTranslation(): UseTranslationResult {
  // Get language state from Zustand store
  const language = useDomainStore((state) => state.language.current);
  const uiTranslations = useDomainStore((state) => state.language.uiTranslations);
  const helpersTranslations = useDomainStore((state) => state.language.helpersTranslations);

  // Get language actions from Zustand store
  const setLanguage = useDomainStore((state) => state.setLanguage);
  const isLanguageSupported = useDomainStore((state) => state.isLanguageSupported);
  const getSupportedLanguages = useDomainStore((state) => state.getSupportedLanguages);
  
  // Dead translation sources removed — these were always undefined.
  // All translations use the main translations object via helpers prefix routing.
  
  /**
   * Get a translated string by key
   * Supports nested keys with dot notation, e.g., "settings.display.title"
   * Supports variable interpolation with {varName} syntax
   * Supports returnObjects parameter for backwards compatibility (ignored)
   * 
   * @param key - The translation key in dot notation
   * @param variables - Optional variables for interpolation (returnObjects is ignored)
   * @returns Translated content or key if translation not found
   * 
   * @example
   * // Basic usage
   * t('settings.title') // Returns: "Settings" or "Einstellungen"
   * 
   * @example
   * // With variable interpolation
   * t('welcome.user', { name: 'John' }) // Returns: "Welcome, John" or "Willkommen, John"
   * 
   * @example
   * // Array access (returnObjects parameter ignored)
   * t('menu.items') // Returns: ["Item 1", "Item 2", "Item 3"]
   */
  const t = useCallback((key: string, variables: TranslationVariables = {}): TranslationResult => {
    if (!uiTranslations && !helpersTranslations) return key;

    // Choose the right translation source
    const isHelpersKey = key.startsWith('helpers.');

    let translationSource: Translation | undefined;
    let processedKey: string;

    if (isHelpersKey) {
      translationSource = helpersTranslations;
      processedKey = key.substring(8); // Remove "helpers." prefix
    } else {
      translationSource = uiTranslations;
      processedKey = key;
    }

    if (!translationSource) return key;
    
    // Split key by dots to traverse nested objects
    const keys = processedKey.split('.');
    let result: any = translationSource;

    // Traverse the translations object
    for (const k of keys) {
      if (!result || !result[k]) {
        // Special handling for German translation structure differences
        if (language === 'de') {
          // For missing German keys, return empty array if expecting array
          if (variables.returnObjects === true) {
            console.warn(`German translation missing for key: ${processedKey}`);
            return [];
          }
        }
        return key; // Return original key if translation not found
      }
      result = result[k];
    }
    
    // Handle non-string results (arrays, objects, etc.)
    if (typeof result !== 'string') {
      // Return arrays and objects as-is for components that need them
      if (Array.isArray(result) || typeof result === 'object') {
        return result;
      }
      return key;
    }
    
    // If we get the key back as a string (meaning translation was not found)
    // and the original call was expecting an array (returnObjects: true), return empty array
    if (result === key && variables.returnObjects === true) {
      return [];
    }
    
    // Replace variables in the translated string
    let translatedText = result;
    
    // Filter out returnObjects parameter and replace all {variableName} with their values
    const filteredVariables = Object.fromEntries(
      Object.entries(variables).filter(([key]) => key !== 'returnObjects')
    );
    
    Object.entries(filteredVariables).forEach(([varName, value]) => {
      // Escape curly braces to prevent regex syntax error with numeric variable names
      const regex = new RegExp(`\\{${varName}\\}`, 'g');
      translatedText = translatedText.replace(regex, String(value));
    });
    
    return translatedText;
  }, [uiTranslations, helpersTranslations, language]);

  /**
   * Get translation as a string (safe for aria-labels, titles, etc.)
   * Returns fallback if translation is not a string
   *
   * @param key - Translation key
   * @param fallback - Fallback string if translation not found or not a string
   * @returns String value
   */
  const tString = useCallback((key: string, fallback?: string): string => {
    const result = t(key);

    // If result is a string, return it — unless it's the raw key or empty
    // (meaning translation was not found or is an empty placeholder)
    if (typeof result === 'string') {
      if ((result === key || result === '') && fallback !== undefined) {
        return fallback;
      }
      return result;
    }

    // If result is an array, try to get first string element
    if (Array.isArray(result)) {
      const firstString = result.find(item => typeof item === 'string');
      if (firstString) return firstString as string;
    }

    // Return fallback or key
    return fallback ?? key;
  }, [t]);

  /**
   * Get translation as ReactNode (safe for rendering in JSX)
   * Handles strings, arrays, and objects properly
   *
   * @param key - Translation key
   * @returns ReactNode value
   */
  const tNode = useCallback((key: string): React.ReactNode => {
    const result = t(key);

    // Strings and arrays are valid ReactNodes
    if (typeof result === 'string' || Array.isArray(result)) {
      return result as React.ReactNode;
    }

    // For Translation objects, try to extract meaningful content
    if (typeof result === 'object' && result !== null) {
      // Translation objects are complex - return key as fallback
      console.warn(`Translation key "${key}" returned object, expected string or array`);
      return key;
    }

    return key;
  }, [t]);

  /**
   * Get translation as array (safe for lists)
   *
   * @param key - Translation key
   * @returns Array of strings
   */
  const tArray = useCallback((key: string): string[] => {
    const result = t(key);

    // If already an array of strings, return it
    if (Array.isArray(result)) {
      return result.filter(item => typeof item === 'string') as string[];
    }

    // If string, wrap in array
    if (typeof result === 'string') {
      return [result];
    }

    // Return empty array as fallback
    return [];
  }, [t]);

  return {
    t,
    tString,
    tNode,
    tArray,
    language,
    setLanguage,
    isLanguageSupported,
    getSupportedLanguages
  };
}

export default useTranslation;