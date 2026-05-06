import type { CouncilConfig } from '../stores/slices/domainTypes';

export interface CouncilControllerApi {
  startCouncil: (config: CouncilConfig) => Promise<void>;
  endCouncil: () => Promise<void>;
  pauseCouncil: () => Promise<void>;
  resumeCouncil: () => Promise<void>;
  resetCouncil: () => void;
}

const noop = async () => undefined;
const noopApi: CouncilControllerApi = {
  startCouncil: noop,
  endCouncil: noop,
  pauseCouncil: noop,
  resumeCouncil: noop,
  resetCouncil: () => undefined,
};

let activeApi: CouncilControllerApi = noopApi;
let activeRegistration: symbol | null = null;
const listeners = new Set<(api: CouncilControllerApi) => void>();

const notify = () => {
  listeners.forEach((listener) => {
    try {
      listener(activeApi);
    } catch (error) {
      console.error('[CouncilControllerRegistry] listener failed', error);
    }
  });
};

export const registerCouncilController = (api: CouncilControllerApi) => {
  const registrationId = Symbol('council-controller');
  activeRegistration = registrationId;
  activeApi = api;
  notify();

  return () => {
    if (activeRegistration === registrationId) {
      activeRegistration = null;
      activeApi = noopApi;
      notify();
    }
  };
};

export const subscribeCouncilController = (listener: (api: CouncilControllerApi) => void) => {
  listeners.add(listener);
  try {
    listener(activeApi);
  } catch (error) {
    console.error('[CouncilControllerRegistry] listener failed', error);
  }

  return () => {
    listeners.delete(listener);
  };
};

export const getCouncilControllerApi = () => activeApi;
