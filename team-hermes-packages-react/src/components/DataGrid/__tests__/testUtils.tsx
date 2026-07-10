import { type ColumnDef, createTable, getCoreRowModel } from '@tanstack/react-table'
import type { DataGridCommentConfig } from '../DataGrid.types'

export type TestRow = {
  uid: string
  name: string
  depth: number
  porosity: number
}

export const testData: TestRow[] = [
  { uid: 'row-0', name: 'Sample A', depth: 100, porosity: 0.15 },
  { uid: 'row-1', name: 'Sample B', depth: 200, porosity: 0.25 },
  { uid: 'row-2', name: 'Sample C', depth: 300, porosity: 0.35 },
  { uid: 'row-3', name: 'Sample D', depth: 400, porosity: 0.45 },
  { uid: 'row-4', name: 'Sample E', depth: 500, porosity: 0.55 },
]

export const testColumns: ColumnDef<TestRow>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'depth', header: 'Depth' },
  { accessorKey: 'porosity', header: 'Porosity' },
]

type CreateTestTableOptions = {
  data?: TestRow[]
  columns?: ColumnDef<TestRow>[]
  validationErrors?: Record<string, string>
  validationWarnings?: Record<string, string>
}

export function createTestTable(options: CreateTestTableOptions = {}) {
  const { data = testData, columns = testColumns, validationErrors, validationWarnings } = options

  return createTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnPinning: { left: [], right: [] },
    },
    onStateChange: () => {},
    renderFallbackValue: null,
    meta: {
      validationErrors,
      validationWarnings,
    },
  })
}

export type TestComment = {
  uid: string
  location: string
  comment: string
  author_by_email: string
  created_at: string
}

export const testComments: TestComment[] = [
  {
    uid: 'c1',
    location: '0.depth',
    comment: 'Check this depth value',
    author_by_email: 'user@test.com',
    created_at: '2026-06-04T12:00:00Z',
  },
  {
    uid: 'c2',
    location: '0.depth',
    comment: 'Agreed, looks off',
    author_by_email: 'reviewer@test.com',
    created_at: '2026-06-04T12:05:00Z',
  },
  {
    uid: 'c3',
    location: '2.porosity',
    comment: 'Porosity seems high',
    author_by_email: 'user@test.com',
    created_at: '2026-06-04T13:00:00Z',
  },
]

export function createTestCommentConfig(comments: TestComment[] = testComments): DataGridCommentConfig<TestComment> {
  return {
    enabled: true,
    getComments: (rowId: string, columnId: string) => comments.filter((c) => c.location === `${rowId}.${columnId}`),
    getAllComments: () => comments,
    getCommentCellPath: (comment) => comment.location,
    rowHasComments: (rowId: string) => comments.some((c) => c.location.startsWith(`${rowId}.`)),
    CommentPopover: ({ open, comments: cellComments, path }) => (
      <div data-testid="comment-popover" data-path={path} data-open={open}>
        {cellComments.length} comments
      </div>
    ),
    CommentPreview: ({ comment, path }) => (
      <div data-testid="comment-preview" data-path={path}>
        {comment.comment}
      </div>
    ),
  }
}
