export type HistogramBucketType = 'number' | 'date'

export type HistogramBucket = {
  key: number | string
  count: number
}

export type HistogramData = {
  buckets?: HistogramBucket[]
  min?: number | string | null
  max?: number | string | null
  mean?: number | string | null
}

export type HistogramRangeBounds = {
  from?: number | string | null
  to?: number | string | null
}

export type HistogramRangeChange = HistogramRangeBounds & { attribute: string }

export type HistogramFilterProps = {
  /** Identifier of the attribute being filtered. Passed back as `attribute` in `onRangeChange`. */
  facetKey: string
  /** Histogram buckets and optional min/max/mean statistics. */
  data: HistogramData
  /** Unit shown next to the axis, mean and inputs. */
  unit?: string
  /** Whether bucket keys and bounds are numbers or ISO date strings. */
  bucketType: HistogramBucketType
  /** Currently selected range. */
  range?: HistogramRangeBounds
  /** Called when the user commits a new range (slider release or input blur). */
  onRangeChange: (range: HistogramRangeChange) => void
}
