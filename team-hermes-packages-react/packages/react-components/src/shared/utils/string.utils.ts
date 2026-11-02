/**
 * Add "s" to a string if count is anything but 1
 * @param str base string
 * @param count items count
 * @returns string
 */
export const pluralize = (str: string, count: number): string => {
  return count === 1 ? str : `${str}s`
}

/**
 * generateSlug generates a slug from a string by removing special characters, replacing spaces with hyphens, and converting to lowercase.
 * @param str The input string to convert into a slug.
 * @returns A lowercase, hyphen-separated slug.
 */
export const generateSlug = (str: string) =>
  str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
