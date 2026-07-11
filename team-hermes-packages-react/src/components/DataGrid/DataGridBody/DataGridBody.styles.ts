import { tv } from 'tailwind-variants/lite'

export const dataGridBody = tv({
  slots: {
    cell: [
      'bg-surface border-b border-r border-stroke-subtle',
      'h-full flex items-center justify-between gap-2 relative shrink-0',
      'text-sm truncate overflow-hidden align-middle font-normal cursor-default',
      'data-[padded=true]:p-2',
      'data-[selected=true]:bg-[color-mix(in_oklab,var(--eds-color-border-info-subtle)_30%,transparent)]',
      'data-[selected=true]:[outline:1px_solid_var(--eds-color-border-info-subtle)]',
      'data-[selected=true]:[outline-offset:-1px]',
      'data-[warning=true]:text-(--eds-color-bg-warning-fill-emphasis-default)',
      'data-[error=true]:text-(--eds-color-bg-danger-fill-emphasis-default)',
    ],
  },
})
