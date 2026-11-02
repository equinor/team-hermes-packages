import { Typography } from '@equinor/eds-core-react'
import { useEffect, useState } from 'react'

type CommitInfo = {
  hash: string
  date: string
  refs: string
}

const useCommitInfo = () => {
  const [commitInfo, setCommitInfo] = useState<CommitInfo>({
    hash: '',
    date: '',
    refs: '',
  })

  useEffect(() => {
    const fetchVersionFile = async () => {
      try {
        return Object.fromEntries(
          (await (await fetch('version.txt')).text()).split('\n').map((line) => line.split(': '))
        )
      } catch (error) {
        throw new Error(`Could not read version file, ${error as string}`)
      }
    }
    fetchVersionFile()
      .then((commitInfo) => setCommitInfo(commitInfo))
      .catch((error) => console.error(error))
  }, [])

  return commitInfo
}

export const VersionText = ({ githubRepoName }: { githubRepoName: string }) => {
  const commitInfo = useCommitInfo()

  return (
    <Typography>
      <Typography variant="h6">Version</Typography>
      <Typography
        link
        href={`https://github.com/${githubRepoName}/commit/${commitInfo.hash}`}
        rel="noopener noreferrer"
      >
        {commitInfo.refs === '' ? commitInfo.hash : commitInfo.refs}
      </Typography>
      &nbsp;({commitInfo.date})
    </Typography>
  )
}
