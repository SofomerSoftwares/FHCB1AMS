import React, { createContext, useContext, useState, useEffect } from 'react';
import enMessages from '../messages/en.json';
import amMessages from '../messages/am.json';

export type Locale = 'en' | 'am';

interface LanguageContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, fallback?: string) => string;
  isAmharic: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const messages: Record<Locale, any> = {
  en: enMessages,
  am: amMessages,
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const saved = localStorage.getItem('archivetrack_locale') as Locale | null;
    if (saved && (saved === 'en' || saved === 'am')) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('archivetrack_locale', l);
  };

  const t = (path: string, fallback?: string): string => {
    const keys = path.split('.');
    let current = messages[locale];

    for (const key of keys) {
      if (!current || typeof current !== 'object') {
        // Fallback to English if not found in current locale
        let enCurrent = messages.en;
        for (const enKey of keys) {
          if (!enCurrent || typeof enCurrent !== 'object') {
            return fallback || path;
          }
          enCurrent = enCurrent[enKey];
        }
        return typeof enCurrent === 'string' ? enCurrent : fallback || path;
      }
      current = current[key];
    }

    return typeof current === 'string' ? current : fallback || path;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, isAmharic: locale === 'am' }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
