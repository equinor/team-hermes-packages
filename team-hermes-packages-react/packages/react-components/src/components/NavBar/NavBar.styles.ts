import { tv } from 'tailwind-variants/lite'

export const navbar = tv({
  slots: {
    root: 'min-w-max flex py-0.5 px-8 justify-between items-center bg-surface border-b border-stroke-subtle',
    trigger:
      'flex items-center relative justify-center gap-2 p-2 rounded bg-surface select-none hover:bg-surface-hover data-popup-open:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:relative',
    content: 'p-2 z-10',
    chevron: 'ml-2 transition-transform duration-200 data-popup-open:rotate-180',
  },
  variants: {
    active: {
      true: {
        trigger:
          "after:content-[''] after:absolute after:bottom-[2px] after:left-[calc(50%-1rem)] after:w-[2rem] after:h-[2px] after:bg-theme-success-fg after:rounded",
      },
    },
  },
})

export const colorSchemePopover = tv({
  slots: {
    root: 'flex flex-col gap-4 p-2',
    header: 'flex items-center justify-between gap-6',
    title: 'm-0 text-lg font-medium text-primary',
    options: 'flex gap-3',
    option: [
      'flex size-22 cursor-pointer flex-col items-center justify-center gap-2 rounded border border-stroke-medium bg-surface text-sm text-primary transition-colors select-none',
      'hover:bg-surface-hover',
      'has-checked:border-(--eds-color-border-accent-strong) has-checked:bg-(--eds-color-bg-accent-fill-muted-default) has-checked:text-(--eds-color-text-accent-strong)',
      'has-checked:hover:bg-(--eds-color-bg-accent-fill-muted-hover)',
      'has-focus-visible:outline-2 has-focus-visible:outline-dashed has-focus-visible:outline-(--focus-outline-color) has-focus-visible:outline-offset-2',
    ],
  },
})
