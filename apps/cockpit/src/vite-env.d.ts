/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PORTARIUM_API_BASE_URL?: string;
  readonly VITE_PORTARIUM_API_BEARER_TOKEN?: string;
  readonly VITE_PORTARIUM_ENABLE_MSW?: string;
  readonly VITE_PORTARIUM_MOCK_DATASET?: string;
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
