import { Icon } from '@equinor/eds-core-react'
import { chevron_left, chevron_right, first_page, last_page } from '@equinor/eds-icons'
import type { Table } from '@tanstack/react-table'
import { SkeletonWrapper, Stack } from '@/components'
import type { PaginationConfig } from '../DataGrid.types'

type DataGridPaginationProps<DataType> = {
  table: Table<DataType>
  paginationConfig?: PaginationConfig
  isMakingDataRequest?: boolean
  style?: React.CSSProperties
  disabled?: boolean
}

const defaultPaginationConfig: PaginationConfig = {
  pageSizeOptions: [10, 25, 50, 100],
}

export function DataGridPagination<DataType>(props: DataGridPaginationProps<DataType>) {
  const { table, paginationConfig, isMakingDataRequest, disabled } = props
  const config = { ...defaultPaginationConfig, ...paginationConfig }

  if (!config.paginationType) return null

  // Cursor mode: deep ``search_after`` paging can't address an arbitrary page,
  // so show only sequential Prev/Next (no first/last jumps, no "Page X of Y").
  const isCursor = config.paginationType === 'cursor'

  const page = table.getState().pagination?.pageIndex
  const itemsPerPage = table.getState().pagination?.pageSize

  const rowCount = table.getRowCount()
  const pageCount = table.getPageCount()

  // In cursor mode the page count is unknown, so the API's ``hasNextPage``
  // drives Next; otherwise the table's own row-count math does.
  const canGoNext = isCursor ? (config.hasNextPage ?? table.getCanNextPage()) : table.getCanNextPage()

  const visibleFromLabel = rowCount === 0 ? 0 : page * itemsPerPage + 1
  const visibleToLabel = Math.min(rowCount, (page + 1) * itemsPerPage)

  const buttonClassNames = 'p-1 disabled:opacity-50 disabled:pointer-events-none'

  return (
    <Stack
      $padding={1}
      $direction="row"
      $alignItems="center"
      $spacing={2}
      $justifyContent="flex-end"
      style={props.style}
    >
      <Stack $direction="row" $alignItems="center" $spacing={0.25}>
        <span className="text-overline">Page size:</span>
        <select
          className="text-xs disabled:opacity-50"
          data-testid="pagesize"
          value={table.getState().pagination.pageSize}
          onChange={(e) => {
            table.setPageSize(Number(e.target.value))
          }}
          disabled={isMakingDataRequest || disabled}
        >
          {config.pageSizeOptions?.map((pageSize) => (
            <option key={pageSize} value={pageSize}>
              {pageSize}
            </option>
          ))}
        </select>
      </Stack>
      <span className="text-overline">
        <SkeletonWrapper type="text" condition={!isMakingDataRequest} width="100px" height="1rem">
          {visibleFromLabel} to {visibleToLabel} of <span data-testid="total-number-of-rows">{rowCount}</span>
        </SkeletonWrapper>
      </span>
      <Stack $direction="row" $spacing={0.25} $alignItems="center">
        <button
          className={buttonClassNames}
          onClick={() => table.firstPage()}
          disabled={!table.getCanPreviousPage() || disabled}
        >
          <Icon data-testid="first-page" data={first_page} size={18} />
        </button>
        <button
          className={buttonClassNames}
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage() || disabled}
        >
          <Icon data-testid="previous-page" data={chevron_left} size={18} />
        </button>
        {!isCursor && (
          <span className="text-overline">
            <SkeletonWrapper type="text" condition={!isMakingDataRequest} width="80px" height="1rem">
              Page <span data-testid="page-number">{page + 1}</span> of{' '}
              <span data-testid="number-of-pages">{pageCount}</span>
            </SkeletonWrapper>
          </span>
        )}
        <button className={buttonClassNames} onClick={() => table.nextPage()} disabled={!canGoNext || disabled}>
          <Icon data-testid="next-page" data={chevron_right} size={18} />
        </button>
        {!isCursor && (
          <button
            className={buttonClassNames}
            onClick={() => table.lastPage()}
            disabled={!table.getCanNextPage() || disabled}
          >
            <Icon data-testid="last-page" data={last_page} size={18} />
          </button>
        )}
      </Stack>
    </Stack>
  )
}
