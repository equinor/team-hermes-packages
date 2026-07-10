export const formatFileSize = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`

/**
 * formats a number with spaces as thousand separators, and no decimal places. If the number is not an integer, it will be rounded to the nearest whole number before formatting.
 * @param n number to format
 * @returns formatted number as string
 */
export function formatNumberToLocale(n: number | null | undefined): string {
  if (n == null) return ''
  if (Number.isInteger(n)) return n.toLocaleString().replace(/,/g, ' ')
  return n.toFixed(0).toLocaleString().replace(/,/g, ' ')
}
