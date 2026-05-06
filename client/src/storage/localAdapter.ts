const isStorageAvailable = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeExecute = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch (error) {
    console.warn('[LocalStorageAdapter] operation failed', error);
    return fallback;
  }
};

export const LocalStorageAdapter = {
  keys(): string[] {
    if (!isStorageAvailable()) {
      return [];
    }
    return safeExecute(() => Object.keys(window.localStorage), [] as string[]);
  },

  getString(key: string): string | null {
    if (!isStorageAvailable()) {
      return null;
    }
    return safeExecute(() => window.localStorage.getItem(key), null);
  },

  setString(key: string, value: string): void {
    if (!isStorageAvailable()) {
      return;
    }
    safeExecute(() => {
      window.localStorage.setItem(key, value);
      return true;
    }, true);
  },

  remove(key: string): void {
    if (!isStorageAvailable()) {
      return;
    }
    safeExecute(() => {
      window.localStorage.removeItem(key);
      return true;
    }, true);
  },

  getJSON<T>(key: string, fallback: T): T {
    const raw = this.getString(key);
    if (!raw) {
      return fallback;
    }
    return safeExecute(() => JSON.parse(raw) as T, fallback);
  },

  setJSON<T>(key: string, value: T): void {
    this.setString(key, JSON.stringify(value));
  },
};
