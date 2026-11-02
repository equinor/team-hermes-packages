import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Tab, TabPanel, TabsList, TabsRoot, type TabValue } from './Tabs'

const tabs = [
  { value: 'overview', label: 'Overview' },
  { value: 'activity', label: 'Activity' },
  { value: 'settings', label: 'Settings' },
]

function TabsExample({ initialValue = 'overview' }: { initialValue?: TabValue }) {
  const [value, setValue] = useState<TabValue>(initialValue)

  return (
    <TabsRoot value={value} onValueChange={(nextValue) => setValue(nextValue)}>
      <TabsList aria-label="Project sections">
        {tabs.map((tab) => (
          <Tab key={tab.value} value={tab.value}>
            {tab.label}
          </Tab>
        ))}
      </TabsList>

      <div className="mt-4 rounded border border-stroke-subtle p-4 text-sm text-(--theme-fg)">
        <TabPanel value="overview">Project overview and key details are shown here.</TabPanel>
        <TabPanel value="activity">Recent project activity and status changes are shown here.</TabPanel>
        <TabPanel value="settings">Project settings and configuration options are shown here.</TabPanel>
      </div>
    </TabsRoot>
  )
}

const meta = {
  title: 'UI/Tabs',
  component: TabsRoot,
  args: {
    value: 'overview',
    onValueChange: () => {},
  },
  argTypes: {
    value: {
      description: 'Currently selected tab value. Tabs are controlled by the consumer.',
      control: false,
    },
    onValueChange: {
      description: 'Called when the selected tab changes.',
      control: false,
    },
    children: {
      description: 'TabsList, Tab, and TabPanel elements that make up the tab set.',
      control: false,
    },
  },
  render: () => <TabsExample />,
} satisfies Meta<typeof TabsRoot>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ActiveActivityTab: Story = {
  render: () => <TabsExample initialValue="activity" />,
}

export const CustomPanelContent: Story = {
  render: () => {
    const [value, setValue] = useState<TabValue>('summary')

    return (
      <TabsRoot value={value} onValueChange={(nextValue) => setValue(nextValue)}>
        <TabsList aria-label="Asset details">
          <Tab value="summary">Summary</Tab>
          <Tab value="documents">Documents</Tab>
          <Tab value="history">History</Tab>
        </TabsList>

        <div className="mt-4 grid gap-3 text-sm text-(--theme-fg)">
          <TabPanel value="summary">
            <dl className="grid max-w-md grid-cols-[7rem_1fr] gap-2">
              <dt className="text-(--theme-neutral-fg)">Status</dt>
              <dd>Ready for review</dd>
              <dt className="text-(--theme-neutral-fg)">Owner</dt>
              <dd>Team Hermes</dd>
            </dl>
          </TabPanel>
          <TabPanel value="documents">Three documents are attached to this asset.</TabPanel>
          <TabPanel value="history">The latest update was registered today.</TabPanel>
        </div>
      </TabsRoot>
    )
  },
}

export const ScrollableList: Story = {
  render: () => {
    const [value, setValue] = useState<TabValue>('first')

    return (
      <TabsRoot value={value} onValueChange={(nextValue) => setValue(nextValue)}>
        <TabsList aria-label="Long tab list" className="max-w-80 overflow-x-auto pb-1">
          <Tab value="first">First tab</Tab>
          <Tab value="second">Second tab</Tab>
          <Tab value="third">Third tab</Tab>
          <Tab value="fourth">Fourth tab</Tab>
          <Tab value="fifth">Fifth tab</Tab>
        </TabsList>
        <TabPanel value={value} className="mt-4 text-sm text-(--theme-fg)">
          Content for the selected tab.
        </TabPanel>
      </TabsRoot>
    )
  },
}
