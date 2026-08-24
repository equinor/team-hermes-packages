/**
 * Sets a nested value in an object using a path array.
 * @param {object} obj - The target object.
 * @param {Array<string|number>} path - The path to the nested property as an array.
 * @param {*} value - The value to set.
 */
export const deepSet = (obj: any, path: string, val: any) => {
  path = path.replaceAll('[', '.[')
  const keys = path.split('.')

  for (let i = 0; i < keys.length; i++) {
    let currentKey = keys[i] as any
    let nextKey = keys[i + 1] as any
    if (currentKey.includes('[')) {
      currentKey = Number.parseInt(currentKey.substring(1, currentKey.length - 1), 10)
    }
    if (nextKey?.includes('[')) {
      nextKey = Number.parseInt(nextKey.substring(1, nextKey.length - 1), 10)
    }

    if (typeof nextKey !== 'undefined') {
      obj[currentKey] = obj[currentKey] ? obj[currentKey] : Number.isNaN(nextKey) ? {} : []
    } else {
      obj[currentKey] = val
    }

    obj = obj[currentKey]
  }
}

/**
 * Deletes a property from an object using a dot/bracket notation path.
 * @param {Object} obj - The object to modify.
 * @param {string} path - The path to the property (e.g., "a.b.c" or "a[0].b").
 * @returns {boolean} - True if deletion was successful, false otherwise.
 */
export function deleteByPath(obj: any, path: string): boolean {
  if (typeof obj !== 'object' || obj === null) return false
  if (typeof path !== 'string' || !path.trim()) return false

  // Convert bracket notation to dot notation and split into keys
  const keys = path
    .replace(/\[(\w+)\]/g, '.$1')
    .replace(/^\./, '')
    .split('.')

  let current = obj
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof current !== 'object' || current === null || !(keys[i] in current)) {
      return false // Path does not exist
    }
    current = current[keys[i]]
  }

  const lastKey = keys[keys.length - 1]
  if (current && Object.hasOwn(current, lastKey)) {
    delete current[lastKey]
    return true
  }
  return false
}

/**
 * Retrieves a nested value from an object using a dot/bracket notation path.
 * @param obj - The object to query.
 * @param path - The path to the property (e.g., "a.b.c" or "a[0].b").
 * @param defaultValue - The value to return if the path does not exist.
 * @returns The value at the specified path or the default value.
 */
export const getNestedValue = (obj: any, path: string, defaultValue: string | null = null) => {
  const keys = path.split('.') // Split the path string into an array of keys
  return (
    keys.reduce((currentObj, key) => {
      // If the current object is null or undefined, or the key doesn't exist, stop traversing
      if (currentObj && Object.hasOwn(currentObj, key)) {
        return currentObj[key]
      }
      // Otherwise, return the default value or undefined
      return undefined
    }, obj) ?? defaultValue
  ) // Initialize with the original object, use nullish coalescing for the final result
}
