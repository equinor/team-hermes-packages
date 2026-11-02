import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
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
    dts: {
      tsgo: true,
    },
    exports: true,
  },
})
