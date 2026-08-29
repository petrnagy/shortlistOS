import type { ReactNode } from "react";
import { I18nProvider } from "@lingui/react";
import { createContext, useContext, useEffect, useState } from "react";

import type { Locale } from "~/locales";
import { defaultLocale, locales } from "~/locales";
import { i18n, initializeI18n } from "~/utils/i18n";

interface LinguiContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  availableLocales: Locale[];
}

const LinguiContext = createContext<LinguiContextType | undefined>(undefined);

export function useLinguiContext() {
  const context = useContext(LinguiContext);
  if (!context) {
    throw new Error("useLinguiContext must be used within a LinguiProvider");
  }
  return context;
}

interface LinguiProviderProps {
  children: ReactNode;
}

export function LinguiProviderWrapper({ children }: LinguiProviderProps) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);

  initializeI18n();

  useEffect(() => {
    localStorage.setItem("locale", defaultLocale);
  }, []);

  return (
    <LinguiContext.Provider
      value={{ locale, setLocale, availableLocales: [...locales] }}
    >
      <I18nProvider i18n={i18n} key={locale}>
        {children}
      </I18nProvider>
    </LinguiContext.Provider>
  );
}
