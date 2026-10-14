import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vite-plus/test'
import { GroupedFacetPicker, type FacetPickerGroup } from './GroupedFacetPicker'

const groups: FacetPickerGroup[] = [
  {
    value: 'Site',
    items: [
      { key: 'well', kind: 'term', count: 1200 },
      { key: 'depth', kind: 'range' },
    ],
  },
  { value: 'Measurements', items: [{ key: 'numeric_measurements.porosity', kind: 'range' }] },
]

const open = () => fireEvent.click(screen.getByText('Add Filter'))

describe('GroupedFacetPicker', () => {
  test('renders nothing without groups', () => {
    const { container } = render(<GroupedFacetPicker groups={[]} onSubmit={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('lists items by key and group headings after opening', () => {
    render(<GroupedFacetPicker groups={groups} onSubmit={vi.fn()} />)
    open()
    expect(screen.getByText('Site')).toBeInTheDocument()
    expect(screen.getByText('well')).toBeInTheDocument()
    expect(screen.getByText('numeric_measurements.porosity')).toBeInTheDocument()
  })

  test('uses parseItemLabel for labels', () => {
    render(
      <GroupedFacetPicker
        groups={groups}
        onSubmit={vi.fn()}
        parseItemLabel={(i) => i.key.replace('numeric_measurements.', '')}
      />
    )
    open()
    expect(screen.getByText('porosity')).toBeInTheDocument()
    expect(screen.queryByText('numeric_measurements.porosity')).not.toBeInTheDocument()
  })

  test('submits a clicked item immediately', () => {
    const onSubmit = vi.fn()
    render(<GroupedFacetPicker groups={groups} onSubmit={onSubmit} />)
    open()
    fireEvent.click(screen.getByText('depth'))
    expect(onSubmit).toHaveBeenCalledWith([groups[0].items[1]])
  })

  test('submits several items in multi-select mode', () => {
    const onSubmit = vi.fn()
    render(<GroupedFacetPicker groups={groups} onSubmit={onSubmit} />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Select multiple' }))
    fireEvent.click(screen.getByText('well'))
    fireEvent.click(screen.getByText('depth'))
    fireEvent.click(screen.getByRole('button', { name: 'Add filters' }))
    expect(onSubmit).toHaveBeenCalledWith([groups[0].items[0], groups[0].items[1]])
  })
})
