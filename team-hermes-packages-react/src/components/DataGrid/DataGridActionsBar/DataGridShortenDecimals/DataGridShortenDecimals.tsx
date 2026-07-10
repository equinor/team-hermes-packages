import { Dialog, Menu } from '@base-ui/react'
import { Button, Icon, Radio, Tooltip, Typography } from '@equinor/eds-core-react'
import { format_indent_decrease } from '@equinor/eds-icons'
import type { RefObject } from 'react'
import { useState } from 'react'
import { FormTextField } from '../../../FormTextField/FormTextField'
import type { CellActions } from '../../context/DataGridContext'
import { dataGridActionsBar } from '../DataGridActionsBar.styles'

type RoundingMode = 'round' | 'floor' | 'ceil'

type DataGridShortenDecimalsProps = {
  cellActions: CellActions
  disabled?: boolean
  containerRef: RefObject<HTMLElement | null>
}

export const DataGridShortenDecimals = (props: DataGridShortenDecimalsProps) => {
  const { cellActions, disabled, containerRef } = props
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false)
  const [customDecimalPlaces, setCustomDecimalPlaces] = useState(2)
  const [roundingMode, setRoundingMode] = useState<RoundingMode>('round')
  const styles = dataGridActionsBar()

  function handleShortenDecimals(decimalPlaces: number, mode: RoundingMode = 'round') {
    cellActions.shortenDecimals(decimalPlaces, mode)
  }

  function handleCustomConfirm() {
    handleShortenDecimals(customDecimalPlaces, roundingMode)
    setIsCustomModalOpen(false)
    setCustomDecimalPlaces(2)
    setRoundingMode('round')
  }

  return (
    <>
      <Menu.Root>
        <Tooltip
          title={disabled ? 'Select cell(s) with numeric values before shortening decimals' : 'Shorten decimals'}
        >
          <Menu.Trigger
            className={styles.actionsBarMenuItem()}
            disabled={disabled}
            aria-label="Open shorten decimals menu"
          >
            <Icon data={format_indent_decrease} size={16} />
          </Menu.Trigger>
        </Tooltip>
        <Menu.Portal className="z-10" container={containerRef.current}>
          <Menu.Positioner>
            <Menu.Popup className="menu-popup">
              <Menu.Item className="menu-item" onClick={() => handleShortenDecimals(0)}>
                Round to integer (0 decimals)
              </Menu.Item>
              <Menu.Item className="menu-item" onClick={() => handleShortenDecimals(1)}>
                1 decimal place
              </Menu.Item>
              <Menu.Item className="menu-item" onClick={() => handleShortenDecimals(2)}>
                2 decimal places
              </Menu.Item>
              <Menu.Item className="menu-item" onClick={() => handleShortenDecimals(3)}>
                3 decimal places
              </Menu.Item>
              <Menu.Item className="menu-item" onClick={() => handleShortenDecimals(4)}>
                4 decimal places
              </Menu.Item>
              <Menu.Item className="menu-item" onClick={() => setIsCustomModalOpen(true)}>
                Custom...
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Dialog.Root open={isCustomModalOpen} onOpenChange={setIsCustomModalOpen}>
        <Dialog.Portal container={containerRef.current}>
          <Dialog.Backdrop className="dialog-backdrop" />
          <Dialog.Popup className="dialog-popup-base popup-animation -mt-8 w-96 max-w-[calc(100vw-3rem)] min-w-[40vw]">
            <div className="flex flex-col px-4 pb-4 gap-4">
              <FormTextField
                name="decimalPlaces"
                label="Number of decimal places"
                type="number"
                min={0}
                max={20}
                placeholder="Enter number of decimal places"
                updateValue={(value) => {
                  const parsed = Number.parseInt(value as string, 10)
                  if (!Number.isNaN(parsed) && parsed >= 0) {
                    setCustomDecimalPlaces(parsed)
                  }
                }}
                value={String(customDecimalPlaces)}
              />
              <div className="flex flex-col" aria-label="Rounding mode" role="radiogroup">
                <Typography as="legend" group="input" style={{ marginLeft: '0.5rem' }} variant="label">
                  Rounding mode
                </Typography>
                <div className="flex gap-0.5">
                  <Radio
                    label="Round (nearest)"
                    checked={roundingMode === 'round'}
                    onChange={() => setRoundingMode('round')}
                  />
                  <Radio
                    label="Floor (round down)"
                    checked={roundingMode === 'floor'}
                    onChange={() => setRoundingMode('floor')}
                  />
                  <Radio
                    label="Ceil (round up)"
                    checked={roundingMode === 'ceil'}
                    onChange={() => setRoundingMode('ceil')}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-4">
                <Button variant="outlined" onClick={() => setIsCustomModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCustomConfirm}>Shorten</Button>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
