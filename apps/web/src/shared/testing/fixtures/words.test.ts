import { WordSchema } from '@gototalk/shared';
import { testWord } from './words';

describe('report fixtures', () => {
  it('[TC-05-03] testWord is a valid Word and takes overrides', () => {
    expect(WordSchema.parse(testWord())).toEqual(testWord());
    expect(testWord({ state: 'active' }).state).toBe('active');
  });
});
