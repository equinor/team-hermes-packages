/** biome-ignore-all lint/a11y/useSemanticElements:  necessary datagrid functionality*/
/** biome-ignore-all lint/a11y/noRedundantRoles: necessary datagrid functionality */
import { dataGridBody } from '../DataGridBody/DataGridBody.styles'
import { dataGridHeader } from '../DataGridHeader/DataGridHeader.styles'

type SkeletonComponentProps = {
  columnsAmount?: number
  rowsAmount?: number
  condition: boolean
  children: React.ReactNode
}

export const SkeletonColumns = (props: SkeletonComponentProps) => {
  const { columnsAmount = 6, condition, children } = props
  const styles = dataGridHeader()
  return condition ? (
    <div className="flex w-full">
      {Array.from({ length: columnsAmount }).map((_, index) => (
        <div className={styles.headerCell({ className: 'max-w-48 grow relative py-3 px-2' })} key={index}>
          <div className={styles.headerCellGrid()}>
            <div className="bg-(--bg-medium) w-full h-[0.875rem] rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  ) : (
    children
  )
}

export const SkeletonRows = (props: SkeletonComponentProps) => {
  const { columnsAmount = 6, rowsAmount = 3, condition, children } = props
  const styles = dataGridBody()

  return condition ? (
    <div role="rowgroup" className="grid relative" style={{ height: `calc(2.5rem * ${rowsAmount})` }}>
      {Array.from({ length: rowsAmount }).map((_, index) => (
        // biome-ignore lint/a11y/useFocusableInteractive: using different focus strategy
        <div role="row" key={index} className="flex w-full max-h-[2.5rem]">
          {Array.from({ length: columnsAmount }).map((_, cellIndex) => (
            <div className={styles.cell({ className: 'flex-1 max-w-48' })} key={cellIndex} data-padded="true">
              <div className="bg-(--bg-medium) w-full h-[0.875rem] rounded animate-pulse" />
            </div>
          ))}
        </div>
      ))}
    </div>
  ) : (
    children
  )
}
