"use client";
import "@/i18n";
import { useEffect, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { LANG_KEY, SUPPORTED_LANGS } from "@/i18n";

export default function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Apply stored language after hydration to avoid SSR/client mismatch
    const stored = localStorage.getItem(LANG_KEY);
    if (stored && (SUPPORTED_LANGS as readonly string[]).includes(stored) && stored !== i18n.language) {
      void i18n.changeLanguage(stored);
    }
    // Persist language changes to localStorage
    const handler = (lng: string) => localStorage.setItem(LANG_KEY, lng);
    i18n.on("languageChanged", handler);
    return () => { i18n.off("languageChanged", handler); };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
