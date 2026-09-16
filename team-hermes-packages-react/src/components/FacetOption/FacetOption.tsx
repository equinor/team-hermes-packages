import { Icon } from '@equinor/eds-core-react'
import { checkbox, checkbox_outline } from '@equinor/eds-icons'

type FacetOptionProps = {
  label: string
  checked: boolean
  count?: number
  dimmed?: boolean
  disabled?: boolean
  indented?: boolean
  onChange: (checked: boolean) => void
}

export function FacetOption(props: FacetOptionProps) {
  const { label, checked, count, dimmed, indented, disabled, onChange } = props

  return (
    <label
      className={`flex shrink-0 relative cursor-pointer items-center gap-1 py-1.5 px-3 rounded has-[input:disabled]:cursor-not-allowed hover:bg-surface-hover overflow-hidden whitespace-pre-wrap focus-within:outline-(--focus-outline-color) focus-within:outline-2 focus-within:outline-dashed ${dimmed ? 'opacity-50' : ''} ${indented ? 'pl-8!' : ''}`}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <Icon
        data={checked ? checkbox : checkbox_outline}
        size={18}
        color="var(--color-theme-accent-fg)"
        aria-hidden
        className="shrink-0"
      />
      <span className="flex-1 text-sm break-all">{label}</span>
      {count !== undefined && <span className="text-xs">{count.toLocaleString()}</span>}
    </label>
  )
}
