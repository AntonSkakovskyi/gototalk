const WEB_PROTOCOLS = new Set(['http:', 'https:']);

export function isWebUrl(value: string): boolean {
  return URL.canParse(value) && WEB_PROTOCOLS.has(new URL(value).protocol);
}
