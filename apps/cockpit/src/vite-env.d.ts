/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PORTARIUM_API_BASE_URL?: string;
  readonly VITE_PORTARIUM_ENABLE_MSW?: string;
  readonly VITE_PORTARIUM_MOCK_DATASET?: string;
  readonly VITE_PORTARIUM_ENABLE_ROBOTICS_DEMO?: string;
  readonly VITE_PORTARIUM_SHOW_INTERNAL_COCKPIT?: string;
  readonly VITE_PORTARIUM_SHOW_ADVANCED_TRIAGE?: string;
  readonly VITE_PORTARIUM_ENABLE_LIVE_OFFLINE_CACHE?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_COCKPIT_LOCAL_EXTENSION_ALLOW_DIRS?: string;
  readonly VITE_COCKPIT_LOCAL_EXTENSION_ALIASES?: string;
  readonly VITE_COCKPIT_ENABLE_LOCAL_EXTENSIONS?: string;
  readonly VITE_COCKPIT_ENABLE_LOCAL_EXTENSIONS_IN_TESTS?: string;
  readonly VITE_COCKPIT_SHELL_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
