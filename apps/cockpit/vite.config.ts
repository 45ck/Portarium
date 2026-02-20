import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Prefer TypeScript source files over pre-compiled .js artefacts that may
    // exist alongside .ts/.tsx files in src/.  Default Vite order puts .js
    // before .ts which would cause the old compiled stubs to shadow the source.
    extensions: ['.mts', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
    alias: {
      '@': resolve(__dirname, 'src'),
      '@portarium/cockpit-types': resolve(
        __dirname,
        '../../src/presentation/ops-cockpit/types.ts',
      ),
    },
  },
})
