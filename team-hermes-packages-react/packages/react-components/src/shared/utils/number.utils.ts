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
