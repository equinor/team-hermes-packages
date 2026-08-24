import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { AttributeType } from '@/shared/types'
import { DataGrid } from './DataGrid'
import { useDataGrid } from './useDataGrid'

// ── Sample data types ────────────────────────────────────────────

type WellSample = {
  uid: string
  name: string
  depth: number
  porosity: number
  status: string
  date: string
}

type NestedRow = {
  uid: string
  name: string
  location: {
    site: string
    area: string
  }
  measurement: {
    value: number
    unit: string
  }
}

// ── Sample datasets ──────────────────────────────────────────────

const wellSamples: WellSample[] = [
  { uid: '1', name: 'Sample A', depth: 1200.567, porosity: 0.15, status: 'Approved', date: '2026-01-15' },
  { uid: '2', name: 'Sample B', depth: 1350.891, porosity: 0.22, status: 'Pending', date: '2026-02-20' },
  { uid: '3', name: 'Sample C', depth: 980.123, porosity: 0.31, status: 'Approved', date: '2026-03-10' },
  { uid: '4', name: 'Sample D', depth: 2100.456, porosity: 0.08, status: 'Rejected', date: '2026-04-05' },
  { uid: '5', name: 'Sample E', depth: 1575.234, porosity: 0.19, status: 'Pending', date: '2026-05-12' },
  { uid: '6', name: 'Sample F', depth: 890.678, porosity: 0.27, status: 'Approved', date: '2026-06-01' },
  { uid: '7', name: 'Sample G', depth: 1680.345, porosity: 0.14, status: 'Approved', date: '2026-06-18' },
  { uid: '8', name: 'Sample H', depth: 2250.789, porosity: 0.09, status: 'Rejected', date: '2026-07-02' },
]

const nestedData: NestedRow[] = [
  {
    uid: '1',
    name: 'Well-01',
    location: { site: 'North Sea', area: 'Block A' },
    measurement: { value: 42.5, unit: 'm' },
  },
  {
    uid: '2',
    name: 'Well-02',
    location: { site: 'North Sea', area: 'Block B' },
    measurement: { value: 38.1, unit: 'm' },
  },
  {
    uid: '3',
    name: 'Well-03',
    location: { site: 'Barents Sea', area: 'Block C' },
    measurement: { value: 55.3, unit: 'm' },
  },
]

// ── Column definitions ───────────────────────────────────────────

const defaultColumns: ColumnDef<WellSample, any>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    meta: { dataType: AttributeType.TEXT, editable: true, isSortable: true },
  },
  {
    id: 'depth',
    accessorKey: 'depth',
    header: 'Depth (m)',
    meta: { dataType: AttributeType.NUMBER, editable: true, unit: 'm', isSortable: true },
  },
  {
    id: 'porosity',
    accessorKey: 'porosity',
    header: 'Porosity',
    meta: { dataType: AttributeType.NUMBER, editable: true, isSortable: true },
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    meta: {
      dataType: AttributeType.TEXT,
      editable: true,
      filterVariant: 'select' as const,
      filterOptions: [
        { label: 'Approved', value: 'Approved' },
        { label: 'Pending', value: 'Pending' },
        { label: 'Rejected', value: 'Rejected' },
      ],
      options: [
        { label: 'Approved', value: 'Approved' },
        { label: 'Pending', value: 'Pending' },
        { label: 'Rejected', value: 'Rejected' },
      ],
      isSortable: true,
    },
  },
  {
    id: 'date',
    accessorKey: 'date',
    header: 'Date',
    meta: { dataType: AttributeType.DATE_STRING, editable: true, isSortable: true },
  },
]

const readOnlyColumns: ColumnDef<WellSample, any>[] = defaultColumns.map((c) => ({
  ...c,
  meta: { ...c.meta, editable: false },
}))

const nestedColumns: ColumnDef<NestedRow, any>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    meta: { dataType: AttributeType.TEXT, editable: true },
  },
  {
    id: 'location_site',
    accessorKey: 'location.site',
    header: 'Site',
    meta: { dataType: AttributeType.TEXT, editable: true },
  },
  {
    id: 'location_area',
    accessorKey: 'location.area',
    header: 'Area',
    meta: { dataType: AttributeType.TEXT, editable: true },
  },
  {
    id: 'measurement_value',
    accessorKey: 'measurement.value',
    header: 'Measurement',
    meta: { dataType: AttributeType.NUMBER, editable: true, unit: 'm' },
  },
  {
    id: 'measurement_unit',
    accessorKey: 'measurement.unit',
    header: 'Unit',
    meta: { dataType: AttributeType.TEXT, editable: false },
  },
]

// ── Reusable wrapper ─────────────────────────────────────────────

function DataGridStory(props: {
  data?: WellSample[]
  columns?: ColumnDef<WellSample, any>[]
  editable?: boolean
  enableAddRows?: boolean
  enableRemoveRows?: boolean
  filterable?: boolean
  enableRowSelection?: boolean
  deletionStrategy?: 'remove' | 'nullify'
  validationErrors?: Record<string, string>
  validationWarnings?: Record<string, string>
}) {
  const {
    data: initialData = wellSamples,
    columns = defaultColumns,
    editable = false,
    enableAddRows = false,
    enableRemoveRows = false,
    filterable = true,
    enableRowSelection = false,
    deletionStrategy = 'remove',
    validationErrors,
    validationWarnings,
  } = props

  const [data, setData] = useState(initialData)

  const { table } = useDataGrid({
    data,
    columns,
    getRowId: (row) => row.uid,
    enableValidationColumn: true,
    meta: {
      setData,
      validationErrors,
      validationWarnings,
      defaultRowFactory: () => ({
        uid: crypto.randomUUID(),
        name: '',
        depth: 0,
        porosity: 0,
        status: 'Pending',
        date: new Date().toISOString().slice(0, 10),
      }),
    },
  })

  return (
    <div style={{ height: 500 }}>
      <DataGrid
        table={table}
        editable={editable}
        enableAddRows={enableAddRows}
        enableRemoveRows={enableRemoveRows}
        filterable={filterable}
        enableRowSelection={enableRowSelection}
        deletionStrategy={deletionStrategy}
      />
    </div>
  )
}

function NestedDataGridStory() {
  const [data, setData] = useState(nestedData)

  const { table } = useDataGrid({
    data,
    columns: nestedColumns,
    getRowId: (row) => row.uid,
    meta: { setData },
  })

  return (
    <div style={{ height: 400 }}>
      <DataGrid table={table} editable filterable />
    </div>
  )
}

// ── Storybook meta ───────────────────────────────────────────────

const meta = {
  title: 'Feature Components/DataGrid',
  component: DataGrid,
  parameters: {
    docs: { page: undefined },
    layout: 'fullscreen',
  },
  argTypes: {
    table: { control: false, description: 'TanStack Table instance.' },
    editable: { control: 'boolean', description: 'Enables cell editing, paste, and delete.' },
    enableAddRows: { control: 'boolean', description: 'Shows the "Add row" button in the actions bar.' },
    enableRemoveRows: { control: 'boolean', description: 'Allows deleting rows via context menu.' },
    filterable: { control: 'boolean', description: 'Shows the filter row below the header.' },
    enableRowSelection: { control: 'boolean', description: 'Adds row selection checkboxes.' },
    deletionStrategy: {
      control: 'select',
      options: ['remove', 'nullify'],
      description: 'How cell deletion works: `remove` deletes the property, `nullify` sets it to null.',
    },
    loadingStateConfig: { control: 'object', description: 'Loading and skeleton state configuration.' },
    commentConfig: {
      control: false,
      description: 'Comment system configuration object (contains callbacks/components).',
    },
    onArrayCellClick: { control: false, description: 'Callback when an array-type cell is clicked.' },
  },
} satisfies Meta<typeof DataGrid>

export default meta
type Story = StoryObj<Meta<typeof DataGrid>>

// ── Stories ──────────────────────────────────────────────────────

export const Default: Story = {
  render: () => <DataGridStory />,
}

export const Editable: Story = {
  render: () => <DataGridStory editable enableAddRows enableRemoveRows />,
}

export const WithFiltering: Story = {
  render: () => <DataGridStory filterable />,
}

export const WithRowSelection: Story = {
  render: () => <DataGridStory enableRowSelection />,
}

export const WithValidation: Story = {
  render: () => (
    <DataGridStory
      editable
      validationErrors={{
        '[0].depth': 'Depth exceeds maximum limit',
        '[3].porosity': 'Porosity must be between 0 and 1',
      }}
      validationWarnings={{
        '[1].status': 'Status is still pending review',
      }}
    />
  ),
}

export const NestedValues: Story = {
  render: () => <NestedDataGridStory />,
}

export const ReadOnly: Story = {
  render: () => <DataGridStory columns={readOnlyColumns as ColumnDef<WellSample, any>[]} filterable={false} />,
}
