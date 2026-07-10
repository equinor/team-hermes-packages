import { Icon } from '@equinor/eds-core-react'
import { list, lock } from '@equinor/eds-icons'
import { type Cell, flexRender } from '@tanstack/react-table'
import { AttributeType } from '@/shared/types'
import { Combobox, type ComboboxItem } from '@/index'
import { formatDate, pluralize } from '@/shared/utils'
import { useDataGridContext } from '../../../context/DataGridContext'
import { useDataGridUpdates } from '../../../hooks/useDataGridUpdates/useDataGridUpdates'
import { DataGridTextEditor } from '../DataGridEditor/DataGridTextEditor/DataGridTextEditor'

type DataGridCellContentProps<TData extends Record<string, any>> = {
  options?: ComboboxItem[]
  isEditing?: boolean
  dataType?: AttributeType
  cell: Cell<TData, unknown>
}

export const DataGridCellContent = <TData extends Record<string, any>>(props: DataGridCellContentProps<TData>) => {
  const { options, isEditing, dataType, cell } = props
  const { table, cellActions, tableBodyRef, history, editable } = useDataGridContext<TData>()
  const { commitCellEdit, updateCellValue } = useDataGridUpdates(table, history.record)
  const showLocked = editable && cell.column.columnDef.meta?.editable === false

  const clearCellEditing = () => {
    cellActions.setActiveEditingCell(null)
    tableBodyRef?.current?.focus({ preventScroll: true })
  }

  const onInputBlur = () => {
    commitCellEdit(cell.row.index, cell.column.id, cellActions.editingCellValue, dataType)
    clearCellEditing()
  }

  const onSelectChange = (selectedItem: ComboboxItem | null) => {
    updateCellValue(cell.row.index, cell.column.id, selectedItem?.value || '')
    cellActions.setEditingCellValue(selectedItem?.value as string)
    clearCellEditing()
  }

  if (editable) {
    if (isEditing) {
      const CellEditor = cell.column.columnDef.meta?.cellEditorComponent
      if (CellEditor) {
        const onCommit = (columnId: string, value: any) => {
          updateCellValue(cell.row.index, columnId, value)
        }
        return <CellEditor cell={cell} table={table} onCommit={onCommit} onClose={clearCellEditing} />
      }
      if (Array.isArray(options) && options.length > 0) {
        const valueOption = options.find((option) => option.value === cellActions.editingCellValue) || null
        const initialSearch =
          !valueOption && typeof cellActions.editingCellValue === 'string' ? cellActions.editingCellValue : undefined
        return (
          <Combobox
            autoFocus
            value={valueOption}
            items={options}
            onChange={onSelectChange}
            defaultInputValue={initialSearch}
            onClose={clearCellEditing}
          />
        )
      }
      if ([AttributeType.TEXT, AttributeType.NUMBER, AttributeType.DATE_STRING].includes(dataType as AttributeType)) {
        return (
          <DataGridTextEditor
            value={cellActions.editingCellValue as string}
            initialValue={cellActions.editingCellValue as string}
            setValue={cellActions.setEditingCellValue}
            onBlur={onInputBlur}
            type={
              dataType === AttributeType.NUMBER ? 'number' : dataType === AttributeType.DATE_STRING ? 'date' : 'text'
            }
          />
        )
      }
    }
  }

  if (dataType === AttributeType.TEXT_ARRAY || dataType === AttributeType.NUMBER_ARRAY) {
    if (Array.isArray(cell.getValue())) {
      const value = (cell.getValue() as string[])?.length || 0
      return (
        <div className="flex gap-2 items-center justify-between flex-wrap">
          {value} {pluralize('item', value)}
          <Icon data={list} size={18} color="var(--color-theme-accent-fg)" />
        </div>
      )
    }
    const value: number = (cell.getValue() as number) || 0
    return (
      <div className="flex gap-2 items-center justify-between flex-wrap">
        {value} {pluralize('item', value)}
        <Icon data={list} size={18} color="var(--color-theme-accent-fg)" />
      </div>
    )
  }

  if (dataType === AttributeType.DATE_STRING) {
    const dateValue = cell.getValue() as string
    const formattedDate = formatDate(dateValue)
    return <div className={`flex justify-end w-full ${showLocked ? 'opacity-80' : ''}`}>{formattedDate}</div>
  }

  if (dataType === AttributeType.NUMBER) {
    return (
      <div className={`flex justify-end w-full ${showLocked ? 'opacity-80' : ''}`}>
        {showLocked && <Icon data={lock} size={16} className="mr-auto" />}
        {(cell.getValue() as number) ?? '\u00A0'}
      </div>
    )
  }

  if (dataType === AttributeType.TEXT) {
    return (
      <div className={`flex w-full ${showLocked ? 'opacity-80' : ''}`}>
        {showLocked && <Icon data={lock} size={16} className="mr-auto" />}
        {(cell.getValue() as string) ?? '\u00A0'}
      </div>
    )
  }

  return (
    <>
      {flexRender(cell.column.columnDef.cell, cell.getContext())} {'\u00A0'}
    </>
  )
}
