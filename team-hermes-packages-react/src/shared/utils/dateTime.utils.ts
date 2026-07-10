const MS_PER_HOUR = 1000 * 60 * 60
const TIMEZONE_SUFFIX_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i

function parseDateTime(dateString: string): Date {
  return new Date(TIMEZONE_SUFFIX_PATTERN.test(dateString) ? dateString : `${dateString}Z`)
}

/**
 * Returns amount of time as readable text.
 * Examples: 2 days ago, 40 minutes ago, 3 months ago
 * @param dateString string (has to be valid date)
 * @returns string
 */
export function timeAgo(dateString: string): string {
  const date = parseDateTime(dateString)
  const formatter = new Intl.RelativeTimeFormat('en')
  const ranges: Record<string, number> = {
    years: 3600 * 24 * 365,
    months: 3600 * 24 * 30,
    weeks: 3600 * 24 * 7,
    days: 3600 * 24,
    hours: 3600,
    minutes: 60,
    seconds: 1,
  }
  const secondsElapsed = (date.getTime() - Date.now()) / 1000
  if (secondsElapsed > -1) return 'Now'
  for (const key in ranges) {
    if (ranges[key] < Math.abs(secondsElapsed)) {
      const delta = secondsElapsed / ranges[key]
      return formatter.format(Math.round(delta), key as Intl.RelativeTimeFormatUnit)
    }
  }
  return dateString
}

export function isWithinLastHours(dateString: string, hours: number): boolean {
  const date = parseDateTime(dateString)
  const elapsedMs = Date.now() - date.getTime()

  return Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs <= hours * MS_PER_HOUR
}

/**
 * Returns the date in dd/mm/yyyy format.
 * Accepts either a date string or Date object.
 * If the input is not recognized as a valid date, it returns the original input as a string.
 * @param input string or Date object
 * @returns string in dd/mm/yyyy format
 */
export function formatDate(input: string | Date): string {
  try {
    const date = input instanceof Date ? input : new Date(input)
    if (Number.isNaN(date.getTime())) {
      return String(input)
    }

    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return String(input)
  }
}

/**
 * formats a date key from histogram data to a readable year format. Handles both epoch ms and ISO date strings.
 * @param key string | number | undefined
 * @returns string
 */
export function formatYear(key: string | number | undefined): string {
  if (key == null) return '—'
  if (typeof key === 'number') {
    // Date histograms come back as epoch ms.
    const d = new Date(key)
    if (!Number.isNaN(d.getTime())) return String(d.getUTCFullYear())
    return String(key)
  }
  // ISO string
  const year = key.slice(0, 4)
  return year || String(key)
}

export function formatDateForInput(value: string | undefined | null): string | null {
  const date = value ? new Date(value) : null
  if (!date) return null
  const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return formattedDate
}
