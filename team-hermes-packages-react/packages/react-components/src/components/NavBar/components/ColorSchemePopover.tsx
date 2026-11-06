import { Popover as BasePopover } from '@base-ui/react'
import { Button, Icon, Tooltip } from '@equinor/eds-core-react'
import { close, dark_mode, invert_colors, sun, type IconData } from '@equinor/eds-icons'
import { useId } from 'react'

import { Popover } from '@/components'
import type { ColorSchemePreference } from '@/hooks'

import { colorSchemePopover } from '../NavBar.styles'

const PREFERENCES = ['auto', 'light', 'dark'] as const satisfies readonly ColorSchemePreference[]

const ICONS: Record<ColorSchemePreference, IconData> = {
  auto: invert_colors,
  light: sun,
  dark: dark_mode,
}

type ColorSchemePopoverProps = {
  colorSchemePreference: ColorSchemePreference
  setColorScheme: (preference: ColorSchemePreference) => void
  /** Accessible name of the trigger and the popover title. */
  label: string
  /** Description of the Auto option. */
  autoDescription: string
  optionLabels: Record<ColorSchemePreference, string>
}

/**
 * The Popover trigger receives its props from Base UI, so the Tooltip has to sit inside the
 * trigger element to wrap the button. It is hidden while the popover is expanded.
 */
function TooltipButton({ tooltip, ...props }: React.ComponentProps<typeof Button> & { tooltip: string }) {
  const isExpanded = props['aria-expanded'] === true || props['aria-expanded'] === 'true'

  return (
    <Tooltip title={tooltip} disabled={isExpanded}>
      <Button {...props} />
    </Tooltip>
  )
}

export function ColorSchemePopover(props: ColorSchemePopoverProps) {
  const { colorSchemePreference, setColorScheme, label, autoDescription, optionLabels } = props
  const titleId = useId()
  const radioName = useId()
  const autoDescriptionId = useId()
  const styles = colorSchemePopover()

  return (
    <Popover
      trigger={
        <TooltipButton tooltip={label} variant="ghost_icon" aria-label={label}>
          <Icon aria-hidden data={ICONS[colorSchemePreference]} size={18} />
        </TooltipButton>
      }
    >
      <div className={styles.root()}>
        <div className={styles.header()}>
          <BasePopover.Title id={titleId} className={styles.title()}>
            {label}
          </BasePopover.Title>
          <BasePopover.Close
            render={
              <Button variant="ghost_icon" aria-label="Close">
                <Icon aria-hidden data={close} size={18} />
              </Button>
            }
          />
        </div>
        <div role="radiogroup" aria-labelledby={titleId} className={styles.options()}>
          {PREFERENCES.map((preference) => (
            <label
              key={preference}
              className={styles.option()}
              title={preference === 'auto' ? autoDescription : undefined}
            >
              <input
                type="radio"
                name={radioName}
                value={preference}
                checked={colorSchemePreference === preference}
                onChange={() => setColorScheme(preference)}
                aria-describedby={preference === 'auto' ? autoDescriptionId : undefined}
                className="sr-only"
              />
              <Icon aria-hidden data={ICONS[preference]} size={24} />
              <span>{optionLabels[preference]}</span>
            </label>
          ))}
        </div>
        <span id={autoDescriptionId} hidden>
          {autoDescription}
        </span>
      </div>
    </Popover>
  )
}
