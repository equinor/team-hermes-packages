import { tv } from 'tailwind-variants/lite'

export const dataGridHeader = tv({
  slots: {
    headerCell: 'bg-surface border-b-2 border-stroke-subtle text-sm font-medium sticky top-0 z-3',
    headerCellGrid: 'grid grid-cols-[1fr_16px_0.6rem] gap-2 items-center h-full',
    headerCellClickArea: 'h-full w-full p-3 overflow-hidden flex items-center gap-1',
    headerCellResizeHandle: 'border-r-2 border-stroke-subtle h-full pl-2 cursor-col-resize!',
  },
})
