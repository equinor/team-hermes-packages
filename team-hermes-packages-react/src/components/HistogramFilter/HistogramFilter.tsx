import { Slider } from '@base-ui/react/slider'
import { useEffect, useMemo, useState } from 'react'
import { formatNumberToLocale } from '../../shared/utils'
import type { HistogramFilterProps, HistogramRangeBounds } from './HistogramFilter.types'
import { createHistogramLabels, findMaxBucketIndex, findMinBucketIndex } from './HistogramFilter.utils'

function rangeToStrings(range: HistogramRangeBounds | undefined): [string, string] {
  if (!range) return ['', '']
  return [range.from != null ? String(range.from) : '', range.to != null ? String(range.to) : '']
}

const inputClass =
  'flex-1 min-w-0 px-2 py-1.5 text-xs border border-stroke-medium rounded bg-transparent outline-none focus:border-stroke-strong'

const thumbClass =
  'size-4 rounded-full bg-surface border-2 border-theme-accent-fg shadow cursor-grab data-dragging:cursor-grabbing hover:shadow-[0_0_0_4px_var(--color-theme-accent-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-accent-fg'

/**
 * Histogram with a dual-handle slider and min/max inputs for filtering on a numeric or date range.
 */
export function HistogramFilter({ facetKey, data, unit, bucketType, range, onRangeChange }: HistogramFilterProps) {
  const [valueMin, valueMax] = useMemo(() => rangeToStrings(range), [range])
  const [localMin, setLocalMin] = useState(valueMin)
  const [localMax, setLocalMax] = useState(valueMax)
  const { buckets } = data

  useEffect(() => setLocalMin(valueMin), [valueMin])
  useEffect(() => setLocalMax(valueMax), [valueMax])

  if (!buckets || buckets.length === 0) return null

  const applyRange = (min: string, max: string) => {
    const parse = (v: string) => (v ? (bucketType === 'number' ? Number.parseFloat(v) : v) : null)
    onRangeChange({ attribute: facetKey, from: parse(min), to: parse(max) })
  }

  const maxCount = Math.max(...buckets.map((b) => b.count), 1)
  const lastBucketKey = buckets[buckets.length - 1].key
  const actualMaxExceedsLastBucket =
    data.max != null &&
    (bucketType === 'number' ? Number(data.max) > Number(lastBucketKey) : String(data.max) > String(lastBucketKey)) // ISO date strings sort lexically

  // A virtual bucket lets the slider reach a max that lies beyond the last bucket start.
  const sliderBuckets = actualMaxExceedsLastBucket
    ? [...buckets, { key: data.max as number | string, count: 0 }]
    : buckets
  const sliderBucketsAmount = sliderBuckets.length

  const indexToValue = (idx: number): string => {
    const clamped = Math.max(0, Math.min(sliderBucketsAmount - 1, Math.round(idx)))
    const key = sliderBuckets[clamped].key
    return bucketType === 'number' ? String(Math.round(Number(key) * 100) / 100) : String(key)
  }

  const sliderValues: readonly [number, number] = [
    localMin ? findMinBucketIndex(localMin, sliderBuckets, bucketType) : 0,
    localMax ? findMaxBucketIndex(localMax, sliderBuckets, bucketType) : sliderBucketsAmount - 1,
  ]

  const formatBoundary = (value: number | string): string =>
    bucketType === 'number' ? formatNumberToLocale(Number(value), 2) : String(value)

  const displayMin = localMin || formatBoundary(data.min != null ? data.min : sliderBuckets[0].key)
  const displayMax =
    localMax || formatBoundary(data.max != null ? data.max : sliderBuckets[sliderBucketsAmount - 1].key)

  const axisLabels = createHistogramLabels(buckets, bucketType)

  return (
    <div className="flex flex-col gap-2 p-2">
      {data.mean != null && data.mean !== '' && (
        <div className="flex items-baseline justify-end mb-2">
          <span className="text-xs text-secondary">
            Mean: {formatBoundary(data.mean)} {unit}
          </span>
        </div>
      )}

      <div className="relative h-20 flex items-end gap-px" data-testid="histogram-bars">
        {buckets.map((bucket, i) => {
          const selected = i >= sliderValues[0] && i <= sliderValues[1]
          return (
            <div
              key={String(bucket.key)}
              data-selected={selected}
              className={`flex-1 min-w-0.5 rounded-t-sm transition-[background,opacity] duration-150 ${
                selected ? 'bg-theme-accent-fg' : 'bg-theme-neutral-fg opacity-45'
              }`}
              style={{ height: `${Math.max((bucket.count / maxCount) * 100, 4)}%` }}
            />
          )
        })}
      </div>

      <div className="flex justify-between text-[0.625rem] text-secondary">
        {axisLabels.map((label, i) => (
          <span key={i}>
            {label}
            {i === axisLabels.length - 1 && unit ? ` ${unit}` : ''}
          </span>
        ))}
      </div>

      <Slider.Root
        value={sliderValues}
        onValueChange={(values) => {
          setLocalMin(indexToValue(values[0]))
          setLocalMax(indexToValue(values[1]))
        }}
        onValueCommitted={(values) => {
          const minStr = indexToValue(values[0])
          const maxStr = indexToValue(values[1])
          setLocalMin(minStr)
          setLocalMax(maxStr)
          applyRange(minStr, maxStr)
        }}
        min={0}
        max={sliderBucketsAmount - 1}
        step={1}
        className="mx-2 my-3"
      >
        <Slider.Control className="flex items-center h-4 cursor-pointer touch-none">
          <Slider.Track className="relative h-1 w-full rounded-full bg-stroke-medium">
            <Slider.Indicator className="absolute h-full rounded-full bg-theme-accent-fg" />
            <Slider.Thumb index={0} aria-label="Minimum" className={thumbClass} />
            <Slider.Thumb index={1} aria-label="Maximum" className={thumbClass} />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>

      <div className="flex gap-2 items-center mt-1.5">
        <input
          aria-label="Minimum value"
          type={bucketType}
          placeholder={`Min (${displayMin})`}
          value={localMin}
          onChange={(e) => setLocalMin(e.target.value)}
          onBlur={() => applyRange(localMin, localMax)}
          className={inputClass}
        />
        <span>–</span>
        <input
          aria-label="Maximum value"
          type={bucketType}
          placeholder={`Max (${displayMax})`}
          value={localMax}
          onChange={(e) => setLocalMax(e.target.value)}
          onBlur={() => applyRange(localMin, localMax)}
          className={inputClass}
        />
        {unit && <span className="text-xs text-secondary shrink-0">{unit}</span>}
      </div>
    </div>
  )
}
