import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import { fn } from 'storybook/test'

import { SearchAutocomplete, type SearchAutocompleteGroup } from '@/components/SearchAutocomplete/SearchAutocomplete'

const suggestions: SearchAutocompleteGroup[] = [
  { id: 'places', label: 'Places', items: [{ id: 'north-sea', label: 'North Sea', metadata: '12 results' }] },
  { id: 'recent', label: 'Recent searches', items: [{ id: 'example', label: 'Example search' }] },
]

const meta: Meta<typeof SearchAutocomplete> = {
  title: 'Search/SearchAutocomplete',
  component: SearchAutocomplete,
  parameters: { layout: 'centered' },
  args: { value: '', groups: suggestions, onValueChange: fn(), onSelect: fn(), onSearch: fn() },
}

export default meta
type Story = StoryObj<typeof meta>

function Example() {
  const [value, setValue] = useState('')
  const [result, setResult] = useState('Nothing selected or searched yet.')
  const [status, setStatus] = useState<'ready' | 'loading' | 'error'>('ready')

  useEffect(() => {
    if (status !== 'loading') return
    const timer = setTimeout(() => setStatus('ready'), 1200)
    return () => clearTimeout(timer)
  }, [status])

  return (
    <div className="w-96 max-w-full space-y-4">
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

export const Controlled: Story = { render: () => <Example /> }
