import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  buildCockpitContentSecurityPolicy,
  normalizeCockpitCspConnectMode,
  replaceCockpitContentSecurityPolicy,
  type CockpitCspConnectMode,
} from './src/lib/cockpit-csp';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const capacitorStub = resolve(__dirname, 'src/lib/capacitor-stubs.ts');
const cockpitExtensionSdkSource = resolve(
  __dirname,
  '../../packages/cockpit-extension-sdk/src/index.ts',
);

function cockpitContentSecurityPolicyPlugin(
  apiBaseUrl: string | undefined,
  connectMode: CockpitCspConnectMode,
): Plugin {
  return {
    name: 'cockpit-content-security-policy',
    transformIndexHtml(html) {
      return replaceCockpitContentSecurityPolicy(
        html,
        buildCockpitContentSecurityPolicy({ apiBaseUrl, connectMode }),
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, __dirname, '') };
  const apiBaseUrl = env['VITE_PORTARIUM_API_BASE_URL']?.trim();
  const localExtensionAllowDirs = parseDelimitedPaths(
    env['VITE_COCKPIT_LOCAL_EXTENSION_ALLOW_DIRS'],
  );
  const localExtensionAliases = parseLocalExtensionAliases(
    env['VITE_COCKPIT_LOCAL_EXTENSION_ALIASES'],
  );
  const cspConnectMode = normalizeCockpitCspConnectMode(env['VITE_PORTARIUM_CSP_CONNECT_MODE']);

  return {
    plugins: [
      cockpitContentSecurityPolicyPlugin(apiBaseUrl, cspConnectMode),
      react(),
      tailwindcss(),
    ],
    server:
      apiBaseUrl || localExtensionAllowDirs.length > 0
        ? {
            ...(apiBaseUrl
              ? {
                  proxy: {
                    '/auth': { target: apiBaseUrl, changeOrigin: true },
                    '/v1': { target: apiBaseUrl, changeOrigin: true },
                  },
                }
              : {}),
            ...(localExtensionAllowDirs.length > 0
              ? { fs: { allow: [__dirname, ...localExtensionAllowDirs] } }
              : {}),
          }
        : undefined,
    resolve: {
      // Prefer TypeScript source files over pre-compiled .js artefacts that may
      // exist alongside .ts/.tsx files in src/.  Default Vite order puts .js
      // before .ts which would cause the old compiled stubs to shadow the source.
      extensions: ['.mts', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
      // Deduplicate React across junction-linked node_modules in worktrees to
      // prevent "multiple copies of React" errors (invalid hook call).
      dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
      alias: {
        '@': resolve(__dirname, 'src'),
        '@portarium/cockpit-extension-sdk': cockpitExtensionSdkSource,
        '@portarium/cockpit-types': resolve(
          __dirname,
          '../../src/presentation/ops-cockpit/types.ts',
        ),
        '@capacitor/app': capacitorStub,
        '@capacitor/browser': capacitorStub,
        '@capacitor/clipboard': capacitorStub,
        '@capacitor/haptics': capacitorStub,
        '@capacitor/preferences': capacitorStub,
        '@capacitor/push-notifications': capacitorStub,
        '@capacitor/share': capacitorStub,
        '@capacitor/status-bar': capacitorStub,
        ...localExtensionAliases,
      },
    },
  };
});

function parseDelimitedPaths(value: string | undefined): string[] {
  return (value ?? '')
    .split(/[;,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => resolve(entry));
}

function parseLocalExtensionAliases(value: string | undefined): Record<string, string> {
  return Object.fromEntries(
    (value ?? '')
      .split(/[;,\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf('=');
        if (separatorIndex <= 0) return null;
        const specifier = entry.slice(0, separatorIndex).trim();
        const target = entry.slice(separatorIndex + 1).trim();
        return specifier && target ? ([specifier, resolve(target)] as const) : null;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry)),
  );
}
