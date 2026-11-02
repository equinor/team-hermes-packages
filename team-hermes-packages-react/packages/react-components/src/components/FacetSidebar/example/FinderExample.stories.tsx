import type { Meta, StoryObj } from '@storybook/react-vite'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { FinderExample } from './FinderExample'

const meta: Meta<typeof FinderExample> = {
  title: 'Facet/Examples/Finder page',
  component: FinderExample,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A complete finder page against an in-memory mock API: three views sharing one sidebar, URL-backed filters, a search request per view and a separate catalog request for the picker. See `example/FinderExample.tsx` and `example/mockApi.ts`.',
      },
    },
  },
  decorators: [
    (Story) => (
      <NuqsTestingAdapter hasMemory>
        <Story />
      </NuqsTestingAdapter>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
