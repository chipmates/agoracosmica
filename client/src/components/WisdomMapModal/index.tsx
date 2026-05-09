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

// Import CSS
import './css/main.css';

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
    'Platon': 'plato' // German for Plato
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
  const { tString, tNode } = useTranslation();

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
  
  // Reference to track previous gathered count for completion celebration
  const prevMasteredCountRef = useRef<number>(0);

  // Track window width for responsive hub layout
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

  // Sync local selectedSeed with the app's actual selected seed from Zustand
  useEffect(() => {
    if (!seeds.length || !appSelectedSeedId) return;
    const match = seeds.find(s => String(s.id) === String(appSelectedSeedId));
    if (match && match.id !== selectedSeed?.id) {
      setSelectedSeed(match);
    }
  }, [seeds, appSelectedSeedId]);

  // Create zodiac constellation layout
  const constellation = useMemo<Constellation | null>(() => {
    if (!selectedFigure) {
      return null;
    }
    return getConstellationForFigure(selectedFigure.name);
  }, [selectedFigure]);
  
  // Calculate star positions and boundingBox
  const { seedPositions, boundingBox } = useMemo<{ seedPositions: SeedPosition[]; boundingBox: BoundingBox | null }>(() => {
    if (!seeds.length || !constellation || !containerDimensions) {
      return { seedPositions: [], boundingBox: null };
    }

    const result = calculateConstellationPositions(seeds as any, constellation as any, containerDimensions);
    return result as { seedPositions: SeedPosition[]; boundingBox: BoundingBox | null };
  }, [seeds, constellation, containerDimensions]);
  
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
    if (!boundingBox || !containerDimensions || !constellation) return [];

    const baseSegments = calculateConstellationPaths(
      seedPositions as any,
      boundingBox as any,
      constellation.pattern || [],
      containerDimensions,
      constellation as any // Pass the full constellation object
    );
    
    // Add revelation stage information to each segment
    return baseSegments.map(segment => ({
      ...segment,
      revelationStage,
      shouldShow: revelationStage !== 'void' // Show lines for all stages except void
    }));
  }, [boundingBox, containerDimensions, constellation, seedPositions, revelationStage]);

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
    }

    prevMasteredCountRef.current = completedModes;
  }, [seedSlices]);

  // Bloom detection: compute pending blooms once per modal open cycle
  useEffect(() => {
    if (!isOpen) {
      bloomsDetectedRef.current = false;
      return;
    }
    if (bloomsDetectedRef.current || !seedSlices.length || !selectedFigure?.id) return;
    bloomsDetectedRef.current = true;

    const figureId = selectedFigure.id;
    const currentLevels = computeSeedLevels(seedSlices);
    const figureName = selectedFigure.name || '';

    const blooms = computePendingBlooms(figureId, currentLevels, seeds, figureName);

    if (blooms.length > 0) {
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

  return (
    <ModalContainer 
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="wisdom-map-content"
      animationType="fade-scale"
      overlayClassName="wisdom-map-overlay"
      alignTop={false}
      backgroundVariant="fullscreen"
    >
      {/* Hub header — responsive layout */}
      {(() => {
        const lastName = selectedFigure ? getLastNameForDisplay(selectedFigure.name, tString('figures.echoOf', 'Echo of')) : '';
        const titleContent = (
          <span className="wisdom-modal-title">{lastName}'S WISDOM</span>
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
                <button
                  className="header-action-btn community-btn"
                  onClick={() => setShowCommunity(true)}
                  aria-label={tString('community.modalTitle', 'Community')}
                >
                  <Users size={22} />
                  <span>{tString('community.modalTitle', 'Community')}</span>
                </button>
              </div>
            }
            rightContent={
              <div className="header-button-group">
                <button
                  className={`header-action-btn info-btn ${showConstellationInfo ? 'active' : ''}`}
                  onClick={() => setShowConstellationInfo(!showConstellationInfo)}
                  aria-label={showConstellationInfo ? 'Hide constellation info' : 'Show constellation info'}
                >
                  <Info size={22} />
                </button>
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

      {loading ? (
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
            className="map-container visible"
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
            <ResponsiveBackground />

            {showConstellationInfo && constellation && (
              <ConstellationInfo
                name={constellation.name || ''}
                description={constellation.description || ''}
              />
            )}

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

            {/* Celebration overlays: mutually exclusive. Priority: bloom card > figure completion > legacy completion */}
            {showCompletionCelebration && !showFigureCompletion && !showBloomCard && (
              <CompletionCelebration
                constellationName={constellation?.name || ''}
                totalSeeds={totalSeeds}
                onClose={() => setShowCompletionCelebration(false)}
                votingPowerTotal={completionTierData?.total}
                newlyUnlockedTier={completionTierData?.newlyUnlockedTier}
                onOpenCommunity={() => {
                  setShowCompletionCelebration(false);
                  setShowCommunity(true);
                }}
              />
            )}

            {showFigureCompletion && !showBloomCard && constellation?.pattern && (
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
                onOpenCommunity={() => {
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

            {showInitialPatternHelp && (
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
          </div>

          {/* Full-screen detail view overlay - opens when "View Full Details" or [List] clicked */}
          {showDetailView && (
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
          {isMobileHub && (
            <div className="mobile-bottom-toolbar">
              <div className="toolbar-buttons">
                <button
                  className="toolbar-btn"
                  onClick={handleOpenListView}
                  aria-label="List view"
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
                <button
                  className="toolbar-btn"
                  onClick={() => setShowCommunity(true)}
                  aria-label={tString('community.modalTitle', 'Community')}
                >
                  <Users size={22} />
                </button>
                <button
                  className={`toolbar-btn toolbar-info-btn ${showConstellationInfo ? 'active' : ''}`}
                  onClick={() => setShowConstellationInfo(!showConstellationInfo)}
                  aria-label={showConstellationInfo ? 'Hide info' : 'Show info'}
                >
                  <Info size={22} />
                </button>
              </div>
            </div>
          )}

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
      {showCommunity && (
        <CommunityGovernanceModal
          isOpen={showCommunity}
          onClose={() => setShowCommunity(false)}
        />
      )}
    </ModalContainer>
  );
};

export default WisdomMapModal;