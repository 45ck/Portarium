import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const capacitorStub = resolve(__dirname, 'src/lib/capacitor-stubs.ts');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/lib/**/*.test.ts'],
    reporters: ['default'],
  },
  resolve: {
    extensions: ['.mts', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
    alias: {
      '@': resolve(__dirname, 'src'),
      '@portarium/cockpit-types': resolve(__dirname, '../../src/presentation/ops-cockpit/types.ts'),
      '@capacitor/app': capacitorStub,
      '@capacitor/browser': capacitorStub,
      '@capacitor/clipboard': capacitorStub,
      '@capacitor/haptics': capacitorStub,
      '@capacitor/preferences': capacitorStub,
      '@capacitor/push-notifications': capacitorStub,
      '@capacitor/share': capacitorStub,
      '@capacitor/status-bar': capacitorStub,
    },
  },
});
