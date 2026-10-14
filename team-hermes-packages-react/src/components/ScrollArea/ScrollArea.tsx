import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area'
import type { ComponentProps, ReactNode } from 'react'

export type ScrollAreaProps = ComponentProps<typeof BaseScrollArea.Root> & {
  children: ReactNode
}

/**
 * Scrollable container with a thin overlay scrollbar that appears on hover or while scrolling.
 * Fills its parent, so the parent needs a bounded height.
 */
export function ScrollArea({ children, className, ...props }: ScrollAreaProps) {
  return (
    <BaseScrollArea.Root
      className={(state) => `h-full w-full ${(typeof className === 'function' ? className(state) : className) ?? ''}`}
      {...props}
    >
      <BaseScrollArea.Viewport className="h-full w-full">
        <BaseScrollArea.Content className="flex flex-col">{children}</BaseScrollArea.Content>
      </BaseScrollArea.Viewport>
      <BaseScrollArea.Scrollbar className="bg-surface-subtle m-1 flex w-1 justify-center rounded-sm opacity-0 transition-opacity duration-150 pointer-events-none data-hovering:pointer-events-auto data-hovering:opacity-100 data-scrolling:pointer-events-auto data-scrolling:opacity-100 data-scrolling:duration-0">
        <BaseScrollArea.Thumb className="w-full rounded-sm bg-theme-neutral-fg" />
      </BaseScrollArea.Scrollbar>
    </BaseScrollArea.Root>
  )
}
