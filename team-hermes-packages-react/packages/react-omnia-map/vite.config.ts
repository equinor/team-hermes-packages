import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  plugins: [tailwindcss()],
  test: {
    passWithNoTests: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
    tsconfigPaths: true,
  },
  pack: {
    // The declaration bundler drops triple-slash references, and OmniaMapProps needs the ArcGIS JSX types.
    banner: { dts: '/// <reference types="@arcgis/map-components/types/react" />' },
    exports: true,
  },
})
