import { cosmicCouncilService } from '../services/council';
import { useDomainStore } from '../stores';
import type { ConversationMessage, CouncilConfig } from '../stores/slices/domainTypes';
import { registerCouncilController, type CouncilControllerApi } from './councilControllerRegistry';
import { councilError } from '../services/council/logger';

const deriveInitialPhase = (config: CouncilConfig): string =>
  (config?.currentPhase as string | undefined) ?? 'foundations';

const deriveInitialSpeaker = (config: CouncilConfig): string | null => {
  return config?.moderator ?? null;
};

const ensureConfigShape = (config: CouncilConfig): CouncilConfig => {
  const initialPhase = deriveInitialPhase(config);
  const initialSpeaker = deriveInitialSpeaker(config);

  return {
    ...config,
    currentPhase: initialPhase,
    currentSpeaker: initialSpeaker ?? config.currentSpeaker ?? null,
  } as CouncilConfig;
};

const appendCouncilConversationMessage = (message: ConversationMessage) => {
  const store = useDomainStore.getState();
  store.appendConversationMessage(message);
  store.setConversationStarted(true);
};

const setGlobalError = (message: string) => {
  const store = useDomainStore.getState();
  store.setCouncilError(message);
  store.setAppError(message);
};

export interface CouncilController {
  start: () => void;
  stop: () => void;
  startCouncil: CouncilControllerApi['startCouncil'];
  endCouncil: CouncilControllerApi['endCouncil'];
  pauseCouncil: CouncilControllerApi['pauseCouncil'];
  resumeCouncil: CouncilControllerApi['resumeCouncil'];
  resetCouncil: CouncilControllerApi['resetCouncil'];
}

export const createCouncilController = (): CouncilController => {
  let isRunning = false;
  let unregisterApi: (() => void) | null = null;

  const handleStateChange = (state: any) => {
    const store = useDomainStore.getState();

    if (state?.isActive === false) {
      store.toggleCouncilMode(false);
      store.completeCouncil();
      store.resetConversationState();
      store.setConversationHistoryKey(null);
      store.setCouncilCurrentMessage('');
      store.setCouncilAudioPlayback(null);
      return;
    }

    if (state?.isActive) {
      store.toggleCouncilMode(true);
      store.setConversationHistoryKey(null);
    }

    if (state?.currentSpeaker !== undefined) {
      store.setCouncilSpeaker(state.currentSpeaker ?? null);
    }

    if (state?.mode) {
      store.setCouncilConfig({
        ...(store.council.config ?? {}),
        mode: state.mode,
        type: state.type,
        question: state.question,
        participants: state.participants,
        councilTitle: state.councilTitle,
        councilImage: state.councilImage,
        isCompleted: state.isCompleted,
        moderator: state.moderator,
      } as CouncilConfig);
    }
  };

  const handleSpeakerChange = (speaker: string) => {
    const store = useDomainStore.getState();
    store.setCouncilSpeaker(speaker ?? null);
    store.setCouncilCurrentMessage('');
    store.setCouncilAudioPlayback(null);
  };

  const handlePhaseChange = (phase: string) => {
    const store = useDomainStore.getState();
    store.setCouncilPhase(phase ?? null);
  };

  const handleError = (error: Error | { message?: string }) => {
    const message = error instanceof Error ? error.message : error?.message ?? 'Council error occurred';
    setGlobalError(message);
  };

  const handleMessageSpoken = ({ speaker, message }: { speaker: string; message: string }) => {
    const store = useDomainStore.getState();
    store.setCouncilSpeaker(speaker ?? null);
    store.setCouncilCurrentMessage(message ?? '');
  };

  const handleAudioPlaybackStart = (data: { speaker: string; speakerId: string; content: string; duration: number }) => {
    const store = useDomainStore.getState();
    store.setCouncilAudioPlayback({
      speakerId: data.speakerId,
      content: data.content,
      duration: data.duration,
      startedAt: Date.now(),
    });
  };

  const handleCouncilMessage = (payload: any) => {
    const content = payload?.content ?? payload?.completeContent ?? '';
    if (typeof content !== 'string' || content.trim().length === 0) {
      return;
    }

    const conversationMessage: ConversationMessage = {
      role: 'council',
      content,
      timestamp: new Date().toISOString(),
      speaker: payload?.speaker ?? undefined,
      figureName: payload?.speakerName ?? undefined,
      isComplete: payload?.type === 'complete',
      sessionId: payload?.sessionId ?? undefined,
    } as ConversationMessage & { isComplete?: boolean; sessionId?: string | number };

    appendCouncilConversationMessage(conversationMessage);
    const store = useDomainStore.getState();
    store.setCouncilCurrentMessage(content);
  };

  const addListeners = () => {
    cosmicCouncilService.addEventListener('onStateChange', handleStateChange);
    cosmicCouncilService.addEventListener('onSpeakerChange', handleSpeakerChange);
    cosmicCouncilService.addEventListener('onPhaseChange', handlePhaseChange);
    cosmicCouncilService.addEventListener('onError', handleError);
    cosmicCouncilService.addEventListener('onMessageSpoken', handleMessageSpoken);
    cosmicCouncilService.addEventListener('onCouncilMessage', handleCouncilMessage);
    cosmicCouncilService.addEventListener('onAudioPlaybackStart', handleAudioPlaybackStart);
  };

  const removeListeners = () => {
    cosmicCouncilService.removeEventListener('onStateChange', handleStateChange);
    cosmicCouncilService.removeEventListener('onSpeakerChange', handleSpeakerChange);
    cosmicCouncilService.removeEventListener('onPhaseChange', handlePhaseChange);
    cosmicCouncilService.removeEventListener('onError', handleError);
    cosmicCouncilService.removeEventListener('onMessageSpoken', handleMessageSpoken);
    cosmicCouncilService.removeEventListener('onCouncilMessage', handleCouncilMessage);
    cosmicCouncilService.removeEventListener('onAudioPlaybackStart', handleAudioPlaybackStart);
  };

  const startCouncil: CouncilControllerApi['startCouncil'] = async (config) => {
    const store = useDomainStore.getState();
    const preparedConfig = ensureConfigShape(config);

    store.setCouncilError(null);
    store.toggleCouncilMode(true);
    store.resetConversationState();
    store.startCouncil(preparedConfig);
    store.setCouncilCurrentMessage('');
    store.setConversationHistoryKey(null);

    try {
      // Config types differ between store and service — cast is intentional
      const result = await cosmicCouncilService.startCouncilDebate(config as Parameters<typeof cosmicCouncilService.startCouncilDebate>[0]);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to start council');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start council';
      setGlobalError(message);
      store.toggleCouncilMode(false);
      store.resetCouncil();
      throw error;
    }
  };

  const endCouncil: CouncilControllerApi['endCouncil'] = async () => {
    const store = useDomainStore.getState();
    try {
      await cosmicCouncilService.endCouncil();
    } catch (error) {
      councilError('[CouncilController] Failed to end council via service', error);
      setGlobalError('Failed to end council');
    } finally {
      store.toggleCouncilMode(false);
      store.completeCouncil();
      store.resetConversationState();
      store.setConversationHistoryKey(null);
      store.setCouncilCurrentMessage('');
    }
  };

  const pauseCouncil: CouncilControllerApi['pauseCouncil'] = async () => {
    const service = cosmicCouncilService as unknown as { pauseCouncil?: () => Promise<void> };
    if (typeof service.pauseCouncil === 'function') {
      try {
        await service.pauseCouncil();
      } catch (error) {
        councilError('[CouncilController] Failed to pause council', error);
      }
    }
  };

  const resumeCouncil: CouncilControllerApi['resumeCouncil'] = async () => {
    const service = cosmicCouncilService as unknown as { resumeCouncil?: () => Promise<void> };
    if (typeof service.resumeCouncil === 'function') {
      try {
        await service.resumeCouncil();
      } catch (error) {
        councilError('[CouncilController] Failed to resume council', error);
      }
    }
  };

  const resetCouncil = () => {
    const store = useDomainStore.getState();
    store.toggleCouncilMode(false);
    store.resetCouncil();
    store.resetConversationState();
    store.setConversationHistoryKey(null);
    store.setCouncilCurrentMessage('');
    cosmicCouncilService.cleanup?.();
  };

  const controllerApi: CouncilControllerApi = {
    startCouncil,
    endCouncil,
    pauseCouncil,
    resumeCouncil,
    resetCouncil,
  };

  return {
    start() {
      if (isRunning) {
        return;
      }
      isRunning = true;
      addListeners();
      unregisterApi = registerCouncilController(controllerApi);
    },
    stop() {
      if (!isRunning) {
        return;
      }
      isRunning = false;
      removeListeners();
      unregisterApi?.();
      unregisterApi = null;
    },
    ...controllerApi,
  };
};

export type CouncilControllerInstance = ReturnType<typeof createCouncilController>;
