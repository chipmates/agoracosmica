// Language context for public pages - no Zustand dependency
// Remove this file when stripping marketing pages from a fork

import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getPublicT } from '../../utils/public/publicI18n';

type Language = 'en' | 'de';

interface PublicLangContextValue {
  lang: Language;
  t: (key: string, fallback?: string) => string;
}

const Context = createContext<PublicLangContextValue>({
  lang: 'en',
  t: (key: string) => key,
});

export function PublicLangProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const lang: Language = location.pathname.startsWith('/de/') || location.pathname === '/de' ? 'de' : 'en';
  const t = useMemo(() => getPublicT(lang), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({ lang, t }), [lang, t]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePublicLang() {
  return useContext(Context);
}
