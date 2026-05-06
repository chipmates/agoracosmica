import type { SessionControllerOptions } from './sessionController';

type Listener = (options: SessionControllerOptions) => void;

let currentOptions: SessionControllerOptions = {};
let activeRegistration: symbol | null = null;
const listeners = new Set<Listener>();

const notify = () => {
  listeners.forEach((listener) => {
    try {
      listener(currentOptions);
    } catch (error) {
      console.error('[SessionControllerRegistry] listener failed', error);
    }
  });
};

export const registerSessionControllerHandlers = (options: SessionControllerOptions) => {
  const registrationId = Symbol('session-controller-handlers');
  activeRegistration = registrationId;
  currentOptions = { ...options };
  notify();

  return () => {
    if (activeRegistration === registrationId) {
      activeRegistration = null;
      currentOptions = {};
      notify();
    }
  };
};

export const subscribeSessionControllerHandlers = (listener: Listener) => {
  listeners.add(listener);
  try {
    listener(currentOptions);
  } catch (error) {
    console.error('[SessionControllerRegistry] listener failed', error);
  }

  return () => {
    listeners.delete(listener);
  };
};
