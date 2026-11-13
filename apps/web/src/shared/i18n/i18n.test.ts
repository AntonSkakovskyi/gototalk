import { MISTAKE_CATEGORY_CODES } from '@gototalk/shared';
import i18n from './index';
import uk from './uk.json';

describe('i18n', () => {
  it('[TC-00-04] default language is Ukrainian', () => {
    expect(i18n.language).toBe('uk');
    expect(i18n.t('app.title')).toBe(uk.app.title);
    expect(i18n.t('nav.session')).toBe('Сесія');
  });

  it.each(MISTAKE_CATEGORY_CODES)(
    '[TC-02-05] has a Ukrainian name for the mistake category %s',
    (code) => {
      expect(i18n.exists(`mistakeCategories.${code}`)).toBe(true);
      expect(i18n.t(`mistakeCategories.${code}`)).not.toBe('');
    },
  );

  it('[TC-02-05] declares the Ukrainian plural forms of the pattern frequency', () => {
    const forms = { 1: '1 раз', 3: '3 рази', 7: '7 разів', 21: '21 раз' };

    for (const [count, expected] of Object.entries(forms)) {
      expect(
        i18n.t('profile.learnerModel.weakAreas.times', {
          count: Number(count),
        }),
      ).toBe(expected);
    }
  });
});
