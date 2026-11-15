import { isWebUrl } from './is-web-url';

describe('isWebUrl', () => {
  it.each(['https://example.com/a', 'http://example.com'])(
    '[TC-05-06] accepts %s',
    (url) => {
      expect(isWebUrl(url)).toBe(true);
    },
  );

  it.each([
    'javascript:alert(1)',
    'data:text/html,<p>x</p>',
    'ftp://example.com',
    '/relative/path',
    'not a url',
    '',
  ])('[TC-05-06] rejects %s', (url) => {
    expect(isWebUrl(url)).toBe(false);
  });
});
