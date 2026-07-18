import en from '../locales/en.js';
import ru from '../locales/ru.js';

const locales = { en, ru };
let currentLang = 'en';

export function setLanguage(lang) {
  if (locales[lang]) {
    currentLang = lang;
  } else {
    console.warn(`Language "${lang}" not available, keeping "${currentLang}"`);
  }
}

export function t(key, params = {}) {
  const keys = key.split('.');
  let value = locales[currentLang];
  for (const k of keys) {
    if (value && value[k] !== undefined) {
      value = value[k];
    } else {
      // Если перевода нет, пытаемся использовать английский как fallback
      let fallbackValue = locales['en'];
      for (const fk of keys) {
        if (fallbackValue && fallbackValue[fk] !== undefined) {
          fallbackValue = fallbackValue[fk];
        } else {
          fallbackValue = key; // ключ не найден нигде
          break;
        }
      }
      if (typeof fallbackValue === 'string') {
        value = fallbackValue;
      } else {
        // Если даже английский не дал строку, возвращаем сам ключ (для разработки)
        value = key;
      }
      break;
    }
  }
  if (typeof value === 'string') {
    return value.replace(/\{(\w+)\}/g, (_, p) =>
      params[p] !== undefined ? params[p] : `{${p}}`
    );
  }
  return value;
}

export function getCurrentLanguage() {
  return currentLang;
}