import { tv } from 'tailwind-variants/lite'

export const dataGridActionsBar = tv({
  slots: {
    actionsBarMenuItem: [
      'flex items-center gap-2 p-3 text-sm hover:bg-surface-hover',
      'border-r border-stroke-subtle last:border-0',
      'cursor-pointer data-disabled:pointer-events-none data-disabled:opacity-60',
      '[&_svg]:text-(--text-secondary-color)',
    ],
  },
})
