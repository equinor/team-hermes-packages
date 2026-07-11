import path from 'node:path'
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-mcp',
    '@storybook/addon-themes',
  ],
  framework: '@storybook/react-vite',
  viteFinal: async (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string>),
      '@': path.resolve(import.meta.dirname, '../src'),
    }

    // Workaround for Rolldown bug: strictExecutionOrder (set by Storybook's
    // code-generator-plugin) combined with sideEffects:false causes reselect's
    // module body to be eliminated while its exports are still referenced.
    // Use enforce:'post' to override after Storybook's plugin runs.
    config.plugins = [
      ...(config.plugins || []),
      {
        name: 'fix-strict-execution-order',
        enforce: 'post' as const,
        config() {
          return {
            build: {
              rolldownOptions: {
                output: {
                  strictExecutionOrder: false,
                },
              },
            },
          }
        },
      },
    ]

    return config
  },
}
export default config
