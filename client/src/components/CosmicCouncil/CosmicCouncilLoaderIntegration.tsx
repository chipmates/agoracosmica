// src/components/CosmicCouncil/CosmicCouncilLoaderIntegration.tsx
import { FC, useState, useEffect, useLayoutEffect } from 'react';
import CosmicCouncilLoader, { LoaderStage } from './CosmicCouncilLoader';
import { sendSessionEndBeacon } from '../../services/audio/tts/ttsSessions';

interface LoaderState {
  isVisible: boolean;
  stage: LoaderStage;
  participants: any[];
  question: string;
}

interface CouncilService {
  getCurrentLoaderState?: () => LoaderState | null;
  addEventListener: (event: string, handler: (state: LoaderState) => void) => void;
  removeEventListener: (event: string, handler: (state: LoaderState) => void) => void;
  /** Optional — called by opt-out button if available. Aborts all active work. */
  cancelGeneration?: () => void;
  /** Optional — per-figure session ids to evict via LT-11 beacon on opt-out. */
  getActiveSessionIds?: () => string[];
}

interface CosmicCouncilLoaderIntegrationProps {
  councilService?: CouncilService | null;
}

/**
 * Integration component that manages the display of the CosmicCouncilLoader
 * based on the CustomCouncilService state.
 *
 * This component listens to the council service loader state changes
 * and shows/hides the loader appropriately.
 */
const CosmicCouncilLoaderIntegration: FC<CosmicCouncilLoaderIntegrationProps> = ({ councilService }) => {

  const [loaderState, setLoaderState] = useState<LoaderState>({
    isVisible: false,
    stage: 'generating',
    participants: [],
    question: ''
  });


  // Sync with service state when service reference changes
  useLayoutEffect(() => {
    if (councilService && typeof councilService.getCurrentLoaderState === 'function') {
      const currentState = councilService.getCurrentLoaderState();
      if (currentState && currentState.isVisible !== loaderState.isVisible) {
        setLoaderState(currentState);
      }
    }
  }, [councilService]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    if (!councilService) {
      return;
    }

    // Check current loader state immediately on mount
    if (typeof councilService.getCurrentLoaderState === 'function') {
      const currentState = councilService.getCurrentLoaderState();

      if (currentState && currentState.isVisible) {
        setLoaderState(currentState);
      }
    }

    // Listen for loader state changes
    const handleLoaderStateChange = (newLoaderState: LoaderState): void => {
      setLoaderState(newLoaderState);
    };


    // Add listener
    councilService.addEventListener('onCouncilLoaderChange', handleLoaderStateChange);

    // Cleanup listener on unmount
    return () => {
      councilService.removeEventListener('onCouncilLoaderChange', handleLoaderStateChange);
    };
  }, [councilService]);

  // Only render loader if it should be visible
  if (!loaderState.isVisible) {
    return null;
  }

  const handleSwitchToText = () => {
    // Council opt-out: cancel ongoing generation if the service supports it
    // (CustomCouncilService has cancelGeneration()), then evict any active
    // session ids via the LT-11 beacon so gateway admission slots free up
    // immediately rather than waiting for 3600s TTL.
    if (councilService?.cancelGeneration) {
      try {
        councilService.cancelGeneration();
      } catch {
        /* swallow — we're aborting anyway */
      }
    }
    if (councilService?.getActiveSessionIds) {
      try {
        for (const sid of councilService.getActiveSessionIds()) {
          sendSessionEndBeacon(sid);
        }
      } catch {
        /* beacon is fire-and-forget */
      }
    }
  };

  return (
    <CosmicCouncilLoader
      councilParticipants={loaderState.participants}
      question={loaderState.question}
      stage={loaderState.stage}
      onSwitchToText={councilService?.cancelGeneration ? handleSwitchToText : undefined}
    />
  );
};

export default CosmicCouncilLoaderIntegration;
