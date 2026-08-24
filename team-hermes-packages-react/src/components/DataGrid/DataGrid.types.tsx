import type { IconData } from '@equinor/eds-icons'
import type { PaginationState, RowData, Table } from '@tanstack/react-table'
import type { CSSProperties } from 'react'
import type { ComboboxItem } from '../Combobox/Combobox'
import type { AttributeType, FilterOperator } from '@/shared/types'

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    /** **Required for editing.** State setter so DataGrid can mutate rows. */
    setData?: React.Dispatch<React.SetStateAction<TData[]>>
    /** Callback when a column is added. */
    addColumn?: (columnId: string) => void
    /** Callback when a column is removed. */
    removeColumn?: (columnId: string) => void
    /** Error messages keyed as `"[rowIndex].columnId"`. Shown in cells and the sidebar. */
    validationErrors?: Record<string, string>
    /** Warning messages, same key format as `validationErrors`. */
    validationWarnings?: Record<string, string>
    /** How validation keys are resolved. Defaults to row index. */
    validationKeyPrefix?: 'rowIndex' | 'rowId'
    /** Callback after any batch of cell mutations (edit, paste, delete, undo/redo). */
    onCellsChanged?: (changes: { rowIndex: number; columnId: string; value: unknown }[]) => void
    /** Default row shape used when adding new rows via DataGrid. Clone of this is used for each new row. */
    defaultRowValue?: Partial<TData>
    /** Factory function that creates a new default row. Takes precedence over defaultRowValue when both are provided. */
    defaultRowFactory?: () => Partial<TData>
  }
  // biome-ignore lint/correctness/noUnusedVariables: Required by @tanstack/react-table module augmentation
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Controls the filter UI type. */
    filterVariant?: 'text' | 'boolean' | 'select'
    /** Predefined options for select-style filters. */
    filterOptions?: { label: string; value: string | boolean | number }[]
    /** EDS icon shown in the column header. */
    columnIcon?: IconData
    /** Logical grouping label for the column. */
    columnGroup?: string
    /** Controls which editor and filter UI is used: `TEXT`, `NUMBER`, `DATE_STRING`, `BOOLEAN`, `TEXT_ARRAY`, `NUMBER_ARRAY`. */
    dataType?: AttributeType
    /** Unit label shown in the header (e.g. `"m"`, `"kg"`). */
    unit?: string
    /** When provided, the cell editor renders a Combobox dropdown instead of a text input. */
    options?: ComboboxItem[]
    /** Minimum allowed numeric value (validation). */
    minValue?: number | null | undefined
    /** Maximum allowed numeric value (validation). */
    maxValue?: number | null | undefined
    /** Custom filter operators shown in the filter popover. Overrides the default operator list. */
    operatorOptions?: ComboboxItem[]
    /** Whether the column appears in the filter row. */
    isSearchable?: boolean
    /** Whether clicking the header toggles sorting. */
    isSortable?: boolean
    /** Marks the column as required (visual indicator). */
    required?: boolean
    /** Per-column override. Set `false` to lock a column even when the grid is editable. */
    editable?: boolean
    /** A custom editor component. Use for fully custom editing experiences. */
    cellEditorComponent?: React.ComponentType<{
      cell: any
      table: any
      onCommit: (columnId: string, value: any) => void
      onClose: () => void
    }>
  }
}

export type DataGridCommentPopoverProps<TComment> = {
  anchorRef: React.RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  comments: TComment[]
  /** Stable path: "{rowId}.{columnId}" */
  path: string
}

export type DataGridCommentPreviewProps<TComment> = {
  /** The individual comment */
  comment: TComment
  /** Stable path: "{rowId}.{columnId}" */
  path: string
}

export type DataGridCommentConfig<TComment> = {
  /** Whether commenting is enabled */
  enabled: boolean
  /** Lookup comments for a specific cell. Return empty array for no comments. */
  getComments: (rowId: string, columnId: string) => TComment[]
  /** Return all comments (used for sidebar listing) */
  getAllComments: () => TComment[]
  /** Extract the cell path ("{rowId}.{columnId}") from a comment object */
  getCommentCellPath: (comment: TComment) => string
  /** Whether a row has any comments (for action cell indicator) */
  rowHasComments: (rowId: string) => boolean
  /** Component to render when a cell is in "commenting" state */
  CommentPopover: React.ComponentType<DataGridCommentPopoverProps<TComment>>
  /** Component to render a single comment in the sidebar */
  CommentPreview: React.ComponentType<DataGridCommentPreviewProps<TComment>>
}

export type DataGridProps<DataType> = {
  /** **Required.** TanStack Table instance created via `useReactTable`. */
  table: Table<DataType>
  /** Custom inline styles applied to the grid container. */
  style?: CSSProperties
  /** Controls skeleton placeholders while data or columns are loading. */
  loadingStateConfig?: LoadingStateConfig
  /** Initial column grouping configuration. */
  initialGrouping?: string[]
  /** Enables cell editing, paste, delete, undo/redo, and the shorten-decimals action. @default false */
  editable?: boolean
  /** Shows the "Add row" button in the actions bar. @default false */
  enableAddRows?: boolean
  /** Allows deleting rows via the row context menu. @default false */
  enableRemoveRows?: boolean
  /** Shows the filter/search row below the header. @default true */
  filterable?: boolean
  /** Adds a checkbox column for row selection. @default false */
  enableRowSelection?: boolean
  /** How cell deletion works: `remove` deletes the property, `nullify` sets it to `null`. @default 'remove' */
  deletionStrategy?: 'remove' | 'nullify'
  /** Callback when an array-type cell is clicked (arrays are not inline-editable). */
  onArrayCellClick?: (row: DataType, cellValue: unknown, columnId: string) => void
  /** Enables cell-level comments with a sidebar listing and Ctrl+E shortcut. */
  commentConfig?: DataGridCommentConfig<any>
}

export type LoadingStateConfig = {
  /** Column structure is loading. Triggers column skeleton when `showSkeletonColumns` is true. */
  areColumnsLoading?: boolean
  /** Row data is loading. Triggers row skeleton when `showSkeletonRows` is true. */
  isDataLoading?: boolean
  /** Render column skeleton placeholders. */
  showSkeletonColumns?: boolean
  /** Render row skeleton placeholders. */
  showSkeletonRows?: boolean
  /** Number of skeleton rows to display. */
  skeletonRowsAmount?: number
  /** Number of skeleton columns to display. */
  skeletonColumnsAmount?: number
}

export type PaginationConfig = {
  paginationType?: 'client' | 'server' | 'cursor'
  pageSizeOptions?: number[]
  pagination?: PaginationState
  setPagination?: React.Dispatch<React.SetStateAction<PaginationState>>
  paginationChangeCallback?: (pagination: PaginationState) => void
  // Cursor paging only: whether the API reported a further page. Drives the
  // Next button, since the table can't compute a page count while paging by
  // cursor (the total page count is unknown).
  hasNextPage?: boolean
}

export enum ColumnPinningDirection {
  LEFT = 'left',
  RIGHT = 'right',
}

export type ClientFilter = {
  dataType: AttributeType.TEXT | AttributeType.NUMBER | AttributeType.BOOLEAN
  operator: FilterOperator
  value: null | string | number | boolean | [number, number] | string[]
  delimiter?: 'AND' | 'OR'
  additionalOperator?: FilterOperator
  additionalValue?: string
}
