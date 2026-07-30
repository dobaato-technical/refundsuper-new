import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";

// Only English is enabled today. To add a new language:
//   1. Create /app/frontend/src/i18n/locales/<lang>.json
//   2. Import + register it in the `resources` map below
//   3. Add its code to SUPPORTED_LANGS
export const SUPPORTED_LANGS = [
  { code: "en", label: "EN", name: "English" },
  // { code: "de", label: "DE", name: "Deutsch" },
  // { code: "fr", label: "FR", name: "Français" },
  // { code: "ja", label: "JA", name: "日本語" },
  // { code: "ko", label: "KO", name: "한국어" },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    lng: "en",
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGS.map((l) => l.code),
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "ab_lang",
    },
    initImmediate: false,
  });

export default i18n;
