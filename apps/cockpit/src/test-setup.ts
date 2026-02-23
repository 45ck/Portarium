/**
 * Global test setup for cockpit vitest runs.
 *
 * Node.js v22+ exposes a built-in `localStorage` global that requires
 * `--localstorage-file` to be functional. Vitest imports test modules
 * inside the Node.js module evaluator, so any module-level `localStorage`
 * access (e.g. Zustand store init) hits the Node.js stub instead of
 * jsdom's implementation and throws `TypeError: localStorage.getItem is
 * not a function`.
 *
 * This setup file runs in the main Node.js process before any test module
 * is imported. It replaces the non-functional Node.js localStorage stub
 * with an in-memory implementation so that module-level init code works
 * in all test environments (node + jsdom).
 */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

// Only patch if localStorage doesn't have a working getItem (Node.js built-in stub)
try {
  localStorage.getItem('__probe__');
} catch {
  // @ts-ignore — global reassignment intentional for test environment
  globalThis.localStorage = createMemoryStorage();
}
