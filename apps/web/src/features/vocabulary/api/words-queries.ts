export const wordKeys = {
  all: ['words'] as const,
  list: () => [...wordKeys.all, 'list'] as const,
};
