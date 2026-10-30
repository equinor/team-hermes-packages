import { Icon } from '@equinor/eds-core-react'
import { chevron_left, chevron_right } from '@equinor/eds-icons'
import { Stack } from '@/components'
import { useDataGridContext, type CellActions } from '../../context/DataGridContext'

type DataGridValidationSectionProps = {
  cellSelection: CellActions
  validationMessages: Record<string, any>
  type: 'error' | 'warning'
}

export const DataGridValidationSection = (props: DataGridValidationSectionProps) => {
  const { cellSelection, validationMessages, type } = props
  const { table } = useDataGridContext()

  if (!validationMessages || Object.keys(validationMessages).length === 0) return null

  const selectedMessageIndex = type === 'error' ? cellSelection.selectedErrorIndex : cellSelection.selectedWarningIndex

  return (
    <Stack $fullWidth>
      <Stack $direction="row" $alignItems="center" $spacing={0.25} $justifyContent="flex-end">
        <span className="text-overline">
          {selectedMessageIndex + 1} of {validationMessages && Object.keys(validationMessages)?.length}
        </span>
        {['previous', 'next'].map((direction) => (
          <button
            key={direction}
            aria-label={`Go to ${direction} validation message`}
            className="p-1 flex items-center justify-center rounded hover:bg-surface-hover disabled:opacity-50"
            onClick={() => cellSelection.selectErrorCell(direction as 'previous' | 'next', type)}
          >
            <Icon data={direction === 'previous' ? chevron_left : chevron_right} />
          </button>
        ))}
      </Stack>
      <Stack $scrollY $grow={1} $minHeight={0} $padding={[0, 0.5]}>
        {Object.entries(validationMessages).map(([key, error], index) => {
          const [rowIndex, ...parts] = key.replace(/[[\]]/g, '').split('.')
          const fullPath = parts.join('.')
          const column = table.getAllLeafColumns().find((c) => c.id === fullPath)
          const header = column?.columnDef.header
          const columnLabel = (typeof header === 'string' && header) || parts[parts.length - 1]
          return (
            <button
              key={index}
              data-active={selectedMessageIndex === index}
              className="py-1 px-2 text-left leading-4 hover:bg-surface-hover border-b border-stroke-subtle data-active:bg-surface-hover"
              onClick={() => cellSelection.selectErrorCell(index, type)}
            >
              <span className="text-meta" key={key}>
                <b>{columnLabel ? `${columnLabel}:${Number(rowIndex) + 1}` : `#${Number(rowIndex) + 1}`}</b>
                <br />
                {`${error}`}
              </span>
            </button>
          )
        })}
      </Stack>
    </Stack>
  )
}
