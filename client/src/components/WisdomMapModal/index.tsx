// WisdomMapModal/index.js - Main export for the WisdomMapModal component
import { FC, useState, useEffect, useMemo, useRef, CSSProperties } from 'react';
// Removed direct import from seedsdata.js (replaced with multilingual seed loading)
// Using direct seed loader to avoid merging issues
import { loadSeedsDirectly } from '../../services/directSeedLoader';
import seedStateManager from '../../services/SeedStateManager';
import { computeSeedSlices, computeSeedLevels } from '../../utils/seedLevelComputation';
import {
  computePendingBlooms,
  markBloomWitnessed,
  markFirstBloomShown,
  syncAllLastSeenLevels,
  shouldShowFigureCompletion,
  markFigureCompletionShown,
  hasAnyWitnessedMastery,
  PendingBloom,
} from '../../utils/pendingBlooms';
import BloomTransformationCard from './BloomTransformationCard';
import FigureCompletionOverlay from './FigureCompletionOverlay';
import uiSounds from '../../services/uiSounds';
import { ModalContainer, ModalHeader } from '../Modal';
import { CloseButton, RippleButton } from '../Button';
import SeedDetailView from '../SeedDetailView';
import { useDomainStore } from '../../stores/domainStore';
import useTranslation from '../../hooks/useTranslation';
import {
  getConstellationForFigure,
  calculateConstellationPositions,
  calculateConstellationPaths
} from '../ZodiacConstellation';
import { getConstellationTranslationKey } from '../../utils/constellationTranslationHelper';
import AtlasSkyLayer, { AtlasSkyLayerHandle } from './AtlasSkyLayer';
import AtlasPlate from './AtlasPlate';
import { pickAtlasTier } from '../../cosmos/tiers';
import type { SkyScene, SkyStar, SkySegment } from '../../cosmos/wisdom-sky/types';

// Import CSS
import './css/main.css';
import './css/Atlas.css';

// Import modular components
import ListButton from './ListButton';
import ResponsiveBackground from './ResponsiveBackground';
import ConstellationInfo from './ConstellationInfo';
import ConstellationMap from './ConstellationMap';
import SeedDetailsPanel from './SeedDetailsPanel';
import ProgressBar, { SeedSliceStatus } from './ProgressBar';
import CompletionCelebration from './CompletionCelebration';
import InitialPatternHelp from './InitialPatternHelp';
import { FactCheckModal } from '../FactCheck/FactCheckModal';
import CommunityGovernanceModal from '../CommunityGovernance/CommunityGovernanceModal';
import {
  computeVotingPower,
  computeTier,
  type CommunityTier,
} from '../CommunityGovernance/computeVotingPower';
import { isSelfHost } from '../../config/deployment';
import { useUIStore } from '../../stores/uiStore';
import { ListBullets, Info, SealCheck, Users } from '@phosphor-icons/react';
import type { Figure, Seed } from '../../types/global';

// We now use the modular CSS files in the css directory
// Removed problematic import: '../WisdomMapModal.css';

interface Constellation {
  name?: string;
  description?: string;
  pattern?: number[][];
  [key: string]: any;
}

interface ContainerDimensions {
  width: number;
  height: number;
}

interface SeedPosition {
  coordX?: number;
  coordY?: number;
  isMainStar?: boolean;
  constellationPoint?: any;
  pointIndex?: number;
}

interface BoundingBox {
  xMin: number;
  yMin: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Quarter-turn threshold: the turned fit has to buy this much more scale. */
const ROTATE_GAIN = 1.2;

interface WisdomMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFigure: Figure | null;
  defaultView?: 'map' | 'list';
  onSeedSelect?: (seed: Seed, mode?: string) => void;
  showSelectButton?: boolean;
  isForSeedConversation?: boolean;
}

const getFileName = (figureName: string, echoPrefix: string = 'Echo of'): string => {
  // Create a pattern to match both hardcoded prefixes and translated ones
  const prefixPattern = new RegExp(`^(Echo (of|von|de|del|di|des)|${echoPrefix})\\s+`, 'i');
  
  // Remove the prefix
  const n = figureName.replace(prefixPattern, '');
  
  // Special case mapping for non-standard filenames
  // These mappings should work regardless of language
  const specialCases: { [key: string]: string } = {
    // English names
    'Martin Luther King Jr.': 'king',
    'Meister Eckhart': 'eckhart',
    'Harriet Tubman': 'tubman',
    'Ada Lovelace': 'lovelace',
    'Arthur Schopenhauer': 'schopenhauer',
    'Leonardo da Vinci': 'vinci',
    'Dōgen Zenji': 'zenji',
    
    // German translations (only different ones)
    'Platon': 'plato', // German for Plato
    'Mark Aurel': 'aurelius' // German for Marcus Aurelius
  };
  
  // Check for special case match
  if (specialCases[n]) {
    return specialCases[n];
  }
  
  // If no special case, try extracting last name for ID
  const nameParts = n.split(' ');
  
  // For names with 'von', 'da', etc., we need special handling
  if (nameParts.length > 1) {
    const lastPart = nameParts[nameParts.length - 1].toLowerCase();
    const secondLastPart = nameParts.length > 2 ? nameParts[nameParts.length - 2].toLowerCase() : '';
    
    // Check for compounds like "da Vinci" or "von Goethe"
    if (secondLastPart === 'da') return 'vinci';
    if (secondLastPart === 'von' && lastPart === 'bingen') return 'bingen';
    if (secondLastPart === 'von' && lastPart === 'goethe') return 'goethe';
    
    // Otherwise, just use the last name
    return lastPart;
  }
  
  // Fallback to just the lowercase name
  return n.toLowerCase();
};

// Extract only the last name from a full figure name
const getLastNameForDisplay = (figureName: string, echoPrefix: string): string => {
  // Create a regex pattern that matches both hardcoded prefixes and the translated one
  const prefixPattern = new RegExp(`^(Echo (of|von|de|del|di|des)|${echoPrefix})\\s+`, 'i');
  
  // Remove the echo prefix
  const cleanName = figureName.replace(prefixPattern, '');
  
  // Special cases
  if (cleanName.includes('King Jr')) return 'King Jr.';
  if (cleanName.includes('Luther King')) return 'King';
  if (cleanName.includes('da Vinci')) return 'da Vinci';
  if (cleanName.includes('von Bingen')) return 'von Bingen';
  if (cleanName.includes('van Gogh')) return 'van Gogh';
  if (cleanName.includes('de Beauvoir')) return 'de Beauvoir';
  if (cleanName.toLowerCase().includes('zenji')) return 'Zenji';
  if (cleanName.includes('Lao')) return 'Laozi';
  if (cleanName.includes('Mark Aurel')) return 'Mark Aurel';

  // For regular names, return just the last part
  const parts = cleanName.split(' ');
  return parts[parts.length - 1];
};

const WisdomMapModal: FC<WisdomMapModalProps> = ({
  isOpen,
  onClose,
  selectedFigure,
  onSeedSelect,
  showSelectButton = false
}) => {
  // Access language and selected seed from Zustand store
  const language = useDomainStore((state) => state.language.current);
  const appSelectedSeedId = useDomainStore((state) => state.seeds.selectedId);
  const { t, tString, tNode } = useTranslation();

  // Help preferences from Zustand
  const shouldShowHelp = useUIStore((state) => state.shouldShowHelp);

  // Main state management (remains in the parent component)
  const [showDetailView, setShowDetailView] = useState<boolean>(false); // Full-screen detail overlay
  const [initialSeedNumber, setInitialSeedNumber] = useState<number>(1); // Which seed to scroll to in detail view
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [selectedSeed, setSelectedSeed] = useState<Seed | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showConstellationInfo, setShowConstellationInfo] = useState<boolean>(false);
  // Removed showPatternHint - now using automatic progressive revelation
  const [showCompletionCelebration, setShowCompletionCelebration] = useState<boolean>(false);

  // Prismatic Bloom state
  const [bloomQueue, setBloomQueue] = useState<PendingBloom[]>([]);
  const [bloomIndex, setBloomIndex] = useState(0);
  const [showBloomCard, setShowBloomCard] = useState(false);
  const [showFigureCompletion, setShowFigureCompletion] = useState(false);
  const bloomsDetectedRef = useRef(false);
  const [showInitialPatternHelp, setShowInitialPatternHelp] = useState<boolean>(
    shouldShowHelp('hideWisdomMapHelp')
  );
  
  // Seeds Explorer helper state
  // showSeedsHelp removed — list view is self-explanatory

  // Responsive state for hub layout
  const [windowWidth, setWindowWidth] = useState<number>(window.innerWidth);
  const isMobileHub = windowWidth < 768;

  // FactCheck modal state
  const [showFactCheck, setShowFactCheck] = useState<boolean>(false);

  // Community governance modal state
  const [showCommunity, setShowCommunity] = useState<boolean>(false);

  // Tier transition data computed at celebration moment.
  // Refreshed on every figure completion fire (legacy or via bloom queue).
  const [completionTierData, setCompletionTierData] = useState<{
    total: number;
    newlyUnlockedTier?: Exclude<CommunityTier, 'listener'>;
  } | null>(null);
  
  // Container ref for measuring dimensions
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState<ContainerDimensions | null>(null);

  // The Celestial Atlas ("your sky") — presentational layer only.
  // 'still' and 'mobile-low' tiers keep the flat map (photo background)
  // exactly as before; any engine failure also drops back to it.
  const skyRef = useRef<AtlasSkyLayerHandle | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const [skyFailed, setSkyFailed] = useState<boolean>(false);
  const [skyReady, setSkyReady] = useState<boolean>(false);
  const skyTier = useMemo(() => (isOpen ? pickAtlasTier() : 'still'), [isOpen]);
  /* The atlas is Canvas 2D at a ~30fps idle cadence, cheap enough for every
     tier. iOS Safari caps hardwareConcurrency at 4 and hides deviceMemory,
     so 'mobile-low' includes all iPhones; it rides the leaner budget instead
     of falling back. Only reduced motion and runtime failure stay flat. */
  const skyEnabled = !skyFailed && skyTier !== 'still';

  // Bloom staging: stars keep their pre-bloom engraving until the bloom note
  // is witnessed, then gild on the plate (flourish + rays + gathered dust).
  const [pendingLevelOverrides, setPendingLevelOverrides] = useState<Record<string, number>>({});
  const [novaSeedId, setNovaSeedId] = useState<string | null>(null);
  const novaTimerRef = useRef<number | null>(null);

  // Reset the crossfade state for the next open (the layer itself unmounts
  // and disposes its renderer when the modal closes)
  useEffect(() => {
    if (!isOpen) setSkyReady(false);
  }, [isOpen]);

  // Crossfade: when the sky's first frame lands, the photo fades out under
  // the fading-in canvas (CSS), then unmounts once the transition settles
  const [skySettled, setSkySettled] = useState<boolean>(false);
  useEffect(() => {
    if (!skyReady) {
      setSkySettled(false);
      return;
    }
    const id = window.setTimeout(() => setSkySettled(true), 900);
    return () => window.clearTimeout(id);
  }, [skyReady]);

  // Reference to track previous gathered count for completion celebration
  const prevMasteredCountRef = useRef<number>(0);

  // Track window width for responsive hub layout
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Pause every map animation when the tab is backgrounded, same
  // data-visibility pattern as Sidebar and WisdomGalleryModal. The
  // gathered-star and bloom glows animate filter/box-shadow and would
  // otherwise keep burning frames in a hidden tab.
  useEffect(() => {
    const applyVisibility = () => {
      mapContainerRef.current?.setAttribute(
        'data-visibility',
        document.hidden ? 'hidden' : 'visible'
      );
    };
    applyVisibility();
    document.addEventListener('visibilitychange', applyVisibility);
    return () => document.removeEventListener('visibilitychange', applyVisibility);
  }, []);

  // Measure container dimensions when modal opens
  useEffect(() => {
    if (isOpen) {
      let mounted = true;
      let retryCount = 0;
      const maxRetries = 10;
      
      const updateDimensions = (): void => {
        if (!mounted) return;
        
        const container = mapContainerRef.current;
        if (!container) {
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(updateDimensions, 50);
          }
          return;
        }
        
        // Use multiple methods to get dimensions
        const rect = container.getBoundingClientRect();
        const { offsetWidth, offsetHeight, clientWidth, clientHeight } = container;
        
        // Use the most reliable dimensions
        const width = offsetWidth || rect.width || clientWidth;
        const height = offsetHeight || rect.height || clientHeight;
        
        if (width > 0 && height > 0) {
          setContainerDimensions({ width, height });
          retryCount = 0; // Reset for future measurements
        } else if (retryCount < maxRetries) {
          retryCount++;
          console.warn(`[WisdomMapModal] Container has zero dimensions, retry ${retryCount}/${maxRetries}...`);
          // Exponential backoff with max delay of 500ms
          const delay = Math.min(50 * Math.pow(1.5, retryCount), 500);
          setTimeout(updateDimensions, delay);
        } else {
          // Fallback: use window dimensions minus estimated chrome
          console.error('[WisdomMapModal] Failed to measure container, using fallback dimensions');
          setContainerDimensions({ 
            width: window.innerWidth * 0.9,
            height: window.innerHeight * 0.7
          });
        }
      };
      
      // Ensure DOM is ready before measuring
      if (document.readyState === 'complete') {
        // DOM is fully loaded, but still wait for next frame
        requestAnimationFrame(() => {
          updateDimensions();
        });
      } else {
        // Wait for DOM to be ready
        window.addEventListener('load', () => {
          requestAnimationFrame(() => {
            updateDimensions();
          });
        });
      }
      
      // Multiple measurement attempts to handle various rendering scenarios
      const measurementSchedule = [0, 100, 250, 500];
      measurementSchedule.forEach(delay => {
        setTimeout(() => {
          if (mounted) updateDimensions();
        }, delay);
      });
      
      // Add resize listener for responsive updates
      const handleResize = (): void => {
        if (mounted) {
          retryCount = 0;
          updateDimensions();
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      return () => {
        mounted = false;
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen]);
  
  // Force re-measurement when ref becomes available
  useEffect(() => {
    if (mapContainerRef.current && isOpen && !containerDimensions) {
      const container = mapContainerRef.current;
      const rect = container.getBoundingClientRect();
      
      if (rect.width > 0 && rect.height > 0) {
        setContainerDimensions({ width: rect.width, height: rect.height });
      }
    }
  }, [mapContainerRef.current, isOpen, containerDimensions]);

  // Load seeds when the modal opens
  useEffect(() => {
    
    if (!selectedFigure || !isOpen) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);
        
        const fn = selectedFigure.name;
        // Use figure.id if available, otherwise extract from name
        let figureId = selectedFigure.id;

        if (!figureId) {
          // Fallback: extract figure ID from name
          const echoPrefix = tString('figures.echoOf', 'Echo of');
          const prefixPattern = new RegExp(`^(Echo (of|von|de|del|di|des)|${echoPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s+`, 'i');
          figureId = fn.replace(prefixPattern, '').toLowerCase();
        }
        
        
        // Load seeds directly without merging
        const result = await loadSeedsDirectly(figureId, language);
        
        if (result && result.seeds && result.seeds.length > 0) {
          
          // Process the seeds to include gathered state
          const processedSeeds = result.seeds.map((seed: any) => {
            const seedId = seed.id;
            const file = getFileName(fn, tString('figures.echoOf', 'Echo of'));

            // Different ID formats to check
            const numericId = String(seedId);
            const prefixedId = `${file}-${numericId}`;
            
            // Check if seed is gathered
            const isGathered = 
              seedStateManager.isSeedGathered(figureId, prefixedId) || 
              seedStateManager.isSeedGathered(figureId, numericId) ||
              seedStateManager.isSeedGathered(figureId, seed.id);
            
            return {
              ...seed,
              gathered: isGathered,
              title: seed.title || seed.name
            };
          });
          
          setSeeds(processedSeeds);
          setLoading(false);
          return;
        } else {
          throw new Error(`No seeds found for ${figureId}`);
        }
      } catch (e) {
        setError(tString('seeds.loadError', 'Failed to load wisdom seeds.'));
      } finally {
        setLoading(false);
      }
    })();
    
    return () => {
      setSelectedSeed(null);
    };
  }, [selectedFigure, isOpen, language]); // Removed 't' from dependencies as it causes double loading
  
  // Subscribe to SeedStateManager for real-time updates
  useEffect(() => {
    // Function to handle seed acquisition events
    const handleSeedStateChange = (data: any): void => {
      const { figureId, seedId, action } = data;

      // Only update if it's for the currently displayed figure and it's a 'gathered' action
      if (figureId === selectedFigure?.id && action === 'gathered') {
        setSeeds(prevSeeds => {
          return prevSeeds.map(seed => {
            // Handle different id formats (with or without figure prefix)
            const seedMatches =
              seed.id === seedId ||
              `${getFileName(figureId, tString('figures.echoOf', 'Echo of'))}-${seed.id}` === seedId;

            if (seedMatches) {
              return { ...seed, gathered: true };
            }
            return seed;
          });
        });
      }
    };
    
    // Subscribe to the SeedStateManager
    const unsubscribe = seedStateManager.subscribe(handleSeedStateChange);
    
    // Also keep the legacy event listener for backward compatibility
    const handleLegacyEvent = (event: CustomEvent): void => {
      const { figureId, seedId } = event.detail;

      // Only update if it's for the currently displayed figure
      if (figureId === selectedFigure?.id) {
        setSeeds(prevSeeds => {
          return prevSeeds.map(seed => {
            if (seed.id === seedId) {
              return { ...seed, gathered: true };
            }
            return seed;
          });
        });
      }
    };
    
    // Add legacy event listener
    window.addEventListener('seedAcquired', handleLegacyEvent as EventListener);
    
    // Clean up
    return () => {
      unsubscribe(); // Unsubscribe from SeedStateManager
      window.removeEventListener('seedAcquired', handleLegacyEvent as EventListener);
    };
  }, [selectedFigure]);

  // The seed the app already had selected when the map opened. On phones the
  // note is a bottom sheet, so opening it unasked would bury the whole field:
  // that one selection only lights its star's ring, and a tap opens the note.
  const openingSeedIdRef = useRef<string | null>(null);
  useEffect(() => {
    // isOpen only: the id is captured at the open transition, not tracked
    openingSeedIdRef.current = isOpen && appSelectedSeedId ? String(appSelectedSeedId) : null;
  }, [isOpen]);

  // Sync local selectedSeed with the app's actual selected seed from Zustand
  useEffect(() => {
    if (!seeds.length || !appSelectedSeedId) return;
    if (isMobileHub && String(appSelectedSeedId) === openingSeedIdRef.current) return;
    const match = seeds.find(s => String(s.id) === String(appSelectedSeedId));
    if (match && match.id !== selectedSeed?.id) {
      setSelectedSeed(match);
    }
  }, [seeds, appSelectedSeedId, isMobileHub]);

  // Create zodiac constellation layout
  const constellation = useMemo<Constellation | null>(() => {
    if (!selectedFigure) {
      return null;
    }
    return getConstellationForFigure(selectedFigure.name);
  }, [selectedFigure]);
  
  // Display-space constellation. A phone held upright crushes a wide figure
  // into a thin band and leaves the height empty, so below the tablet
  // breakpoint (where the plate annotations are gone) the pattern takes a
  // quarter turn and flows down the long axis instead, first point at the
  // top. Rotation is display only: the authored patterns never change.
  const displayConstellation = useMemo<Constellation | null>(() => {
    const pattern = constellation?.pattern;
    if (!constellation || !pattern?.length || !containerDimensions) return constellation;

    const xs = pattern.map(([x]) => x);
    const ys = pattern.map(([, y]) => y);
    const patternW = Math.max(...xs) - Math.min(...xs);
    const patternH = Math.max(...ys) - Math.min(...ys);
    if (patternW <= 0 || patternH <= 0) return constellation;

    const { width, height } = containerDimensions;
    if (!isMobileHub || width >= height) return constellation;

    const fit = (w: number, h: number) => Math.min(width / w, height / h);
    if (fit(patternH, patternW) < fit(patternW, patternH) * ROTATE_GAIN) return constellation;

    return {
      ...constellation,
      pattern: pattern.map(([x, y]) => [100 - y, x]),
    };
  }, [constellation, containerDimensions, isMobileHub]);

  // Calculate star positions and boundingBox
  const { seedPositions, boundingBox } = useMemo<{ seedPositions: SeedPosition[]; boundingBox: BoundingBox | null }>(() => {
    if (!seeds.length || !displayConstellation || !containerDimensions) {
      return { seedPositions: [], boundingBox: null };
    }

    const result = calculateConstellationPositions(
      seeds as any,
      displayConstellation as any,
      containerDimensions,
      // The cartouche no longer owns the lower band on phones, so the
      // figure can breathe into it.
      isMobileHub ? { marginFactor: 0.86 } : undefined
    );
    return result as { seedPositions: SeedPosition[]; boundingBox: BoundingBox | null };
  }, [seeds, displayConstellation, containerDimensions, isMobileHub]);

  // Calculate progressive revelation stage based on gathered seeds
  const revelationStage = useMemo(() => {
    const gatheredCount = seeds.filter(seed => seed.gathered).length;
    const totalSeeds = seeds.length;
    const progressPercent = totalSeeds > 0 ? (gatheredCount / totalSeeds) * 100 : 0;
    
    if (progressPercent === 0) return 'void';           // 0% - Pure cosmic void
    if (progressPercent <= 25) return 'awakening';      // 1-25% - First cosmic awakening
    if (progressPercent <= 50) return 'emergence';      // 26-50% - Pattern emergence
    if (progressPercent <= 75) return 'forming';        // 51-75% - Constellation forming
    return 'complete';                                   // 76-100% - Wisdom complete
  }, [seeds]);

  // Calculate line segments for drawing with progressive revelation
  const lineSegments = useMemo(() => {
    if (!boundingBox || !containerDimensions || !displayConstellation) return [];

    const baseSegments = calculateConstellationPaths(
      seedPositions as any,
      boundingBox as any,
      displayConstellation.pattern || [],
      containerDimensions,
      displayConstellation as any // Pass the full constellation object
    );

    // Add revelation stage information to each segment
    return baseSegments.map(segment => ({
      ...segment,
      revelationStage,
      shouldShow: revelationStage !== 'void' // Show lines for all stages except void
    }));
  }, [boundingBox, containerDimensions, displayConstellation, seedPositions, revelationStage]);

  // Compute per-seed slice status for segmented progress bar
  // Logic extracted to seedLevelComputation.ts for reuse by pendingBlooms
  const seedSlices = useMemo<SeedSliceStatus[]>(() => {
    if (!seeds.length || !selectedFigure?.id) return [];
    return computeSeedSlices(selectedFigure.id, seeds);
  }, [seeds, selectedFigure?.id]);

  // Compute per-seed gamification level (0-4) from slice status
  const seedLevels = useMemo<Record<string, number>>(() => {
    return computeSeedLevels(seedSlices);
  }, [seedSlices]);

  // Displayed levels: unwitnessed blooms hold their star at the pre-bloom
  // engraving so the gilding happens ON the plate when the note is dismissed.
  const displaySeedLevels = useMemo<Record<string, number>>(() => {
    if (!skyEnabled || !Object.keys(pendingLevelOverrides).length) return seedLevels;
    return { ...seedLevels, ...pendingLevelOverrides };
  }, [seedLevels, pendingLevelOverrides, skyEnabled]);

  // Lit segments connect consecutive gathered pattern stars: gathered seeds
  // occupy pattern points 0..mainStarCount-1, so the first mainStarCount-1
  // segments run between gathered stars. Shared by the atlas plate and the
  // sky engine so ink and light always agree.
  const litCount = useMemo<number>(() => {
    const mainStarCount = seedPositions.filter((p) => p.isMainStar).length;
    return Math.max(0, mainStarCount - 1);
  }, [seedPositions]);

  // Declarative snapshot for the atlas sky engine: star states, line segments
  // and their lit status, all derived from the same data that drives the DOM
  // layer, so the two always agree.
  const skyScene = useMemo<SkyScene | null>(() => {
    if (!skyEnabled || !containerDimensions || !seeds.length || !seedPositions.length) {
      return null;
    }

    // Suggested "start here" seed — mirrors ConstellationMap.findNextSeed
    let nextSeedId: string | null = null;
    const noProgressSeeds = seeds.filter(
      (seed) => (seedLevels[String(seed.id)] ?? 0) === 0
    );
    if (noProgressSeeds.length > 0) {
      const lowest = noProgressSeeds.reduce((low, cur) => {
        const lowId = parseInt(String(low.id).split('-').pop() || '') || Number(low.id);
        const curId = parseInt(String(cur.id).split('-').pop() || '') || Number(cur.id);
        return curId < lowId ? cur : low;
      });
      nextSeedId = String(lowest.id);
    }

    // Same Blake center-point skip as the DOM layer in ConstellationMap
    const isBlakeConstellation =
      constellation?.name === 'The Divine Vision' ||
      getConstellationTranslationKey(constellation?.name ?? '') ===
        'constellations.names.theDivineVision';

    const stars: SkyStar[] = [];
    seeds.forEach((seed, i) => {
      const pos = seedPositions[i];
      if (!pos || pos.coordX === undefined || pos.coordY === undefined) return;
      if (
        isBlakeConstellation &&
        pos.coordX >= 49 && pos.coordX <= 51 &&
        pos.coordY >= 49 && pos.coordY <= 51
      ) {
        return;
      }
      stars.push({
        id: String(seed.id),
        xPct: pos.coordX,
        yPct: pos.coordY,
        gathered: !!seed.gathered,
        level: displaySeedLevels[String(seed.id)] ?? 0,
        isNext: String(seed.id) === nextSeedId,
      });
    });

    const segments: SkySegment[] = lineSegments.map((seg, i) => ({
      x1: seg.x1,
      y1: seg.y1,
      x2: seg.x2,
      y2: seg.y2,
      lit: i < litCount,
    }));

    return {
      figureKey: String(selectedFigure?.id ?? selectedFigure?.name ?? 'figure'),
      width: containerDimensions.width,
      height: containerDimensions.height,
      stars,
      segments,
      stage: revelationStage,
    };
  }, [
    skyEnabled,
    containerDimensions,
    seeds,
    seedPositions,
    seedLevels,
    displaySeedLevels,
    litCount,
    lineSegments,
    constellation,
    revelationStage,
    selectedFigure?.id,
    selectedFigure?.name,
  ]);

  // Sync ref on open — needs seedSlices because they load async after modal opens.
  // Use a flag to sync only ONCE per open cycle (otherwise celebration never fires).
  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      hasSyncedRef.current = false; // Reset for next open
      return;
    }
    if (hasSyncedRef.current || !seedSlices.length) return;
    hasSyncedRef.current = true;
    const current = seedSlices.reduce((sum, s) =>
      sum + (s.storyDone ? 1 : 0) + (s.wisdomDone ? 1 : 0) + (s.prismDone ? 1 : 0) + (s.questDone ? 1 : 0), 0);
    prevMasteredCountRef.current = current;
  }, [isOpen, seedSlices]);

  // Check for constellation mastery — all seeds must have all 4 modes complete (48/48)
  useEffect(() => {
    if (!seedSlices.length) return;

    const totalModes = seedSlices.length * 4; // 12 seeds × 4 modes = 48
    const completedModes = seedSlices.reduce((sum, s) =>
      sum + (s.storyDone ? 1 : 0) + (s.wisdomDone ? 1 : 0) + (s.prismDone ? 1 : 0) + (s.questDone ? 1 : 0), 0);

    // Trigger celebration only when ALL modes are complete and it's a new mastery
    if (completedModes === totalModes && completedModes > prevMasteredCountRef.current) {
      // Compute tier transition for this figure completion. Listener→Voice
      // happens at first seed mastery (handled elsewhere); the figure-
      // completion celebration only ever fires Voice→Council, when the user
      // crosses to 3 fully-completed figures.
      const power = computeVotingPower();
      const completedNow = power.completedFigureIds.length;
      const tierBefore = computeTier(
        Math.max(0, completedNow - 1),
        power.hasFirstMastery
      );
      const tierAfter = power.tier;
      const transitioned =
        tierBefore !== tierAfter && tierAfter !== 'listener'
          ? (tierAfter as Exclude<CommunityTier, 'listener'>)
          : undefined;
      setCompletionTierData({ total: power.total, newlyUnlockedTier: transitioned });
      setShowCompletionCelebration(true);
      // The whole constellation ignites brightest-first in the sky,
      // synchronized with the DOM celebration
      skyRef.current?.ignite();
    }

    prevMasteredCountRef.current = completedModes;
  }, [seedSlices]);

  // Bloom detection: compute pending blooms once per modal open cycle
  useEffect(() => {
    if (!isOpen) {
      bloomsDetectedRef.current = false;
      setPendingLevelOverrides({});
      setNovaSeedId(null);
      if (novaTimerRef.current) {
        window.clearTimeout(novaTimerRef.current);
        novaTimerRef.current = null;
      }
      return;
    }
    if (bloomsDetectedRef.current || !seedSlices.length || !selectedFigure?.id) return;
    bloomsDetectedRef.current = true;

    const figureId = selectedFigure.id;
    const currentLevels = computeSeedLevels(seedSlices);
    const figureName = selectedFigure.name || '';

    const blooms = computePendingBlooms(figureId, currentLevels, seeds, figureName);

    if (blooms.length > 0) {
      // Atlas: hold each blooming star at its pre-bloom engraving until its
      // note is witnessed, so the gilding is seen happening on the plate.
      const overrides: Record<string, number> = {};
      for (const b of blooms) overrides[String(b.seedId)] = b.fromLevel;
      setPendingLevelOverrides(overrides);
      setBloomQueue(blooms);
      setBloomIndex(0);
      setShowBloomCard(true);
    } else {
      // No blooms to show, sync levels so we don't re-check
      syncAllLastSeenLevels(figureId, currentLevels);
    }
  }, [isOpen, seedSlices, selectedFigure?.id, selectedFigure?.name, seeds]);

  // Handle bloom card dismiss: advance queue, then check figure completion
  // Guard against rapid double-dismiss (user tapping fast during transition)
  const bloomDismissingRef = useRef(false);
  const handleBloomDismiss = (): void => {
    if (bloomDismissingRef.current) return;
    bloomDismissingRef.current = true;

    const bloom = bloomQueue[bloomIndex];
    if (bloom) {
      markBloomWitnessed(bloom.figureId, bloom.seedId, bloom.toLevel);
      if (bloom.tier === 1) markFirstBloomShown(bloom.figureId, bloom.seedId);
      // The plate gilds the star as the note closes: the engraved star steps
      // up a level (rays draw themselves) while the sky inks the surveyor's
      // flourish and gathers gold dust inward, under a brief hush.
      const seedKey = String(bloom.seedId);
      skyRef.current?.nova(seedKey);
      setPendingLevelOverrides(prev => {
        if (!(seedKey in prev)) return prev;
        const next = { ...prev };
        delete next[seedKey];
        return next;
      });
      setNovaSeedId(seedKey);
      if (novaTimerRef.current) window.clearTimeout(novaTimerRef.current);
      novaTimerRef.current = window.setTimeout(() => setNovaSeedId(null), 2600);
    }

    const nextIndex = bloomIndex + 1;
    if (nextIndex < bloomQueue.length) {
      setShowBloomCard(false);
      setTimeout(() => {
        setBloomIndex(nextIndex);
        setShowBloomCard(true);
        bloomDismissingRef.current = false;
      }, 400);
    } else {
      setShowBloomCard(false);
      bloomDismissingRef.current = false;

      // After all blooms played, sync remaining levels and check figure completion
      if (selectedFigure?.id) {
        const currentLevels = computeSeedLevels(seedSlices);
        syncAllLastSeenLevels(selectedFigure.id, currentLevels);

        if (shouldShowFigureCompletion(selectedFigure.id, currentLevels, seeds.length)) {
          markFigureCompletionShown(selectedFigure.id);
          // Compute tier transition for the celebration card. Same logic as
          // the legacy path — fully canonical via computeVotingPower.
          const power = computeVotingPower();
          const completedNow = power.completedFigureIds.length;
          const tierBefore = computeTier(
            Math.max(0, completedNow - 1),
            power.hasFirstMastery
          );
          const tierAfter = power.tier;
          const transitioned =
            tierBefore !== tierAfter && tierAfter !== 'listener'
              ? (tierAfter as Exclude<CommunityTier, 'listener'>)
              : undefined;
          setCompletionTierData({ total: power.total, newlyUnlockedTier: transitioned });
          setShowFigureCompletion(true);
        }
      }
    }
  };

  const handleSeedSelect = (s: Seed, mode?: string): void => {
    onSeedSelect && onSeedSelect(s, mode);
    onClose();
  };
  
  const handleMapSeedClick = (seed: Seed): void => {
    setSelectedSeed(seed);
  };
  
  const handleViewDetails = (): void => {
    // Calculate which seed number to scroll to (1-based index)
    const seedNumber = selectedSeed ? seeds.findIndex(s => s.id === selectedSeed.id) + 1 : 1;
    setInitialSeedNumber(seedNumber);
    setShowDetailView(true);
    setSelectedSeed(null); // Close preview panel
  };

  // Handle opening list view (SeedDetailView)
  const handleOpenListView = (): void => {
    // Open detail view at seed #1
    setInitialSeedNumber(1);
    setShowDetailView(true);
    setSelectedSeed(null); // Close any open seed panel
  };

  // seedsExplorerHelp handler removed — list view is self-explanatory

  // Atlas celebrations: when a figure completes, the engraver finishes the
  // plate first (links re-ink gold, one gilding light pass), then the
  // informational card fades in. Flat tiers keep today's immediate overlay.
  const [completionCardReady, setCompletionCardReady] = useState<boolean>(false);
  useEffect(() => {
    const pending = showFigureCompletion || showCompletionCelebration;
    if (!pending) {
      setCompletionCardReady(false);
      return;
    }
    if (!skyEnabled) {
      setCompletionCardReady(true);
      return;
    }
    const id = window.setTimeout(() => setCompletionCardReady(true), 3400);
    return () => window.clearTimeout(id);
  }, [showFigureCompletion, showCompletionCelebration, skyEnabled]);

  // Add/remove body class to prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('wisdom-map-open');
    } else {
      document.body.classList.remove('wisdom-map-open');
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('wisdom-map-open');
    };
  }, [isOpen]);

  // Atlas chrome scope: portal surfaces (help overlay) restyle through this
  // body class while the atlas is the active presentation.
  useEffect(() => {
    if (isOpen && skyEnabled) {
      document.body.classList.add('wisdom-atlas-open');
    } else {
      document.body.classList.remove('wisdom-atlas-open');
    }
    return () => {
      document.body.classList.remove('wisdom-atlas-open');
    };
  }, [isOpen, skyEnabled]);

  // Add/remove body class to prevent scrolling when detail view is open
  useEffect(() => {
    if (showDetailView) {
      document.body.classList.add('detail-view-open');
    } else {
      document.body.classList.remove('detail-view-open');
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('detail-view-open');
    };
  }, [showDetailView]);
  
  // Seeds explorer helper removed — list view is self-explanatory
  
  // Don't render anything if not open
  if (!isOpen) return null;

  // Calculate gathered count for progress
  const gatheredCount = seeds.filter(s => s.gathered).length;
  const totalSeeds = seeds.length;
  const progressPercentage = totalSeeds > 0 ? Math.round((gatheredCount/totalSeeds)*100) : 0;
  const isCompleted = gatheredCount === totalSeeds && totalSeeds > 0;

  // While the engraver is finishing the plate (ignite choreography, before
  // the informational card), hold the plate's completed styling back so the
  // sequential gold re-inking is seen happening rather than pre-painted.
  const completionPending =
    skyEnabled && (showFigureCompletion || showCompletionCelebration) && !completionCardReady;

  // Atlas plate data: figure name without the Echo prefix (for the cartouche
  // epithet) and the translated constellation name (for the seed note kicker).
  const echoPrefixForClean = tString('figures.echoOf', 'Echo of');
  const cleanFigureName = selectedFigure
    ? selectedFigure.name.replace(
        new RegExp(
          `^(Echo (of|von|de|del|di|des)|${echoPrefixForClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s+`,
          'i'
        ),
        ''
      )
    : '';
  const constellationNameKey = constellation?.name
    ? getConstellationTranslationKey(constellation.name)
    : null;
  const translatedConstellationName = constellationNameKey
    ? tString(constellationNameKey, constellation?.name || '')
    : constellation?.name || '';

  // Seed note docking: the annotation prefers the plate margin OPPOSITE the
  // star, near its height (proto B). A wide figure fills both margins, so
  // the dock walks a small candidate grid (side x anchor height) and takes
  // the first rect that buries no star, then none of the plate annotations.
  // Lower bound 26: the note is translated -40% of its own height, so a
  // higher anchor would push its kicker out of the plate.
  const selectedSeedPos = selectedSeed
    ? seedPositions[seeds.findIndex((s) => s.id === selectedSeed.id)] ?? null
    : null;
  const dockChoice = (() => {
    const starX = selectedSeedPos?.coordX ?? 50;
    const starY = selectedSeedPos?.coordY ?? 50;
    const preferred: 'left' | 'right' = starX >= 50 ? 'left' : 'right';
    const fallback = {
      side: preferred,
      top: Math.min(64, Math.max(26, starY)),
      compact: false,
    };
    if (!selectedSeedPos || !containerDimensions) return fallback;
    const { width: W, height: H } = containerDimensions;
    // Phones show the note as a bottom sheet, the dock props are unused.
    if (W < 768) return fallback;

    const noteW = Math.min(330, W - 56);
    const pad = 6;
    const starR = 22;
    const starYPx = (starY / 100) * H;

    const starsPx = seedPositions
      .filter((p) => p.coordX !== undefined && p.coordY !== undefined)
      .map((p) => ({
        x: ((p.coordX as number) / 100) * W,
        y: ((p.coordY as number) / 100) * H,
      }));

    // Cartouche and marginalia footprints (bottom corners), padded instead
    // of modelling the cartouche tilt.
    const cartW = Math.min(272, 0.34 * W);
    const annotations = [
      { x1: W * 0.975 - cartW - 10, y1: H * 0.93 - 165, x2: W * 0.975 + 10, y2: H * 0.93 + 10 },
      { x1: W * 0.025 - 10, y1: H * 0.93 - 150, x2: W * 0.025 + Math.min(250, 0.26 * W) + 10, y2: H * 0.93 + 10 },
    ];

    const other: 'left' | 'right' = preferred === 'left' ? 'right' : 'left';
    const evaluate = (noteH: number) => {
      // The star-height anchor comes first: with free margins it wins on
      // distance and the note sits exactly where it always has.
      const anchorY1 = Math.min(H - noteH - 12, Math.max(12, starYPx - 0.4 * noteH));
      const y1s = [anchorY1, 12, H * 0.13, H * 0.26, H * 0.39, H * 0.52, H - noteH - 12];
      let best: { side: 'left' | 'right'; y1: number; buried: number; score: number } | null = null;
      for (const side of [preferred, other]) {
        for (const y1 of y1s) {
          if (y1 < 12 || y1 + noteH > H - 12) continue;
          const x1 = side === 'left' ? 24 : W - 24 - noteW;
          const x2 = x1 + noteW;
          const y2 = y1 + noteH;
          const buried = starsPx.filter(
            (s) =>
              s.x + starR > x1 - pad &&
              s.x - starR < x2 + pad &&
              s.y + starR > y1 - pad &&
              s.y - starR < y2 + pad
          ).length;
          const onAnnotation = annotations.some(
            (a) => a.x1 < x2 && a.x2 > x1 && a.y1 < y2 && a.y2 > y1
          ) ? 1 : 0;
          const score =
            buried * 1000 +
            onAnnotation * 100 +
            (side === preferred ? 0 : 10) +
            Math.abs(y1 + noteH / 2 - starYPx) / H;
          if (!best || score < best.score) best = { side, y1, buried, score };
        }
      }
      return best;
    };

    // The CSS anchors the note at top: X% then lifts it 40% of its own
    // height, so the found slot converts back to that anchor scale.
    const toChoice = (slot: { side: 'left' | 'right'; y1: number }, noteH: number, compact: boolean) => ({
      side: slot.side,
      top: ((slot.y1 + 0.4 * noteH) / H) * 100,
      compact,
    });

    // Natural size first; if every slot buries a star, a capped note with
    // internal scroll may still find a clear one (wide figures fill both
    // margins at mid height). If even that fails, least burial wins.
    const naturalH = Math.min(420, H * 0.62);
    const compactH = Math.min(340, H * 0.5);
    const natural = evaluate(naturalH);
    if (natural && natural.buried === 0) return toChoice(natural, naturalH, false);
    const compact = evaluate(compactH);
    if (compact && compact.buried === 0) return toChoice(compact, compactH, true);
    return natural ? toChoice(natural, naturalH, false) : fallback;
  })();
  const atlasDockSide = dockChoice.side;
  const atlasDockTopPct = dockChoice.top;
  const atlasDockCompact = dockChoice.compact;

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      contentClassName={`wisdom-map-content${skyEnabled ? ' atlas-mode' : ''}`}
      animationType="fade-scale"
      overlayClassName="wisdom-map-overlay"
      alignTop={false}
      backgroundVariant="fullscreen"
    >
      {/* Hub header — responsive layout */}
      {(() => {
        const lastName = selectedFigure ? getLastNameForDisplay(selectedFigure.name, tString('figures.echoOf', 'Echo of')) : '';
        const titleContent = (
          <span className="wisdom-modal-title">{String(t('seeds.titleWithFigure', { figure: lastName }))}</span>
        );

        if (isMobileHub) {
          return (
            <ModalHeader
              layout="three-column"
              title={titleContent}
              leftContent={null}
              onClose={onClose}
              closeAriaLabel={tString('common.close', 'Close wisdom map')}
              cosmicStars={false}
            />
          );
        }

        return (
          <ModalHeader
            layout="three-column"
            title={titleContent}
            leftContent={
              <div className="header-button-group">
                <ListButton
                  onClick={handleOpenListView}
                  isActive={showDetailView}
                  className="desktop-controls"
                />
                <button
                  className="header-action-btn"
                  onClick={() => setShowFactCheck(true)}
                  aria-label={tString('factCheck.facts', 'Facts')}
                >
                  <SealCheck size={22} />
                  <span>{tString('factCheck.facts', 'Facts')}</span>
                </button>
                {!isSelfHost && (
                  <button
                    className="header-action-btn community-btn"
                    onClick={() => setShowCommunity(true)}
                    aria-label={tString('community.modalTitle', 'Community')}
                  >
                    <Users size={22} />
                    <span>{tString('community.modalTitle', 'Community')}</span>
                  </button>
                )}
              </div>
            }
            rightContent={
              <div className="header-button-group">
                {/* Atlas plates explain themselves (marginalia carries the
                    sign lore), so the desktop info toggle retires there. */}
                {!skyEnabled && (
                  <button
                    className={`header-action-btn info-btn ${showConstellationInfo ? 'active' : ''}`}
                    onClick={() => setShowConstellationInfo(!showConstellationInfo)}
                    aria-label={showConstellationInfo ? 'Hide constellation info' : 'Show constellation info'}
                  >
                    <Info size={22} />
                  </button>
                )}
                <CloseButton
                  onClick={onClose}
                  ariaLabel={tString('common.close', 'Close wisdom map')}
                />
              </div>
            }
            onClose={null}
            cosmicStars={true}
            closeAriaLabel={tString('common.close', 'Close wisdom map')}
            ariaLabel="Wisdom hub header"
          />
        );
      })()}

      {loading && !skyEnabled ? (
        /* Flat tiers keep the plain loading state exactly as before. In atlas
           mode the map container stays mounted through figure switches so the
           sky can glide instead of tearing down. */
        <div className="loading-state">{tNode('common.loading')}</div>
      ) : error ? (
        <div className="error-state">
          <p>{error}</p>
          <RippleButton variant="coral" onClick={() => window.location.reload()} elevated>
            {tNode('common.retry')}
          </RippleButton>
        </div>
      ) : (
        <>
          {/* Always show map view - no more toggle */}
          <div
            className={`map-container visible${skyEnabled && skyReady ? ' sky-atlas' : ''}`}
            ref={mapContainerRef}
            role="region"
            aria-label="Map view"
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              flex: 1,
              minHeight: '300px'
            } as CSSProperties}
          >
            {skyEnabled ? (
              <>
                {/* Photo stays underneath until the sky's first frame, fades
                    out under the fading-in canvas, then unmounts */}
                {!skySettled && <ResponsiveBackground />}
                <AtlasSkyLayer
                  ref={skyRef}
                  tier={skyTier}
                  scene={skyScene}
                  worldRef={worldRef}
                  onReady={() => setSkyReady(true)}
                  onFallback={() => {
                    setSkyFailed(true);
                    setSkyReady(false);
                  }}
                />
              </>
            ) : (
              <ResponsiveBackground />
            )}

            {/* One world layer: the engraved plate and the interactive DOM
                stars travel together under the engine's camera (glides,
                drag-to-peek with spring-back). Mounted whenever the atlas is
                active so the engine can bind it before the seeds arrive. */}
            {skyEnabled && (
              <div className="atlas-world" ref={worldRef}>
                {!loading && constellation && containerDimensions && (
                  <AtlasPlate
                    width={containerDimensions.width}
                    height={containerDimensions.height}
                    segments={lineSegments}
                    litCount={litCount}
                    constellationName={constellation.name || ''}
                    constellationDescription={constellation.description || ''}
                    figureCleanName={cleanFigureName}
                    gatheredCount={gatheredCount}
                    totalSeeds={totalSeeds}
                    isComplete={isCompleted && !completionPending}
                    showAnnotations={!isMobileHub}
                  />
                )}
                {!loading && (
                  <ConstellationMap
                    revelationStage={revelationStage}
                    lineSegments={lineSegments}
                    constellation={constellation || undefined}
                    boundingBox={boundingBox || undefined}
                    seeds={seeds as any}
                    seedPositions={seedPositions as any}
                    seedLevels={displaySeedLevels}
                    selectedSeedId={selectedSeed?.id ?? appSelectedSeedId ?? null}
                    atlas
                    novaSeedId={novaSeedId}
                    onSeedClick={handleMapSeedClick}
                  />
                )}
              </div>
            )}

            {loading ? (
              <div className="loading-state">{tNode('common.loading')}</div>
            ) : (
              <>
            {showConstellationInfo && constellation && (
              <>
                {isMobileHub && (
                  /* A button, so the sky engine reads it as chrome and does
                     not start a camera drag under the panel. */
                  <button
                    type="button"
                    className="constellation-info-scrim"
                    tabIndex={-1}
                    aria-hidden="true"
                    onClick={() => setShowConstellationInfo(false)}
                  />
                )}
                <ConstellationInfo
                  name={constellation.name || ''}
                  description={constellation.description || ''}
                  figureCleanName={isMobileHub ? cleanFigureName : undefined}
                  gatheredCount={isMobileHub ? gatheredCount : undefined}
                  totalSeeds={isMobileHub ? totalSeeds : undefined}
                  isComplete={isMobileHub && isCompleted && !completionPending}
                  rotated={displayConstellation !== constellation}
                  onClose={isMobileHub ? () => setShowConstellationInfo(false) : undefined}
                />
              </>
            )}

            {!skyEnabled && (
              <ConstellationMap
                revelationStage={revelationStage}
                lineSegments={lineSegments}
                constellation={constellation || undefined}
                boundingBox={boundingBox || undefined}
                seeds={seeds as any}
                seedPositions={seedPositions as any}
                seedLevels={seedLevels}
                selectedSeedId={selectedSeed?.id ?? appSelectedSeedId ?? null}
                onSeedClick={handleMapSeedClick}
              />
            )}

            {/* Celebration overlays: mutually exclusive. Priority: bloom card > figure completion > legacy completion.
                Atlas mode: the plate performs the choreography (the engraver
                finishes the plate on ignite()), so the DOM celebration keeps
                only its informational core, delayed until the ink is dry.
                FigureCompletionOverlay's star-by-star illumination duplicates
                that choreography and is used on flat tiers only. */}
            {showCompletionCelebration && !showFigureCompletion && !showBloomCard && completionCardReady && (
              <CompletionCelebration
                constellationName={constellation?.name || ''}
                totalSeeds={totalSeeds}
                onClose={() => setShowCompletionCelebration(false)}
                votingPowerTotal={completionTierData?.total}
                newlyUnlockedTier={completionTierData?.newlyUnlockedTier}
                onOpenCommunity={isSelfHost ? undefined : () => {
                  setShowCompletionCelebration(false);
                  setShowCommunity(true);
                }}
              />
            )}

            {showFigureCompletion && !showBloomCard && skyEnabled && completionCardReady && (
              <CompletionCelebration
                constellationName={constellation?.name || ''}
                totalSeeds={totalSeeds}
                onClose={() => setShowFigureCompletion(false)}
                votingPowerTotal={completionTierData?.total}
                newlyUnlockedTier={completionTierData?.newlyUnlockedTier}
                onOpenCommunity={isSelfHost ? undefined : () => {
                  setShowFigureCompletion(false);
                  setShowCommunity(true);
                }}
              />
            )}

            {showFigureCompletion && !showBloomCard && !skyEnabled && constellation?.pattern && (
              <FigureCompletionOverlay
                constellationPattern={constellation.pattern}
                figureName={selectedFigure?.name || ''}
                constellationName={constellation.name || ''}
                totalSeeds={totalSeeds}
                soundUrl={uiSounds.getUrl('bloom-choir')}
                soundEnabled={uiSounds.isEnabled()}
                onClose={() => setShowFigureCompletion(false)}
                votingPowerTotal={completionTierData?.total}
                newlyUnlockedTier={completionTierData?.newlyUnlockedTier}
                onOpenCommunity={isSelfHost ? undefined : () => {
                  setShowFigureCompletion(false);
                  setShowCommunity(true);
                }}
              />
            )}

            {showBloomCard && bloomQueue[bloomIndex] && (
              <BloomTransformationCard
                fromLevel={bloomQueue[bloomIndex].fromLevel}
                toLevel={bloomQueue[bloomIndex].toLevel}
                seedTitle={bloomQueue[bloomIndex].seedTitle}
                figureName={bloomQueue[bloomIndex].figureName}
                atlas={skyEnabled}
                onClose={handleBloomDismiss}
                soundUrl={uiSounds.getUrl(bloomQueue[bloomIndex].toLevel === 4 ? 'bloom-choir' : 'bloom-shimmer')}
                soundEnabled={uiSounds.isEnabled()}
                /* First-mastery detection: when this bloom is a Level-4 mastery
                   AND no prior mastery has been witnessed yet, this is the
                   user's first ever voice-earning moment. The bloom card adds
                   the +1 voting power + Voice tier reveal block. */
                isFirstMastery={
                  bloomQueue[bloomIndex].toLevel === 4 && !hasAnyWitnessedMastery()
                }
              />
            )}

            {/* The map helper dies with the redesign (Wave-1 helper doctrine):
                the plate explains itself. Flat fallback tiers keep it. */}
            {showInitialPatternHelp && !skyEnabled && (
              <InitialPatternHelp
                onDismiss={() => setShowInitialPatternHelp(false)}
                revelationStage={revelationStage}
                isFirstTime={true}
              />
            )}

            {selectedSeed && (
              <SeedDetailsPanel
                seed={selectedSeed as any}
                onClose={() => setSelectedSeed(null)}
                onViewDetails={handleViewDetails}
                onSelect={handleSeedSelect}
                showSelectButton={showSelectButton}
                atlas={skyEnabled}
                atlasDockSide={atlasDockSide}
                atlasDockTopPct={atlasDockTopPct}
                atlasDockCompact={atlasDockCompact}
                constellationName={translatedConstellationName}
                figureId={selectedFigure?.id || ''}
                onModeSelect={(seed, mode) => {
                  // Route through handleSeedSelect for proper figure selection (FigureCarousel context)
                  handleSeedSelect(seed, mode);
                }}
                onOpenModeSelector={() => {
                  // Route seed selection through parent, then signal mode selector to open
                  if (selectedSeed) {
                    handleSeedSelect(selectedSeed, '__open_selector__');
                  }
                }}
              />
            )}
              </>
            )}
          </div>

          {/* Full-screen detail view overlay - opens when "View Full Details" or [List] clicked */}
          {!loading && showDetailView && (
            <div className="detail-view-overlay">
              {/* Close returns to map */}
              <SeedDetailView
                seeds={seeds}
                initialSeedNumber={initialSeedNumber}
                onClose={() => setShowDetailView(false)}
                figureName={selectedFigure?.name}
              />

              {/* Seeds explorer helper removed — list view is self-explanatory */}
            </div>
          )}
          
          {/* Mobile bottom toolbar */}
          {!loading && isMobileHub && (
            <div className="mobile-bottom-toolbar">
              <div className="toolbar-buttons">
                <button
                  className="toolbar-btn"
                  onClick={handleOpenListView}
                  aria-label={tString('seeds.viewModes.switchToList', 'Switch to list view')}
                >
                  <ListBullets size={22} weight={showDetailView ? 'fill' : 'regular'} />
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => setShowFactCheck(true)}
                  aria-label={tString('factCheck.facts', 'Facts')}
                >
                  <SealCheck size={22} />
                </button>
                {!isSelfHost && (
                  <button
                    className="toolbar-btn"
                    onClick={() => setShowCommunity(true)}
                    aria-label={tString('community.modalTitle', 'Community')}
                  >
                    <Users size={22} />
                  </button>
                )}
                <button
                  className={`toolbar-btn toolbar-info-btn ${showConstellationInfo ? 'active' : ''}`}
                  onClick={() => setShowConstellationInfo(!showConstellationInfo)}
                  aria-label={showConstellationInfo ? tString('constellations.hideInfo', 'Hide info') : tString('constellations.showInfo', 'Show info')}
                >
                  <Info size={22} />
                </button>
              </div>
            </div>
          )}

          {/* The old segmented progress strip belongs to the flat map only.
              On the atlas, progress lives in the cartouche ("N of M stars
              gathered"), read quietly, the way a plate is read. */}
          {!loading && !skyEnabled && (
          <ProgressBar
            gatheredCount={gatheredCount}
            totalSeeds={totalSeeds}
            progressPercentage={progressPercentage}
            isCompleted={isCompleted}
            seedSlices={seedSlices}
            translations={{
              progress: tString('wizardModal.progress', 'Progress'),
              completed: tString('wizardModal.completed', 'Completed'),
              seedsGathered: tString('seeds.gathered', 'seeds gathered'),
              constellationComplete: tString('seeds.constellationComplete', 'Constellation Complete!')
            }}
          />
          )}
        </>
      )}

      {/* FactCheck modal — portal-based, renders to document.body */}
      {showFactCheck && selectedFigure && (
        <FactCheckModal
          figureId={selectedFigure.id || ''}
          figureName={selectedFigure.name}
          onClose={() => setShowFactCheck(false)}
        />
      )}

      {/* Community governance modal */}
      {!isSelfHost && showCommunity && (
        <CommunityGovernanceModal
          isOpen={showCommunity}
          onClose={() => setShowCommunity(false)}
        />
      )}
    </ModalContainer>
  );
};

export default WisdomMapModal;