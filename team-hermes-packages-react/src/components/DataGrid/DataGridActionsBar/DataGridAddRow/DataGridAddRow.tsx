import { Dialog, Menu } from '@base-ui/react'
import { Button, Icon, Radio, Typography } from '@equinor/eds-core-react'
import { add } from '@equinor/eds-icons'
import { useId, useState } from 'react'
import { FormTextField } from '../../../FormTextField/FormTextField'
import { useDataGridContext } from '../../context/DataGridContext'
import { dataGridActionsBar } from '../DataGridActionsBar.styles'

type AddRowLocation = 'end' | 'top' | 'atIndex'

export const DataGridAddRow = <TData extends Record<string, any>>() => {
  const { table, cellActions, addRows } = useDataGridContext<TData>()
  const [isCustomRowModalOpen, setIsCustomRowModalOpen] = useState<boolean>(false)
  const [addRowLocation, setAddRowLocation] = useState<AddRowLocation>('end')
  const [customRowAmount, setCustomRowAmount] = useState<number>(1)
  const [customRowIndex, setCustomRowIndex] = useState<number>(0)
  const addRowLabelId = useId()
  const styles = dataGridActionsBar()

  function handleAddRow(amount = 1, atIndex?: number) {
    table.resetSorting(true)
    addRows(amount, atIndex)
    const currentRowsLength = table.getFilteredRowModel().rows.length
    cellActions.scrollToRow?.(atIndex !== undefined ? atIndex : currentRowsLength + amount, {
      align: 'start',
      behavior: 'smooth',
    })
    setIsCustomRowModalOpen(false)
    setCustomRowAmount(1)
    setCustomRowIndex(0)
    setAddRowLocation('end')
  }

  return (
    <>
      <Menu.Root>
        <Menu.Trigger className={styles.actionsBarMenuItem()}>
          <Icon data={add} size={16} />
          Add row
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup className="menu-popup">
              <Menu.Item className="menu-item" onClick={() => handleAddRow()}>
                Add 1 row at the end
              </Menu.Item>
              <Menu.Item className="menu-item" onClick={() => handleAddRow(5)}>
                Add 5 rows at the end
              </Menu.Item>
              <Menu.Item className="menu-item" onClick={() => handleAddRow(10)}>
                Add 10 rows at the end
              </Menu.Item>
              <Menu.Item className="menu-item" onClick={() => handleAddRow(20)}>
                Add 20 rows at the end
              </Menu.Item>
              <Menu.Item className="menu-item" onClick={() => setIsCustomRowModalOpen(true)}>
                Add custom rows
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Dialog.Root open={isCustomRowModalOpen} onOpenChange={setIsCustomRowModalOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="dialog-backdrop" />
          <Dialog.Popup className="dialog-popup-base popup-animation -mt-8 w-96 max-w-[calc(100vw-3rem)] min-w-[40vw]">
            <div className="flex flex-col px-4 pb-4 gap-4">
              <FormTextField
                name="rowAmount"
                label="Number of rows"
                type="number"
                min={1}
                max={100}
                placeholder="Enter number of rows"
                updateValue={(value) => {
                  const parsedValue = Number.parseInt(value as string, 10)
                  if (!Number.isNaN(parsedValue) && parsedValue > 0) {
                    setCustomRowAmount(parsedValue)
                  }
                }}
                value={String(customRowAmount)}
              />
              <div className="flex flex-col" aria-labelledby={addRowLabelId} role="radiogroup">
                <Typography
                  as="legend"
                  id={addRowLabelId}
                  group="input"
                  style={{ marginLeft: '0.5rem' }}
                  variant="label"
                >
                  Select where to add new rows
                </Typography>
                <div className="flex flex-row gap-0.5">
                  <Radio
                    label="Add at the end"
                    checked={addRowLocation === 'end'}
                    onChange={() => setAddRowLocation('end')}
                  />
                  <Radio
                    label="Add at the top"
                    checked={addRowLocation === 'top'}
                    onChange={() => setAddRowLocation('top')}
                  />
                  <Radio
                    label="Add after specific row"
                    checked={addRowLocation === 'atIndex'}
                    onChange={() => setAddRowLocation('atIndex')}
                  />
                </div>
              </div>
              {addRowLocation === 'atIndex' && (
                <FormTextField
                  name="rowIndex"
                  label="Row number"
                  type="number"
                  min={0}
                  max={table.getFilteredRowModel().rows.length}
                  placeholder="Enter row number"
                  updateValue={(value) => {
                    const parsedValue = Number.parseInt(value as string, 10)
                    if (!Number.isNaN(parsedValue) && parsedValue >= 0) {
                      setCustomRowIndex(parsedValue)
                    }
                  }}
                  value={String(customRowIndex)}
                />
              )}
              <div className="flex justify-end gap-4">
                <Button variant="outlined" onClick={() => setIsCustomRowModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    handleAddRow(
                      customRowAmount,
                      addRowLocation === 'atIndex' ? customRowIndex : addRowLocation === 'top' ? 0 : undefined
                    )
                  }}
                >
                  Add Rows
                </Button>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
