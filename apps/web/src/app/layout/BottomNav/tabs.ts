export const TABS = [
  { path: '/', key: 'session', activePaths: ['/', '/sessions/*'] },
  { path: '/words', key: 'words', activePaths: ['/words'] },
  { path: '/history', key: 'history', activePaths: ['/history'] },
  { path: '/profile', key: 'profile', activePaths: ['/profile'] },
] as const;
