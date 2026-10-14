import { Accordion } from '@base-ui/react/accordion'
import { Icon } from '@equinor/eds-core-react'
import { chevron_down, close } from '@equinor/eds-icons'
import { Chip } from '../Chip/Chip'

export type CollapsableSectionProps = {
  /** Section heading. Also used as the accordion item value unless `value` is set. */
  title: string
  /** Unique accordion item value. Defaults to `title`. */
  value?: string
  /** Number shown in a chip next to the title, e.g. the count of active selections. Hidden when 0. */
  chipCount?: number
  /** Optional stats label shown after the chip (e.g. "1,234 values"). */
  statsLabel?: string
  children: React.ReactNode
  /** When true, highlights the border with the accent color. */
  isActive?: boolean
  /** When provided, renders a remove (×) button in the header. */
  onRemove?: () => void
}

/**
 * Collapsible facet section. Must be rendered inside a Base UI `Accordion.Root`.
 */
export function CollapsableSection(props: CollapsableSectionProps) {
  const { title, value = title, chipCount = 0, statsLabel, children, onRemove, isActive } = props
  return (
    <Accordion.Item
      value={value}
      data-facet-key={value}
      data-active={isActive || undefined}
      className={`flex flex-col flex-[1_1_auto] min-h-0 group rounded border ${
        isActive ? 'border-theme-accent-fg' : 'border-stroke-subtle'
      }`}
    >
      <Accordion.Header className="flex items-center">
        <Accordion.Trigger className="flex items-center gap-3 flex-1 min-w-0 text-left bg-surface-subtle p-2 cursor-pointer">
          <span className="text-sm font-medium">{title}</span>
          {chipCount > 0 && (
            <Chip fontSize="xs" theme="info">
              {chipCount}
            </Chip>
          )}
          {statsLabel && <span className="text-xs text-secondary">{statsLabel}</span>}
          <Icon
            data={chevron_down}
            size={16}
            aria-hidden
            className="ml-auto group-data-open:rotate-180 transition-transform"
          />
        </Accordion.Trigger>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${title} filter`}
            className="shrink-0 p-2 cursor-pointer text-secondary hover:text-theme-accent-fg"
          >
            <Icon data={close} size={16} />
          </button>
        )}
      </Accordion.Header>
      <Accordion.Panel className="accordion-panel p-2">{children}</Accordion.Panel>
    </Accordion.Item>
  )
}
