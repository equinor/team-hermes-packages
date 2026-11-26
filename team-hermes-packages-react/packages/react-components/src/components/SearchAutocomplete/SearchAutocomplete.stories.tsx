import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import { fn } from 'storybook/test'

import { SearchAutocomplete, type SearchAutocompleteGroup } from '@/components/SearchAutocomplete/SearchAutocomplete'

const suggestions: SearchAutocompleteGroup[] = [
  {
    id: 'places',
    label: 'Places',
    items: [
      { id: 'north-sea', label: 'North Sea', metadata: '12 results' },
      { id: 'norwegian-sea', label: 'Norwegian Sea', metadata: '8 results' },
    ],
  },
  { id: 'recent', label: 'Recent searches', items: [{ id: 'example', label: 'Example search' }] },
]

const meta: Meta<typeof SearchAutocomplete> = {
  title: 'Search/SearchAutocomplete',
  component: SearchAutocomplete,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-96 max-w-full">
        <Story />
      </div>
    ),
  ],
  args: { value: '', groups: suggestions, onValueChange: fn(), onSelect: fn(), onSearch: fn() },
  argTypes: {
    value: { description: 'Current input text.', control: false },
    groups: { description: 'Grouped suggestions to display. Not filtered by the component.', control: 'object' },
    onValueChange: { description: 'Called with the new text when the input changes or is cleared.', control: false },
    onSearch: { description: 'Called with the trimmed query when Enter is pressed without a highlighted suggestion.' },
    onSelect: { description: 'Called with the item and its group when a suggestion is chosen.' },
    isLoading: {
      description: 'Shows and announces a loading message in the popup.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    error: { description: 'Error message shown and announced in the popup.', control: 'text' },
    label: { description: 'Accessible label for the input.', control: 'text' },
    placeholder: { description: 'Placeholder text for the input.', control: 'text' },
    messages: { description: 'Overrides for built-in text, including key names and hints.', control: 'object' },
  },
}

export default meta
type Story = StoryObj<typeof meta>

const render: Story['render'] = ({ value: initialValue, onValueChange, ...args }) => {
  const [value, setValue] = useState(initialValue)
  return (
    <SearchAutocomplete
      {...args}
      value={value}
      onValueChange={(next) => {
        setValue(next)
        onValueChange(next)
      }}
    />
  )
}

export const Default: Story = { render }

function InteractiveExample() {
  const [value, setValue] = useState('')
  const [result, setResult] = useState('Nothing selected or searched yet.')
  const [status, setStatus] = useState<'ready' | 'loading' | 'error'>('ready')

  useEffect(() => {
    if (status !== 'loading') return
    const timer = setTimeout(() => setStatus('ready'), 1200)
    return () => clearTimeout(timer)
  }, [status])

  return (
    <div className="space-y-4">
      <SearchAutocomplete
        value={value}
        onValueChange={setValue}
        groups={status === 'ready' ? suggestions : []}
        isLoading={status === 'loading'}
        error={status === 'error' ? 'Suggestions could not be loaded.' : undefined}
        onSelect={(item, group) => setResult(`Selected ${item.label} from ${group.label}`)}
        onSearch={(query) => setResult(`Searched for ${query}`)}
      />
      <p>{result}</p>
      <div className="flex gap-4">
        <button type="button" onClick={() => setStatus('loading')}>
          Simulate loading
        </button>
        <button type="button" onClick={() => setStatus('error')}>
          Simulate error
        </button>
        <button type="button" onClick={() => setStatus('ready')}>
          Show suggestions
        </button>
      </div>
    </div>
  )
}

export const Interactive: Story = { render: () => <InteractiveExample /> }

export const WithQuery: Story = {
  render,
  args: { value: 'sea' },
  parameters: { docs: { description: { story: 'Matching text in suggestions is highlighted.' } } },
}

export const Loading: Story = {
  render,
  args: { groups: [], isLoading: true },
}

export const LoadingWithSuggestions: Story = {
  render,
  args: { isLoading: true },
  parameters: {
    docs: { description: { story: 'Existing suggestions remain selectable while new ones are loading.' } },
  },
}

export const WithError: Story = {
  render,
  args: { groups: [], error: 'Suggestions could not be loaded.' },
}

export const Empty: Story = {
  render,
  args: { groups: [] },
  parameters: { docs: { description: { story: 'Shows the empty message when there are no suggestions.' } } },
}

export const Localized: Story = {
  render,
  args: {
    label: 'Søk',
    placeholder: 'Søk...',
    messages: {
      clearSearch: 'Tøm søk',
      loading: 'Laster forslag...',
      empty: 'Ingen forslag.',
      navigate: 'naviger',
      select: 'velg',
      close: 'lukk',
      searchHint: (query) => `Søk etter «${query}»`,
    },
  },
}

function RecentSearchesExample() {
  const [value, setValue] = useState('')
  const [recent, setRecent] = useState<string[]>(['North Sea', 'Norwegian Sea'])
  const [result, setResult] = useState('')

  const search = (query: string) => {
    setRecent((previous) => [query, ...previous.filter((entry) => entry !== query)].slice(0, 5))
    setResult(`Searched for ${query}`)
  }

  return (
    <div className="space-y-4">
      <SearchAutocomplete
        value={value}
        onValueChange={setValue}
        groups={[
          { id: 'recent', label: 'Recent searches', items: recent.map((query) => ({ id: query, label: query })) },
        ]}
        onSearch={search}
        onSelect={(item) => search(item.label)}
      />
      <p>{result}</p>
    </div>
  )
}

export const RecentSearches: Story = {
  render: () => <RecentSearchesExample />,
  parameters: {
    docs: { description: { story: 'Recent searches are kept in consumer state and rendered as an ordinary group.' } },
  },
}
