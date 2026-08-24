/**
 * formats a number of bytes into a human-readable string with appropriate units (KB or MB).
 * If the number of bytes is greater than or equal to 1 MB, it will be formatted in MB with one decimal place.
 * Otherwise, it will be formatted in KB with one decimal place.
 * @param bytes number of bytes to format
 * @returns formatted file size as string
 */
export const formatFileSize = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`

/**
 * Formats a number with spaces as thousand separators.
 * @param n number to format
 * @param decimals number of decimal places to show (defaults to 0)
 * @param locale locale to use for formatting (defaults to the runtime locale)
 * @returns formatted number as string
 */
export function formatNumberToLocale(n: number | null | undefined, decimals: number = 0, locale?: string): string {
  if (n == null) return ''
  return n
    .toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    .replace(/,/g, ' ')
}
