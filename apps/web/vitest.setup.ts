import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { resetSessionStore } from './src/auth/session-store.js';

// jsdom lacks browser APIs that Mantine needs.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverMock;

window.HTMLElement.prototype.scrollIntoView = () => {};

afterEach(() => {
  resetSessionStore();
});
