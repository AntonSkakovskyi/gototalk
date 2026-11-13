import i18n from './index';
import uk from './uk.json';

describe('i18n', () => {
  it('[TC-00-04] default language is Ukrainian', () => {
    expect(i18n.language).toBe('uk');
    expect(i18n.t('app.title')).toBe(uk.app.title);
    expect(i18n.t('nav.session')).toBe('Сесія');
  });
});
