import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vite-plus/test'

import {
  SearchAutocomplete,
  type SearchAutocompleteGroup,
  type SearchAutocompleteProps,
} from '@/components/SearchAutocomplete/SearchAutocomplete'

const groups: SearchAutocompleteGroup[] = [
  { id: 'places', label: 'Places', items: [{ id: '1', label: 'North Sea', metadata: '12 results' }] },
  { id: 'recent', label: 'Recent', items: [{ id: '2', label: 'Other' }] },
]

function Harness({
  onSelect = vi.fn(),
  onSearch = vi.fn(),
  initialValue = '',
  resultGroups = groups,
  isLoading = false,
  error,
  messages,
}: {
  onSelect?: SearchAutocompleteProps['onSelect']
  onSearch?: SearchAutocompleteProps['onSearch']
  initialValue?: string
  resultGroups?: SearchAutocompleteGroup[]
  isLoading?: boolean
  error?: string
  messages?: SearchAutocompleteProps['messages']
}) {
  const [value, setValue] = useState(initialValue)
  return (
    <SearchAutocomplete
      value={value}
      groups={resultGroups}
      onValueChange={setValue}
      onSelect={onSelect}
      onSearch={onSearch}
      isLoading={isLoading}
      error={error}
      messages={messages}
    />
  )
}

describe('SearchAutocomplete', () => {
  test('does not render a backdrop that can intercept input clicks', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('combobox', { name: 'Search' }))
    expect(document.querySelector('[class~="bg-black/20"]')).not.toBeInTheDocument()
  })

  test('reopens on a focused input click after Escape and keyboard selection', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.keyboard('{Escape}')
    expect(input).toHaveFocus()
    expect(input).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(input)
    expect(input).toHaveAttribute('aria-expanded', 'true')
    await user.click(input)
    expect(input).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onSelect).toHaveBeenCalledOnce()
    expect(input).toHaveFocus()
    expect(input).toHaveAttribute('aria-expanded', 'false')
    await user.click(input)
    expect(input).toHaveAttribute('aria-expanded', 'true')
  })

  test('shows consumer-provided groups without filtering and highlights matching text', async () => {
    const user = userEvent.setup()
    render(<Harness initialValue="sea" />)
    await user.click(screen.getByRole('combobox', { name: 'Search' }))
    expect(screen.getByText('Places')).toBeInTheDocument()
    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Other' })).toBeInTheDocument()
    const match = within(screen.getByRole('option', { name: /North Sea/ })).getByText('Sea')
    expect(match.tagName).toBe('MARK')
    expect(match).not.toHaveAttribute('class')
    expect(match).not.toHaveAttribute('style')
    expect(screen.getByText('12 results')).toBeInTheDocument()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: /North Sea/ })).toHaveClass('bg-surface-hover')
    expect(match).not.toHaveAttribute('class')
    expect(match).not.toHaveAttribute('style')
  })

  test('selects by click without changing the controlled input or submitting a search', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onSearch = vi.fn()
    render(<Harness initialValue="north" onSelect={onSelect} onSearch={onSearch} />)
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: /North Sea/ }))
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(groups[0].items[0], groups[0])
    expect(onSearch).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox')).toHaveValue('north')
  })

  test('navigates with arrows and selects with Enter, or submits trimmed free text', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onSearch = vi.fn()
    render(<Harness initialValue="  north  " onSelect={onSelect} onSearch={onSearch} />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(groups[0].items[0], groups[0])
    expect(onSearch).not.toHaveBeenCalled()
    await user.click(input)
    await user.keyboard('{Enter}')
    expect(onSearch).toHaveBeenCalledExactlyOnceWith('north')
    expect(input).toHaveValue('  north  ')
  })

  test.each([
    { isComposing: true, keyCode: 13, highlight: false },
    { isComposing: true, keyCode: 13, highlight: true },
    { isComposing: false, keyCode: 229, highlight: false },
    { isComposing: false, keyCode: 229, highlight: true },
  ])(
    'preserves IME Enter confirmation with isComposing=$isComposing, keyCode=$keyCode, highlight=$highlight',
    async ({ isComposing, keyCode, highlight }) => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      const onSearch = vi.fn()
      render(<Harness initialValue="query" onSelect={onSelect} onSearch={onSearch} />)
      const input = screen.getByRole('combobox')
      await user.click(input)
      if (highlight) await user.keyboard('{ArrowDown}')

      const nativeConfirmationAllowed = fireEvent.keyDown(input, { key: 'Enter', isComposing, keyCode })

      expect(onSelect).not.toHaveBeenCalled()
      expect(onSearch).not.toHaveBeenCalled()
      expect(nativeConfirmationAllowed).toBe(true)
      expect(input).toHaveAttribute('aria-expanded', 'true')
      expect(input).toHaveValue('query')

      await user.keyboard('{Enter}')
      if (highlight) {
        expect(onSelect).toHaveBeenCalledExactlyOnceWith(groups[0].items[0], groups[0])
        expect(onSearch).not.toHaveBeenCalled()
      } else {
        expect(onSearch).toHaveBeenCalledExactlyOnceWith('query')
        expect(onSelect).not.toHaveBeenCalled()
      }
    }
  )

  test('does not select a removed highlighted item when results change', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onSearch = vi.fn()
    const { rerender } = render(<Harness initialValue="query" onSelect={onSelect} onSearch={onSearch} />)
    await user.click(screen.getByRole('combobox'))
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-activedescendant')
    rerender(<Harness initialValue="query" onSelect={onSelect} onSearch={onSearch} resultGroups={[groups[1]]} />)
    expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-activedescendant')
    const replacement: SearchAutocompleteGroup = { id: 'more', label: 'More', items: [{ id: '3', label: 'Third' }] }
    rerender(<Harness initialValue="query" onSelect={onSelect} onSearch={onSearch} resultGroups={[replacement]} />)
    expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-activedescendant')
    expect(screen.getByRole('option', { name: 'Third' })).not.toHaveClass('bg-surface-hover')
    await user.keyboard('{Enter}')
    expect(onSelect).not.toHaveBeenCalled()
    expect(onSearch).toHaveBeenCalledExactlyOnceWith('query')
  })

  test('does not submit an enclosing form when searching or selecting', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    const onSearch = vi.fn()
    const onSelect = vi.fn()
    render(
      <form onSubmit={onSubmit}>
        <Harness initialValue="query" onSearch={onSearch} onSelect={onSelect} />
      </form>
    )
    await user.click(screen.getByRole('combobox'))
    await user.keyboard('{Enter}')
    await user.click(screen.getByRole('combobox'))
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onSearch).toHaveBeenCalledOnce()
    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('clears via onValueChange, closes on Escape, and does not submit blank text', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    render(<Harness initialValue="query" onSearch={onSearch} />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(input).toHaveValue('')
    await user.keyboard('{Enter}')
    expect(onSearch).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  test('shows loading, error and empty states', () => {
    const { rerender } = render(<Harness resultGroups={[]} isLoading />)
    fireEvent.focus(screen.getByRole('combobox'))
    expect(screen.getByRole('status')).toHaveTextContent('Loading suggestions')
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('combobox')).toHaveAccessibleDescription('Loading suggestions...')
    rerender(<Harness resultGroups={[]} error="Could not load suggestions" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load suggestions')
    expect(screen.getByRole('combobox')).toHaveAccessibleDescription('Could not load suggestions')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    rerender(<Harness resultGroups={[]} />)
    expect(screen.getByRole('status')).toHaveTextContent('No suggestions')
    expect(screen.getByRole('combobox')).toHaveAccessibleDescription('No suggestions.')
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
    expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-busy')
  })

  test('updates the live status when loading starts and finishes while the popup is open', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Harness />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    const status = screen.getByRole('status')
    expect(status).toBeEmptyDOMElement()

    rerender(<Harness resultGroups={[]} isLoading />)
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('status')).toBe(status)
    expect(status).toHaveTextContent('Loading suggestions...')
    expect(input).toHaveAccessibleDescription('Loading suggestions...')

    rerender(<Harness resultGroups={[]} />)
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('status')).toBe(status)
    expect(status).toHaveTextContent('No suggestions.')
    expect(input).toHaveAccessibleDescription('No suggestions.')
  })

  test('updates keyboard hints for the current action and localizes built-in text', async () => {
    const user = userEvent.setup()
    render(
      <Harness
        initialValue="  sea  "
        messages={{
          clearSearch: 'Clear translated',
          arrowKeys: 'Arrows translated',
          navigate: 'navigate translated',
          enterKey: 'Enter translated',
          select: 'select translated',
          search: 'search translated',
          searchHint: (query) => `${query}: search translated`,
          escapeKey: 'Escape translated',
          close: 'close translated',
        }}
      />
    )
    await user.click(screen.getByRole('combobox'))
    expect(screen.getByRole('button', { name: 'Clear translated' })).toBeInTheDocument()
    const arrows = screen.getByRole('img', { name: 'Arrows translated' })
    expect(within(arrows).getByText('↑').tagName).toBe('KBD')
    expect(within(arrows).getByText('↓').tagName).toBe('KBD')
    expect(screen.getByText('Escape translated').tagName).toBe('KBD')
    expect(screen.getByText('sea: search translated')).toBeInTheDocument()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByText('select translated')).toBeInTheDocument()
    expect(screen.queryByText('sea: search translated')).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Clear translated' })).toBeInTheDocument()
  })

  test('shows the trimmed query in the search hint only when there is a query', async () => {
    const user = userEvent.setup()
    render(<Harness messages={{ search: 'Find' }} />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    expect(screen.queryByText('Enter')).not.toBeInTheDocument()
    await user.type(input, ' Norway ')
    expect(screen.getByText('Find “Norway”')).toBeInTheDocument()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByText('select')).toBeInTheDocument()
    expect(screen.queryByText('Find “Norway”')).not.toBeInTheDocument()
  })

  test('constrains long search hints without truncating their accessible text', async () => {
    const user = userEvent.setup()
    const query = 'a'.repeat(200)
    render(<Harness initialValue={query} messages={{ searchHint: (value) => `${value} translated` }} />)
    await user.click(screen.getByRole('combobox'))
    const hint = screen.getByText(`${query} translated`)
    expect(hint).toHaveClass('min-w-0', 'truncate')
    expect(hint.parentElement).toHaveClass('max-w-full', 'min-w-0')
    expect(screen.getByText('Escape')).toBeInTheDocument()
  })

  test('announces translated loading and empty messages', () => {
    const messages = { loading: 'Loading translated', empty: 'Empty translated' }
    const { rerender } = render(<Harness resultGroups={[]} isLoading messages={messages} />)
    fireEvent.focus(screen.getByRole('combobox'))
    expect(screen.getByRole('status')).toHaveTextContent('Loading translated')
    rerender(<Harness resultGroups={[]} messages={messages} />)
    expect(screen.getByRole('status')).toHaveTextContent('Empty translated')
  })

  test('supports recent searches as a consumer-owned group', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    function RecentSearches() {
      const [value, setValue] = useState('')
      const [recent, setRecent] = useState<string[]>([])
      const search = (query: string) => {
        setRecent((previous) => [query, ...previous.filter((entry) => entry !== query)])
        onSearch(query)
      }
      return (
        <SearchAutocomplete
          value={value}
          onValueChange={setValue}
          groups={[
            { id: 'recent', label: 'Recent searches', items: recent.map((query) => ({ id: query, label: query })) },
          ]}
          onSearch={search}
          onSelect={(item) => search(item.label)}
        />
      )
    }

    render(<RecentSearches />)
    await user.type(screen.getByRole('combobox'), 'North Sea{Enter}')
    await user.click(screen.getByRole('combobox'))
    expect(screen.getByText('Recent searches')).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'North Sea' }))
    expect(onSearch).toHaveBeenCalledTimes(2)
    expect(onSearch).toHaveBeenLastCalledWith('North Sea')
  })
})
