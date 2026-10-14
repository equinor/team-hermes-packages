import { Accordion } from '@base-ui/react/accordion'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { Facet } from '../../shared/types/facet.types'
import { SidebarFacet } from './SidebarFacet'

function termFacet(key: string, value: string): Facet {
  return {
    key,
    kind: 'term',
    source: null,
    value_type: 'string',
    count: 2,
    aggregated: true,
    buckets: [{ value, count: 2 }],
  }
}

function Filters() {
  const [country, setCountry] = useState<string[]>(['Norway'])
  const [site, setSite] = useState<string[]>(['Well A'])
  return (
    <Accordion.Root multiple defaultValue={['country_identifier', 'site_identifier_source']}>
      <SidebarFacet
        facetKey="country_identifier"
        facet={termFacet('country_identifier', 'Norway')}
        selectedValues={country}
        onRangeChange={vi.fn()}
        onToggle={(value) => setCountry((previous) => (previous.includes(value) ? [] : [value]))}
      />
      <SidebarFacet
        facetKey="site_identifier_source"
        facet={termFacet('site_identifier_source', 'Well A')}
        selectedValues={site}
        onRangeChange={vi.fn()}
        onToggle={(value) => setSite((previous) => (previous.includes(value) ? [] : [value]))}
      />
    </Accordion.Root>
  )
}

describe('independent term filters', () => {
  it('renders field-name headers without grouping or mode switches', () => {
    render(<Filters />)
    expect(screen.getByRole('button', { name: /country_identifier/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /site_identifier_source/ })).toBeVisible()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.queryByText('Location')).not.toBeInTheDocument()
  })

  it('does not clear the site when the country is deselected', () => {
    render(<Filters />)
    fireEvent.click(screen.getByText('Norway'))
    expect(screen.getByRole('checkbox', { name: /Norway/ })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Well A/ })).toBeChecked()
    fireEvent.click(screen.getByText('Well A'))
    fireEvent.click(screen.getByText('Well A'))
    expect(screen.getByRole('checkbox', { name: /Well A/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Norway/ })).not.toBeChecked()
  })
})

describe('range facet metadata', () => {
  const facet: Extract<Facet, { kind: 'range' }> = {
    key: 'depth_md',
    kind: 'range',
    source: null,
    value_type: 'number',
    count: 0,
    aggregated: true,
    histogram: null,
  }

  it.each([null, { buckets: [] }])(
    'keeps an empty range facet removable without rendering a term filter (%j)',
    (histogram) => {
      const onRemove = vi.fn()
      render(
        <Accordion.Root multiple defaultValue={['depth_md']}>
          <SidebarFacet
            facetKey="depth_md"
            facet={{ ...facet, histogram }}
            range={{ from: 0 }}
            onRangeChange={vi.fn()}
            onToggle={vi.fn()}
            onRemove={onRemove}
          />
        </Accordion.Root>
      )
      expect(screen.getByText('No filters available')).toBeVisible()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /depth_md/, expanded: true })).toHaveTextContent('1')
      fireEvent.click(screen.getByRole('button', { name: /remove/i }))
      expect(onRemove).toHaveBeenCalledOnce()
    }
  )

  it.each(['number', 'date'] as const)('uses the API value_type for %s inputs', (valueType) => {
    const onRangeChange = vi.fn()
    const minimum = valueType === 'date' ? '2020-01-01' : 0
    const maximum = valueType === 'date' ? '2020-01-02' : 10
    render(
      <Accordion.Root multiple defaultValue={['depth_md']}>
        <SidebarFacet
          facetKey="depth_md"
          facet={{
            ...facet,
            value_type: valueType,
            histogram: {
              buckets: [
                { key: minimum, count: 1 },
                { key: maximum, count: 1 },
              ],
            },
          }}
          onRangeChange={onRangeChange}
          onToggle={vi.fn()}
        />
      </Accordion.Root>
    )
    const input = screen.getByLabelText('Minimum value')
    expect(input).toHaveAttribute('type', valueType)
    fireEvent.change(input, { target: { value: String(minimum) } })
    fireEvent.blur(input)
    expect(onRangeChange).toHaveBeenCalledWith({ attribute: 'depth_md', from: minimum, to: null })
  })

  it('shows a loading state while the enabled facet metadata is absent', () => {
    render(
      <Accordion.Root multiple defaultValue={['depth_md']}>
        <SidebarFacet facetKey="depth_md" isFetching onRangeChange={vi.fn()} onToggle={vi.fn()} />
      </Accordion.Root>
    )
    expect(screen.getByRole('progressbar')).toBeVisible()
    expect(screen.queryByText('No filters available')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
