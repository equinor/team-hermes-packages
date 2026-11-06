import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite-plus'

// Workspace root: Storybook reads this file, and `vp check` here lints and formats every package.
export default defineConfig({
  plugins: [tailwindcss()],
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'typescript/no-base-to-string': 'off',
    },
    overrides: [
      {
        files: ['packages/*/src/**/*.{ts,tsx}'],
        rules: {
          'no-restricted-imports': [
            'error',
            {
              patterns: [
                {
                  group: ['.', '..', './**', '../**'],
                  message: 'Use the @/ alias instead of relative imports.',
                },
              ],
            },
          ],
        },
      },
    ],
  },
  fmt: {
    ignorePatterns: ['**/CHANGELOG.md'],
    useTabs: false,
    tabWidth: 2,
    singleQuote: true,
    trailingComma: 'es5',
    printWidth: 119,
    semi: false,
    sortImports: true,
  },
})
