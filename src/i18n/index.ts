import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import messages from './local/index';

// The browser language detector touches `document`, so it is only wired up on
// the client. On the server we fall back to the default language.
const instance = typeof document === 'undefined' ? i18n : i18n.use(LanguageDetector);

instance
  .use(initReactI18next)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    debug: false,
    resources: messages,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
