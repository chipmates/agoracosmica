// useFactCheck.ts - Hook to load factcheck data for figures
import { useState, useEffect } from 'react';
import { useDomainStore } from '../stores/domainStore';

// TypeScript interfaces matching the JSON schema
export interface FactCheckStory {
  number: number;
  title: string;
  year: string;
  age: string;
  setting: string;
  basis: 'documented' | 'mixed' | 'recreated';
  documented: string[];
  recreated: string[];
  note?: string;
}

export interface RealPerson {
  name: string;
  role: string;
  stories: number[];
  note?: string;
}

export interface CompositeCharacter {
  name: string;
  story: number;
  represents: string;
}

export interface FactCheckQuotes {
  documented: Array<{ quote: string; source: string }>;
  approach: string;
}

export interface FactCheckSources {
  primary: string[];
  scholarly: string[];
  archives: string[];
  shadow?: string[];
}

export interface SpecialNote {
  title: string;
  content: string;
}

export interface FactCheckForeword {
  title: string;
  basis: string;
  documented: string[];
  unverified?: string[];
  notes?: string[];
  sources: string[];
  contentWarning?: boolean;
}

export interface FactCheckShadow {
  personal: string[];
  historical: string[];
  context?: string[];
}

// ─── Dialogue fact-check data (councils + prisms) — added 2026-04-23 ───
// Aggregated from council + prism Gate-4 fact-check runs. All fields optional
// so figures without aggregated data still validate.

export type FactCheckPatternKind =
  | 'composite-scene'
  | 'dramatized-quote'
  | 'compressed-timeline'
  | 'paraphrased-source'
  | 'invented-detail'
  | 'parable-attribution';

export interface FactCheckDialogueAppearance {
  id: string;       // "l1/the-letting-go" OR "beauvoir/seed-12"
  title: string;    // resolved, localized display title
  role: 'moderator' | 'participant' | 'host' | 'guest';
  turnOrder?: number;
}

export interface FactCheckDialoguePattern {
  pattern: string;               // listener-facing label
  kind: FactCheckPatternKind;
  basis: string;                 // what IS documented
  note?: string;                 // why acceptable (optional)
  appearances: FactCheckDialogueAppearance[];
}

export interface FactCheckDialogueSection {
  approach: string;              // 1-paragraph intro
  appearancesCount: number;
  patterns: FactCheckDialoguePattern[];
  documentedUsed?: string[];     // cap 5 items
}

export interface FactCheckDramaticLicenseSection {
  approach: string;
  patterns: FactCheckDialoguePattern[];  // cross-cutting synthesis
}

export interface FactCheck {
  figure: {
    id: string;
    name: string;
    dates: string;
    bio: string;
  };
  foreword?: FactCheckForeword;
  stories: FactCheckStory[];
  realPeople: RealPerson[];
  compositeCharacters: CompositeCharacter[];
  quotes: FactCheckQuotes;
  sources: FactCheckSources;
  specialNote?: SpecialNote;
  copyrightNote?: {
    riskLevel: string;
    approach: string;
  };
  commitment: string;
  shadow?: FactCheckShadow;
  // New dialogue-level fact-check sections (2026-04-23). All optional.
  dramaticLicense?: FactCheckDramaticLicenseSection;
  councils?: FactCheckDialogueSection;
  prisms?: FactCheckDialogueSection;
  acknowledgments?: string[];
}

interface UseFactCheckResult {
  factCheck: FactCheck | null;
  loading: boolean;
  error: Error | null;
  getStoryFactCheck: (storyNumber: number) => FactCheckStory | undefined;
  getCouncilFactCheck: (councilId: string) => FactCheckDialogueAppearance | undefined;
  getPrismFactCheck: (prismId: string) => FactCheckDialogueAppearance | undefined;
}

// Cache for loaded factcheck data
const factCheckCache: Record<string, FactCheck> = {};

/**
 * Hook to load and access factcheck data for a figure
 * @param figureId - The figure ID (e.g., 'einstein', 'plato')
 */
export function useFactCheck(figureId: string | undefined): UseFactCheckResult {
  const [factCheck, setFactCheck] = useState<FactCheck | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load factcheck data in the current language (EN or DE)
  const language = useDomainStore((state) => state.language.current);
  const dataLanguage = language === 'de' ? 'de' : 'en';

  useEffect(() => {
    if (!figureId) {
      setFactCheck(null);
      return;
    }

    const cacheKey = `${dataLanguage}-${figureId}`;

    // Check cache first
    if (factCheckCache[cacheKey]) {
      setFactCheck(factCheckCache[cacheKey]);
      return;
    }

    const loadFactCheck = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch from R2
        const mediaBase = import.meta.env.DEV ? '' : (import.meta.env.VITE_MEDIA_BASE_URL || 'https://media.agoracosmica.org');
        const response = await fetch(`${mediaBase}/factchecks/${dataLanguage}/${figureId}.json`);
        if (!response.ok) throw new Error(`Factcheck not found: ${figureId}`);
        const data = await response.json() as FactCheck;

        // Cache the result
        factCheckCache[cacheKey] = data;
        setFactCheck(data);
      } catch (err) {
        console.warn(`[useFactCheck] No factcheck data for ${figureId}:`, err);
        setError(err instanceof Error ? err : new Error('Failed to load factcheck data'));
        setFactCheck(null);
      } finally {
        setLoading(false);
      }
    };

    loadFactCheck();
  }, [figureId, dataLanguage]);

  // Helper to get factcheck for a specific story
  const getStoryFactCheck = (storyNumber: number): FactCheckStory | undefined => {
    return factCheck?.stories.find(s => s.number === storyNumber);
  };

  // Find the first council appearance matching the given id (e.g. "l1/the-letting-go")
  const getCouncilFactCheck = (councilId: string): FactCheckDialogueAppearance | undefined => {
    if (!factCheck?.councils?.patterns) return undefined;
    for (const pattern of factCheck.councils.patterns) {
      const match = pattern.appearances.find(a => a.id === councilId);
      if (match) return match;
    }
    return undefined;
  };

  // Find the first prism appearance matching the given id (e.g. "beauvoir/seed-12")
  const getPrismFactCheck = (prismId: string): FactCheckDialogueAppearance | undefined => {
    if (!factCheck?.prisms?.patterns) return undefined;
    for (const pattern of factCheck.prisms.patterns) {
      const match = pattern.appearances.find(a => a.id === prismId);
      if (match) return match;
    }
    return undefined;
  };

  return {
    factCheck,
    loading,
    error,
    getStoryFactCheck,
    getCouncilFactCheck,
    getPrismFactCheck
  };
}

export default useFactCheck;
