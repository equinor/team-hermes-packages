import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vite-plus/test'
import { HistogramFilter } from './HistogramFilter'
import { createHistogramLabels, findMaxBucketIndex, findMinBucketIndex } from './HistogramFilter.utils'

const buckets = [
  { key: 0, count: 5 },
  { key: 10, count: 20 },
  { key: 20, count: 10 },
  { key: 30, count: 1 },
]

const baseProps = {
  facetKey: 'Depth',
  bucketType: 'number' as const,
  data: { buckets, min: 0, max: 30 },
  onRangeChange: vi.fn(),
}

describe('HistogramFilter', () => {
  test('renders nothing without buckets', () => {
    const { container } = render(<HistogramFilter {...baseProps} data={{ buckets: [] }} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('renders a bar per bucket and axis labels with unit', () => {
    render(<HistogramFilter {...baseProps} unit="m" />)
    expect(screen.getByTestId('histogram-bars').children).toHaveLength(4)
    expect(screen.getByText('30 m')).toBeInTheDocument()
  })

  test('shows the mean when provided', () => {
    render(<HistogramFilter {...baseProps} unit="m" data={{ ...baseProps.data, mean: 12.5 }} />)
    expect(screen.getByText(/Mean: 12.50 m/)).toBeInTheDocument()
  })

  test('highlights only buckets within the selected range', () => {
    render(<HistogramFilter {...baseProps} range={{ from: 10, to: 20 }} />)
    const selected = Array.from(screen.getByTestId('histogram-bars').children).map((c) =>
      c.getAttribute('data-selected')
    )
    expect(selected).toEqual(['false', 'true', 'true', 'false'])
  })

  test('shows range values in inputs and syncs when range prop changes', () => {
    const { rerender } = render(<HistogramFilter {...baseProps} range={{ from: 10, to: 20 }} />)
    expect(screen.getByLabelText('Minimum value')).toHaveValue(10)
    rerender(<HistogramFilter {...baseProps} range={{ from: 0, to: 30 }} />)
    expect(screen.getByLabelText('Maximum value')).toHaveValue(30)
  })

  test('commits a numeric range on input blur', () => {
    const onRangeChange = vi.fn()
    render(<HistogramFilter {...baseProps} onRangeChange={onRangeChange} />)
    const min = screen.getByLabelText('Minimum value')
    fireEvent.change(min, { target: { value: '12.5' } })
    fireEvent.blur(min)
    expect(onRangeChange).toHaveBeenCalledWith({ attribute: 'Depth', from: 12.5, to: null })
  })

  test('commits date bounds as strings', () => {
    const onRangeChange = vi.fn()
    render(
      <HistogramFilter
        facetKey="Date"
        bucketType="date"
        data={{
          buckets: [
            { key: '2000-01-01', count: 1 },
            { key: '2010-01-01', count: 2 },
          ],
        }}
        onRangeChange={onRangeChange}
      />
    )
    const max = screen.getByLabelText('Maximum value')
    fireEvent.change(max, { target: { value: '2005-06-01' } })
    fireEvent.blur(max)
    expect(onRangeChange).toHaveBeenCalledWith({ attribute: 'Date', from: null, to: '2005-06-01' })
  })

  test('adds a virtual bucket when max exceeds the last bucket key', () => {
    render(<HistogramFilter {...baseProps} data={{ buckets, min: 0, max: 45 }} />)
    expect(screen.getByLabelText('Maximum value')).toHaveAttribute('placeholder', 'Max (45.00)')
  })
})

describe('histogram utils', () => {
  test('createHistogramLabels returns first, middle and last labels', () => {
    expect(createHistogramLabels(buckets, 'number')).toEqual(['0', '20', '30'])
    expect(createHistogramLabels([{ key: 2000 }, { key: 2500 }], 'number')).toEqual(['2k', '2.5k'])
    expect(createHistogramLabels([{ key: '2018-01-01' }], 'date')).toEqual(['2018'])
    expect(createHistogramLabels([], 'number')).toEqual([])
  })

  test('findMinBucketIndex / findMaxBucketIndex map values to indices', () => {
    expect(findMinBucketIndex('11', buckets, 'number')).toBe(2)
    expect(findMinBucketIndex('99', buckets, 'number')).toBe(3)
    expect(findMinBucketIndex('abc', buckets, 'number')).toBe(0)
    expect(findMaxBucketIndex('19', buckets, 'number')).toBe(1)
    expect(findMaxBucketIndex('-5', buckets, 'number')).toBe(0)
    expect(findMaxBucketIndex('abc', buckets, 'number')).toBe(3)
  })

  test('date lookups use the year', () => {
    const dates = [{ key: '2000-01-01' }, { key: '2010-01-01' }]
    expect(findMinBucketIndex('2005-01-01', dates, 'date')).toBe(1)
    expect(findMaxBucketIndex('2005-01-01', dates, 'date')).toBe(0)
  })
})
