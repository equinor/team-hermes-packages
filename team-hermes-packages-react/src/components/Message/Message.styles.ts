import { tv } from 'tailwind-variants/lite'

export const message = tv({
  slots: {
    root: [
      'flex items-center p-4 border rounded gap-3',
      'bg-(--eds-color-border-subtle)/20',
      'border-(--eds-color-border-medium) border-2',
      'text-(--eds-color-text-subtle)',
    ],
    dismiss: [
      'p-1 rounded-2xl border-(--eds-color-border-subtle) text-(--eds-color-text-subtle)',
      'hover:bg-(--eds-color-bg-fill-muted-hover)',
    ],
  },
  variants: {
    fullWidth: {
      true: { root: 'w-full' },
    },
  },
})
