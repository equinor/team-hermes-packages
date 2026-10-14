/**
 * Checks if a given file matches the specified accept criteria.
 * Mirrors the native `accept` attribute matching (extensions, MIME types, wildcards).
 * @param file The file to check against the accept criteria.
 * @param accept The accept string specifying allowed file types.
 * @returns `true` if the file matches the accept criteria, otherwise `false`.
 **/
export const isAccepted = (file: File, accept?: string) => {
  if (!accept) return true
  const acceptableFileTypes = accept
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
  if (acceptableFileTypes.length === 0) return true
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()

  return acceptableFileTypes.some((fileType) => {
    if (fileType.startsWith('.')) return name.endsWith(fileType)
    if (fileType.endsWith('/*')) return type.startsWith(fileType.slice(0, -1))
    return type === fileType
  })
}
