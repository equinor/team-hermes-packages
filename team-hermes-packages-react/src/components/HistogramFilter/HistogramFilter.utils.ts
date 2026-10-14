import type { HistogramBucketType } from './HistogramFilter.types'

type KeyedBucket = { key: number | string }

function formatAxisLabel(key: number | string, type: HistogramBucketType): string {
  if (type === 'date') return String(key).slice(0, 4)
  const num = Number(key)
  if (num >= 1000) return `${(num / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`
  return num.toLocaleString(undefined, { maximumFractionDigits: 3 })
}

/** Returns up to three axis labels: first, middle and last bucket. */
export function createHistogramLabels(buckets: KeyedBucket[], type: HistogramBucketType): string[] {
  const labels: string[] = []
  if (buckets.length > 0) labels.push(formatAxisLabel(buckets[0].key, type))
  if (buckets.length > 1) labels.push(formatAxisLabel(buckets[Math.floor(buckets.length / 2)].key, type))
  if (buckets.length > 2) labels.push(formatAxisLabel(buckets[buckets.length - 1].key, type))
  return labels
}

/**
 * Convert a bucket key (or filter value) to a comparable number.
 * Dates use the 4-digit year; numbers are rounded to 2 decimals to match slider display precision.
 */
function keyToNumber(key: number | string, type: HistogramBucketType): number {
  if (type === 'date') return Number.parseInt(String(key).slice(0, 4), 10)
  return Math.round(Number(key) * 100) / 100
}

/** First bucket index whose key is >= value, or the last index if none. */
export function findMinBucketIndex(value: string, buckets: KeyedBucket[], type: HistogramBucketType): number {
  const numVal = keyToNumber(value, type)
  if (Number.isNaN(numVal)) return 0
  for (let i = 0; i < buckets.length; i++) {
    if (keyToNumber(buckets[i].key, type) >= numVal) return i
  }
  return buckets.length - 1
}

/** Last bucket index whose key is <= value, or 0 if none. */
export function findMaxBucketIndex(value: string, buckets: KeyedBucket[], type: HistogramBucketType): number {
  const numVal = keyToNumber(value, type)
  if (Number.isNaN(numVal)) return buckets.length - 1
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (keyToNumber(buckets[i].key, type) <= numVal) return i
  }
  return 0
}
