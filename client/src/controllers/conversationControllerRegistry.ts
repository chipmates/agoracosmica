import type { ConversationControllerDeps } from './conversationController';

type Listener = (deps: ConversationControllerDeps) => void;

let currentDeps: ConversationControllerDeps = {};
let activeRegistration: symbol | null = null;
const listeners = new Set<Listener>();

const notify = () => {
  listeners.forEach((listener) => {
    try {
      listener(currentDeps);
    } catch (error) {
      console.error('[ConversationControllerRegistry] listener failed', error);
    }
  });
};

export const registerConversationControllerHandlers = (deps: ConversationControllerDeps) => {
  const registrationId = Symbol('conversation-controller-handlers');
  activeRegistration = registrationId;
  currentDeps = { ...deps };
  if (import.meta.env.DEV) {
    console.log('[Mode2Triage][Registry] handlers registered', {
      haveStream: Boolean(deps.streamConversation),
      haveHydrate: Boolean(deps.hydrateHistory),
      havePersist: Boolean(deps.persistMessages),
    });
  }
  notify();

  return () => {
    if (activeRegistration === registrationId) {
      activeRegistration = null;
      currentDeps = {};
      notify();
    }
  };
};

export const subscribeConversationControllerHandlers = (listener: Listener) => {
  listeners.add(listener);
  try {
    listener(currentDeps);
    if (import.meta.env.DEV) {
      console.log('[Mode2Triage][Registry] new subscriber; current handlers', {
        haveStream: Boolean(currentDeps.streamConversation),
      });
    }
  } catch (error) {
    console.error('[ConversationControllerRegistry] listener failed', error);
  }

  return () => {
    listeners.delete(listener);
  };
};
