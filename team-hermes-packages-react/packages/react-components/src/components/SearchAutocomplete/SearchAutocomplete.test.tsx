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
}: {
  onSelect?: SearchAutocompleteProps['onSelect']
  onSearch?: SearchAutocompleteProps['onSearch']
  initialValue?: string
  resultGroups?: SearchAutocompleteGroup[]
  isLoading?: boolean
  error?: string
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
    />
  )
}

describe('SearchAutocomplete', () => {
  test('shows consumer-provided groups without filtering and highlights matching text', async () => {
    const user = userEvent.setup()
    render(<Harness initialValue="sea" />)
    await user.click(screen.getByRole('combobox', { name: 'Search' }))
    expect(screen.getByText('Places')).toBeInTheDocument()
    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Other' })).toBeInTheDocument()
    expect(within(screen.getByRole('option', { name: /North Sea/ })).getByText('Sea').tagName).toBe('MARK')
    expect(screen.getByText('12 results')).toBeInTheDocument()
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
    rerender(<Harness resultGroups={[]} error="Could not load suggestions" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load suggestions')
    rerender(<Harness resultGroups={[]} />)
    expect(screen.getByRole('status')).toHaveTextContent('No suggestions')
  })
})
