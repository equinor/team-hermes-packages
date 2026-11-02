import { useMemo } from 'react'
import type { CellActions } from '../../context/DataGridContext'
import type { DataGridCommentConfig } from '../../DataGrid.types'

type DataGridCommentSectionProps = {
  commentConfig: DataGridCommentConfig<any>
  cellActions: CellActions
}

export const DataGridCommentSection = (props: DataGridCommentSectionProps) => {
  const { commentConfig, cellActions } = props

  const commentsWithPaths = useMemo(() => {
    const allComments = commentConfig.getAllComments()
    return allComments.map((comment) => ({
      comment,
      path: commentConfig.getCommentCellPath(comment),
    }))
  }, [commentConfig])

  if (commentsWithPaths.length === 0) return null

  const { CommentPreview } = commentConfig

  return (
    <div className="flex flex-col">
      {commentsWithPaths.map(({ comment, path }) => {
        const [rowId, columnId] = path.split('.')
        return (
          <button
            className="p-3 text-left hover:bg-surface-hover border-b border-stroke-subtle"
            key={comment.uid ?? path}
            onClick={() => cellActions.navigateToCell(rowId, columnId)}
          >
            <CommentPreview comment={comment} path={path} />
          </button>
        )
      })}
    </div>
  )
}
