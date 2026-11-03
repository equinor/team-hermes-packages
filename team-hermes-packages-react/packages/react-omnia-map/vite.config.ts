import { defineConfig } from 'vite-plus'

export default defineConfig({
  test: {
    passWithNoTests: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
  pack: {
    // The declaration bundler drops triple-slash references, and OmniaMapProps needs the ArcGIS JSX types.
    banner: { dts: '/// <reference types="@arcgis/map-components/types/react" />' },
    exports: true,
  },
})
