/**
 * Add "s" to a string if count is anything but 1
 * @param str base string
 * @param count items count
 * @returns string
 */
export const pluralize = (str: string, count: number): string => {
  return count === 1 ? str : `${str}s`
}
