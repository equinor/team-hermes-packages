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
    alias: [{ find: '@', replacement: path.resolve(import.meta.dirname, './src') }],
    tsconfigPaths: true,
  },
  pack: {
    dts: {
      tsgo: true,
    },
    exports: true,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'typescript/no-base-to-string': 'off',
    },
  },
  fmt: {
    useTabs: false,
    tabWidth: 2,
    singleQuote: true,
    trailingComma: 'es5',
    printWidth: 119,
    semi: false,
  },
})
