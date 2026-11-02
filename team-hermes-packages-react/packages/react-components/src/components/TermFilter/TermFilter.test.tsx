import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vite-plus/test'
import { TermFilter } from './TermFilter'

const many = Array.from({ length: 12 }, (_, i) => ({ value: `Term ${i + 1}`, count: i + 1 }))

describe('TermFilter', () => {
  test('renders options with counts and no search for few terms', () => {
    render(<TermFilter label="Type" buckets={many.slice(0, 3)} selectedValues={[]} onToggle={vi.fn()} />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText(/Show .* more/)).not.toBeInTheDocument()
  })

  test('marks selected values as checked and calls onToggle', () => {
    const onToggle = vi.fn()
    render(<TermFilter label="Type" buckets={many.slice(0, 3)} selectedValues={['Term 2']} onToggle={onToggle} />)
    expect(screen.getByLabelText(/Term 2/)).toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: /^Term 1\s*1$/ }))
    expect(onToggle).toHaveBeenCalledWith('Term 1')
  })

  test('limits to 8 terms and toggles show more / less', () => {
    render(<TermFilter label="Type" buckets={many} selectedValues={[]} onToggle={vi.fn()} />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: 'Show 4 more' }))
    expect(screen.getAllByRole('checkbox')).toHaveLength(12)
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }))
    expect(screen.getAllByRole('checkbox')).toHaveLength(8)
  })

  test('search filters across all terms and lists selected first', () => {
    render(<TermFilter label="Type" buckets={many} selectedValues={['Term 12']} onToggle={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Search Type' }), { target: { value: 'term 1' } })
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(4) // Term 1, 10, 11, 12
    expect(boxes[0]).toBeChecked()
    expect(screen.queryByRole('button', { name: /Show/ })).not.toBeInTheDocument()
  })

  test('shows an empty message when nothing matches', () => {
    render(<TermFilter label="Type" buckets={many} selectedValues={[]} onToggle={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zzz' } })
    expect(screen.getByText('No matches for "zzz"')).toBeInTheDocument()
  })
})
