import type { Meta, StoryObj } from '@storybook/react-vite'
import type { SortingState } from '@tanstack/react-table'
import { createColumnHelper, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import { useState } from 'react'
import { SortingButton } from './SortingButton'

type ExampleRow = {
  name: string
  submitted: string
  status: string
  priority: number
}

const exampleData: ExampleRow[] = [
  { name: 'Task A', submitted: '2025-01-15', status: 'Open', priority: 1 },
  { name: 'Task B', submitted: '2025-02-20', status: 'Closed', priority: 3 },
  {
    name: 'Task C',
    submitted: '2025-03-10',
    status: 'In Progress',
    priority: 2,
  },
  { name: 'Task D', submitted: '2025-04-05', status: 'Open', priority: 4 },
]

const columnHelper = createColumnHelper<ExampleRow>()

const columns = [
  columnHelper.accessor('name', { header: 'Name', enableSorting: true }),
  columnHelper.accessor('submitted', {
    header: 'Submitted',
    enableSorting: true,
  }),
  columnHelper.accessor('status', { header: 'Status', enableSorting: true }),
  columnHelper.accessor('priority', {
    header: 'Priority',
    enableSorting: true,
  }),
]

function SortingButtonExample() {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data: exampleData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return <SortingButton table={table} />
}

const meta = {
  title: 'TanStack Table/SortingButton',
  component: SortingButton,
  parameters: {
    docs: { toc: true },
  },
} satisfies Meta

export default meta

export const Default: StoryObj = {
  render: () => <SortingButtonExample />,
}
