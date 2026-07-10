/** biome-ignore-all lint/suspicious/noExplicitAny: any type is just for context - rest of datagrid inherits the TData type */
/** biome-ignore-all lint/correctness/useExhaustiveDependencies: We want to recalculate on changes to the dependencies we're tracking */
import type { Cell, Column, Table } from '@tanstack/react-table'
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import { createContext, useCallback, useContext, useMemo, useRef } from 'react'
import type { DataGridCommentConfig } from '../DataGrid.types'
import type { InputValue } from '../DataGridBody/components/DataGridCell'
import { useCellClipboard } from '../hooks/useCellClipboard/useCellClipboard'
import { useCellEditing } from '../hooks/useCellEditing/useCellEditing'
import { useCellKeyboard } from '../hooks/useCellKeyboard/useCellKeyboard'
import { useCellSelection } from '../hooks/useCellSelection/useCellSelection'
import { useDataGridUpdates } from '../hooks/useDataGridUpdates/useDataGridUpdates'
import { type UndoRedo, useUndoRedo } from '../hooks/useUndoRedo/useUndoRedo'
import type { CellCoordinates } from '../utils/cellUtils'

/**
 * Composed cellActions shape exposed to all DataGrid children.
 * Backward-compatible with the old monolithic useCellActions return type.
 */
export type CellActions = {
  // Selection
  selectedCells: CellCoordinates[]
  isCellSelected: (cell: Cell<any, any>) => boolean
  isRowSelected: (rowId: string) => boolean
  handleCellMouseDown: (e: React.MouseEvent<HTMLElement>, cell: Cell<any, any>) => void
  handleCellMouseOver: (e: React.MouseEvent<HTMLElement>, cell: Cell<any, any>) => void
  handleCellMouseUp: () => void
  clearSelection: () => void
  setSelectedCellsByRow: (rowId: string) => void
  setSelectedCellsByColumn: (columnId: string) => void
  selectErrorCell: (errorIndex: number | 'next' | 'previous', type: 'warning' | 'error') => void
  selectedErrorIndex: number
  selectedWarningIndex: number
  rowHasErrors: (rowId: string) => boolean
  rowHasWarnings: (rowId: string) => boolean
  scrollToRow: ((index: number, options?: Record<string, any>) => void) | undefined
  navigateToCell: (rowId: string, columnId: string) => void

  // Editing
  activeEditingCell: CellCoordinates | null
  setActiveEditingCell: (cell: CellCoordinates | null) => void
  editingCellValue: InputValue | undefined
  setEditingCellValue: React.Dispatch<React.SetStateAction<InputValue | undefined>>
  isCellEditing: (cell: Cell<any, any>) => boolean
  isCellCommenting: (cell: Cell<any, any>) => boolean
  handleDoubleClick: (cell: Cell<any, any>) => void
  setCurrentSelectedCellAsEditingCell: () => void
  setCommentingCell: (clear?: boolean) => void

  // Clipboard
  isCopied: boolean
  isCellCopied: (rowId: string, columnId: string) => boolean
  copySelectedCells: () => void
  pasteSelectedCells: () => Promise<void>
  deleteSelectedCells: () => void
  shortenDecimals: (decimalPlaces: number, roundingMode?: 'round' | 'floor' | 'ceil') => void

  // Keyboard
  handleCellsKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void
}

// Table<T> is invariant in TanStack, so we store Table<any> internally
// and recover the concrete TData via useDataGridContext<TData>().
type DataGridContextType = {
  table: Table<any>
  cellActions: CellActions
  history: UndoRedo
  tableBodyRef: React.RefObject<HTMLTableSectionElement | null>
  tableContainerRef: React.RefObject<HTMLDivElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  headerRowRef: React.RefObject<HTMLDivElement | null>
  rowVirtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>
  columnVirtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>
  virtualColumns: ReturnType<Virtualizer<HTMLDivElement, HTMLDivElement>['getVirtualItems']>
  virtualPaddingLeft: number | undefined
  virtualPaddingRight: number | undefined
  leftPinnedColumns: Column<any, unknown>[]
  rightPinnedColumns: Column<any, unknown>[]
  unpinnedColumns: Column<any, unknown>[]
  rows: ReturnType<Table<any>['getRowModel']>['rows']
  columnSizeVars: Record<string, number>
  addRows: (amount?: number, atIndex?: number) => void
  removeRow: (rowIndex: number) => void
  editable: boolean
  enableAddRows: boolean
  enableRemoveRows: boolean
  filterable: boolean
  enableRowSelection: boolean
  deletionStrategy: 'remove' | 'nullify'
  onArrayCellClick?: (row: any, cellValue: unknown, columnId: string) => void
  commentConfig?: DataGridCommentConfig<any>
}

const DataGridContext = createContext<DataGridContextType | null>(null)

type DataGridProviderProps<TData extends Record<string, any>> = {
  table: Table<TData>
  children: React.ReactNode
  editable: boolean
  enableAddRows: boolean
  enableRemoveRows: boolean
  filterable: boolean
  enableRowSelection: boolean
  deletionStrategy: 'remove' | 'nullify'
  onArrayCellClick?: (row: TData, cellValue: unknown, columnId: string) => void
  commentConfig?: DataGridCommentConfig<any>
}

export function DataGridProvider<TData extends Record<string, any>>({
  table,
  children,
  editable,
  enableAddRows,
  enableRemoveRows,
  filterable,
  enableRowSelection,
  deletionStrategy,
  onArrayCellClick,
  commentConfig,
}: DataGridProviderProps<TData>) {
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tableBodyRef = useRef<HTMLTableSectionElement>(null)
  const headerRowRef = useRef<HTMLDivElement>(null)

  const { rows } = table.getRowModel()
  const visibleColumns = table.getVisibleLeafColumns()
  const columnPinning = table.getState().columnPinning

  // Split columns: pinned columns are always rendered, only unpinned are virtualized
  const leftPinnedColumns = useMemo(
    () => visibleColumns.filter((col) => col.getIsPinned() === 'left'),
    [visibleColumns, columnPinning]
  )
  const rightPinnedColumns = useMemo(
    () => visibleColumns.filter((col) => col.getIsPinned() === 'right'),
    [visibleColumns, columnPinning]
  )
  const unpinnedColumns = useMemo(
    () => visibleColumns.filter((col) => !col.getIsPinned()),
    [visibleColumns, columnPinning]
  )

  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: rows.length,
    estimateSize: () => 44,
    getScrollElement: () => tableContainerRef?.current || null,
    measureElement:
      typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
    overscan: 10,
    paddingEnd: 90,
  })

  const columnVirtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: unpinnedColumns.length,
    estimateSize: (index) => unpinnedColumns[index].getSize(),
    getScrollElement: () => tableContainerRef.current,
    horizontal: true,
    overscan: 4,
  })

  // --- Compose cell actions from focused hooks ---

  const scrollToColumn = useCallback(
    (columnId: string) => {
      const colIndex = unpinnedColumns.findIndex((c) => c.id === columnId)
      if (colIndex >= 0) {
        columnVirtualizer.scrollToIndex(colIndex, { align: 'center' })
      }
    },
    [unpinnedColumns, columnVirtualizer]
  )

  const selection = useCellSelection({
    table,
    rows,
    scrollToRow: rowVirtualizer.scrollToIndex,
    scrollToColumn,
    containerRef,
    validationErrors: table.options.meta?.validationErrors,
    validationWarnings: table.options.meta?.validationWarnings,
  })

  const editing = useCellEditing({
    table,
    tableBodyRef,
    selectedCells: selection.selectedCells,
    editable,
  })

  const history = useUndoRedo(table, containerRef)

  const { addRows, removeRow } = useDataGridUpdates(table, history.record)

  const clipboard = useCellClipboard({
    table,
    rows,
    selectedCells: selection.selectedCells,
    record: history.record,
    editable,
    deletionStrategy,
  })

  const keyboard = useCellKeyboard({ selection, editing, clipboard })

  const cellActions: CellActions = {
    // Selection
    selectedCells: selection.selectedCells,
    isCellSelected: selection.isCellSelected,
    isRowSelected: selection.isRowSelected,
    handleCellMouseDown: selection.handleCellMouseDown,
    handleCellMouseOver: selection.handleCellMouseOver,
    handleCellMouseUp: selection.handleCellMouseUp,
    clearSelection: selection.clearSelection,
    setSelectedCellsByRow: selection.setSelectedCellsByRow,
    setSelectedCellsByColumn: selection.setSelectedCellsByColumn,
    selectErrorCell: selection.selectErrorCell,
    selectedErrorIndex: selection.selectedErrorIndex,
    selectedWarningIndex: selection.selectedWarningIndex,
    rowHasErrors: selection.rowHasErrors,
    rowHasWarnings: selection.rowHasWarnings,
    scrollToRow: selection.scrollToRow,
    navigateToCell: (rowId: string, columnId: string) => {
      selection.setSelectedCells([{ rowId, columnId }])
      const rowIndex = table.getRowModel().rows.findIndex((r) => r.id === rowId)
      if (rowIndex >= 0) {
        selection.scrollToRow?.(rowIndex, { behavior: 'smooth', align: 'center' })
      }
      selection.scrollToColumn?.(columnId)
    },

    // Editing
    activeEditingCell: editing.activeEditingCell,
    setActiveEditingCell: editing.setActiveEditingCell,
    editingCellValue: editing.editingCellValue,
    setEditingCellValue: editing.setEditingCellValue,
    isCellEditing: editing.isCellEditing,
    isCellCommenting: editing.isCellCommenting,
    handleDoubleClick: editing.handleDoubleClick,
    setCurrentSelectedCellAsEditingCell: editing.setCurrentSelectedCellAsEditingCell,
    setCommentingCell: editing.setCommentingCell,

    // Clipboard
    isCopied: clipboard.isCopied,
    isCellCopied: clipboard.isCellCopied,
    copySelectedCells: clipboard.copySelectedCells,
    pasteSelectedCells: clipboard.pasteSelectedCells,
    deleteSelectedCells: clipboard.deleteSelectedCells,
    shortenDecimals: clipboard.shortenDecimals,

    // Keyboard
    handleCellsKeyDown: keyboard.handleCellsKeyDown,
  }

  const virtualColumns = columnVirtualizer.getVirtualItems()

  let virtualPaddingLeft: number | undefined
  let virtualPaddingRight: number | undefined

  if (columnVirtualizer && virtualColumns?.length) {
    virtualPaddingLeft = virtualColumns[0]?.start ?? 0
    virtualPaddingRight = columnVirtualizer.getTotalSize() - (virtualColumns[virtualColumns.length - 1]?.end ?? 0)
  }

  const columnSizeVars = useMemo(() => {
    const headers = table.getFlatHeaders()
    const colSizes: Record<string, number> = {}
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]
      colSizes[`--header-${header.id}-size`] = header.getSize()
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize()
    }
    return colSizes
  }, [table.getState().columnSizingInfo, table.getState().columnSizing, visibleColumns])

  const value: DataGridContextType = {
    table,
    cellActions,
    history,
    tableBodyRef,
    tableContainerRef,
    containerRef,
    headerRowRef,
    rowVirtualizer,
    columnVirtualizer,
    virtualColumns,
    virtualPaddingLeft,
    virtualPaddingRight,
    leftPinnedColumns,
    rightPinnedColumns,
    unpinnedColumns,
    rows,
    columnSizeVars,
    addRows,
    removeRow,
    editable,
    enableAddRows,
    enableRemoveRows,
    filterable,
    enableRowSelection,
    deletionStrategy,
    onArrayCellClick,
    commentConfig,
  }

  return <DataGridContext.Provider value={value}>{children}</DataGridContext.Provider>
}

type TypedDataGridContext<TData extends Record<string, any>> = Omit<DataGridContextType, 'table' | 'rows'> & {
  table: Table<TData>
  rows: ReturnType<Table<TData>['getRowModel']>['rows']
}

export function useDataGridContext<TData extends Record<string, any> = Record<string, any>>() {
  const context = useContext(DataGridContext)
  if (!context) {
    throw new Error('useDataGridContext must be used within a DataGridProvider')
  }
  return context as TypedDataGridContext<TData>
}
