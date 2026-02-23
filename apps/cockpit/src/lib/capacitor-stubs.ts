/**
 * Web stubs for Capacitor plugins — used in dev and test environments
 * where native plugins are not available.
 *
 * native-bridge.ts guards all Capacitor calls behind isNative() so these
 * no-ops are never invoked at runtime; they exist solely so Vite's import
 * analysis does not throw when resolving dynamic `import('@capacitor/...')`.
 */
export const Preferences = {
  get: async () => ({ value: null }),
  set: async () => {},
  remove: async () => {},
  clear: async () => {},
};

export const App = {
  getInfo: async () => ({ name: '', id: '', build: '', version: '' }),
  addListener: () => ({ remove: () => {} }),
};

export const Clipboard = {
  write: async () => {},
  read: async () => ({ type: '', value: '' }),
};

export const Haptics = {
  impact: async () => {},
  notification: async () => {},
  vibrate: async () => {},
  selectionStart: async () => {},
  selectionChanged: async () => {},
  selectionEnd: async () => {},
};

export const Share = {
  share: async () => ({ activityType: undefined }),
  canShare: async () => ({ value: false }),
};

export const Browser = {
  open: async () => {},
  close: async () => {},
  addListener: () => ({ remove: () => {} }),
};

export const StatusBar = {
  setStyle: async () => {},
  setBackgroundColor: async () => {},
  getInfo: async () => ({ visible: true, style: 'DEFAULT', color: '' }),
  hide: async () => {},
  show: async () => {},
};

export const ImpactStyle = { Heavy: 'HEAVY', Medium: 'MEDIUM', Light: 'LIGHT' };
export const Style = { Dark: 'DARK', Light: 'LIGHT', Default: 'DEFAULT' };
