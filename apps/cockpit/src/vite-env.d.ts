/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PORTARIUM_API_BASE_URL?: string;
  readonly VITE_PORTARIUM_API_BEARER_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
