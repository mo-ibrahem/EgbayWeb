'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import enTranslations from '@/locales/en.json';
import arTranslations from '@/locales/ar.json';

export type SupportedLanguage = 'en' | 'ar';

interface LanguageContextValue {
  language: SupportedLanguage;
  isRTL: boolean;
  changeLanguage: (lang: SupportedLanguage) => void;
  toggleLanguage: () => void;
  t: (path: string, fallback?: string) => string;
}

const translations: Record<SupportedLanguage, any> = {
  en: enTranslations,
  ar: arTranslations,
};

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  isRTL: false,
  changeLanguage: () => {},
  toggleLanguage: () => {},
  t: (_path: string, fallback?: string) => fallback || _path,
});

const LANGUAGE_STORAGE_KEY = 'egbay_web_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as SupportedLanguage | null;
      if (saved && (saved === 'en' || saved === 'ar')) {
        setLanguage(saved);
        document.documentElement.dir = saved === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = saved;
      }
    } catch {
      // ignore
    } finally {
      setMounted(true);
    }
  }, []);

  const changeLanguage = useCallback((newLang: SupportedLanguage) => {
    setLanguage(newLang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
      document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = newLang;
    } catch {
      // ignore
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    const next = language === 'en' ? 'ar' : 'en';
    changeLanguage(next);
  }, [language, changeLanguage]);

  const t = useCallback(
    (path: string, fallback?: string): string => {
      const keys = path.split('.');
      let current: any = translations[language];

      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          // Fallback to English translation if key is missing in Arabic
          let enFallback: any = translations['en'];
          for (const ek of keys) {
            if (enFallback && typeof enFallback === 'object' && ek in enFallback) {
              enFallback = enFallback[ek];
            } else {
              enFallback = undefined;
              break;
            }
          }
          return typeof enFallback === 'string' ? enFallback : fallback || path;
        }
      }

      return typeof current === 'string' ? current : fallback || path;
    },
    [language]
  );

  const isRTL = language === 'ar';

  return (
    <LanguageContext.Provider
      value={{
        language,
        isRTL,
        changeLanguage,
        toggleLanguage,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
