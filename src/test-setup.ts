/**
 * Vitest global setup — polyfills for Node 18 compatibility.
 *
 * Node 20+ exposes `crypto` as a global; Node 18 requires an explicit import.
 * This file runs before every test file so the global is always available.
 */
import { webcrypto } from 'node:crypto';

if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
