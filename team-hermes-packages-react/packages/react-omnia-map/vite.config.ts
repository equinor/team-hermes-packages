import { defineConfig } from 'vite-plus'

export default defineConfig({
  test: {
    passWithNoTests: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
  pack: {
    exports: true,
  },
})
