import { Typography } from '@equinor/eds-core-react'
import { useEffect, useState } from 'react'

import { parseVersionFile } from '@/components/NavBar/components/VersionText.utils'
import type { CommitInfo } from '@/components/NavBar/components/VersionText.utils'

const useCommitInfo = (versionUrl: string) => {
  const [result, setResult] = useState<{ url: string; commitInfo: CommitInfo } | null>(null)

  useEffect(() => {
    let active = true
    setResult(null)
    const fetchVersionFile = async () => {
      const response = await fetch(versionUrl)
      if (!response.ok) {
        throw new Error(`Could not read version file: HTTP ${response.status}`)
      }
      if (/html/i.test(response.headers.get('content-type') ?? '')) {
        throw new Error('Could not read version file: received HTML')
      }

      const commitInfo = parseVersionFile(await response.text())
      if (!commitInfo) {
        throw new Error('Could not read version file: invalid version data')
      }
      return commitInfo
    }
    fetchVersionFile()
      .then((commitInfo) => {
        if (active) setResult({ url: versionUrl, commitInfo })
      })
      .catch((error: unknown) => {
        if (active) {
          setResult(null)
          console.error('Could not load version information', error)
        }
      })
    return () => {
      active = false
    }
  }, [versionUrl])

  return result?.url === versionUrl ? result.commitInfo : null
}

export const VersionText = ({
  githubRepoName,
  versionUrl = '/version.txt',
}: {
  githubRepoName: string
  versionUrl?: string
}) => {
  const commitInfo = useCommitInfo(versionUrl)

  return (
    <div>
      <Typography variant="h6">Version</Typography>
      {commitInfo ? (
        <Typography
          link
          href={`https://github.com/${githubRepoName}/commit/${commitInfo.hash}`}
          rel="noopener noreferrer"
        >
          {commitInfo.refs || commitInfo.hash}
        </Typography>
      ) : (
        <Typography>unknown</Typography>
      )}
      {commitInfo?.date && <>&nbsp;({commitInfo.date})</>}
    </div>
  )
}
