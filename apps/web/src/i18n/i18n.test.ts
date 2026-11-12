import i18n from './index.js';
import uk from './uk.json';

describe('i18n', () => {
  it('[TC-00-04] мова за замовчуванням українська', () => {
    expect(i18n.language).toBe('uk');
    expect(i18n.t('app.title')).toBe(uk.app.title);
    expect(i18n.t('nav.session')).toBe('Сесія');
  });
});
