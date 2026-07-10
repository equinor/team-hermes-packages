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
