// Вкладки нижньої навігації; ключі – у uk.json (nav.*).
export const TABS = [
  { path: '/', key: 'session' },
  { path: '/words', key: 'words' },
  { path: '/history', key: 'history' },
  { path: '/profile', key: 'profile' },
] as const;
