import { pageQueryString } from './page-query';

describe('pageQueryString', () => {
  it('returns an empty string without cursor and limit', () => {
    expect(pageQueryString({})).toBe('');
  });

  it('ignores explicitly undefined values', () => {
    expect(pageQueryString({ cursor: undefined, limit: undefined })).toBe('');
  });

  it('adds only the cursor', () => {
    expect(pageQueryString({ cursor: 'abc' })).toBe('?cursor=abc');
  });

  it('adds only the limit', () => {
    expect(pageQueryString({ limit: 3 })).toBe('?limit=3');
  });

  it('puts the cursor before the limit', () => {
    expect(pageQueryString({ limit: 5, cursor: 'abc' })).toBe(
      '?cursor=abc&limit=5',
    );
  });

  it('url-encodes the cursor', () => {
    expect(pageQueryString({ cursor: 'a+b=&c', limit: 5 })).toBe(
      '?cursor=a%2Bb%3D%26c&limit=5',
    );
  });
});
