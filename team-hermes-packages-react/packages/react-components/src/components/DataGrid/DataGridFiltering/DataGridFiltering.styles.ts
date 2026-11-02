import { tv } from 'tailwind-variants/lite'

export const dataGridFiltering = tv({
  slots: {
    root: [
      'grid grid-cols-[1fr_auto] items-center gap-2',
      'text-sm font-medium sticky top-0 z-3 p-1 ',
      'bg-surface border-b-2 border-r border-stroke-subtle',
    ],
    filterButton: [
      'p-0.5 rounded-full shrink-0 disabled:opacity-50',
      'data-[active=true]:bg-theme-success-bg',
      '[&[data-active=true]_svg]:fill-theme-success-fg',
    ],
  },
})
