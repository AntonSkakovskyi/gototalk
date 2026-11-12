import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import uk from './uk.json';

// Єдиний екземпляр i18next: інтерфейс лише українською, тексти в uk.json.
void i18n.use(initReactI18next).init({
  resources: { uk: { translation: uk } },
  lng: 'uk',
  fallbackLng: 'uk',
  interpolation: { escapeValue: false },
});

export default i18n;
