export type CommitInfo = {
  hash: string
  date: string
  refs: string
}

export const parseVersionFile = (text: string): CommitInfo | null => {
  if (/<[^>]*>/.test(text)) return null

  const commitInfo: CommitInfo = { hash: '', date: '', refs: '' }

  for (const line of text.split('\n')) {
    const separator = line.indexOf(':')
    if (separator === -1) continue

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (key === 'hash' || key === 'date' || key === 'refs') {
      commitInfo[key] = value
    }
  }

  return commitInfo.hash ? commitInfo : null
}
