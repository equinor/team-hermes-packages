import { Tabs } from '@base-ui/react/tabs'
import type { ComponentProps } from 'react'

type TabValue = Tabs.Tab.Value

interface TabsRootProps extends Omit<ComponentProps<typeof Tabs.Root>, 'defaultValue'> {
  value: TabValue
  onValueChange: (value: TabValue, eventDetails: Tabs.Root.ChangeEventDetails) => void
}

function TabsRoot({ children, ...props }: TabsRootProps) {
  return <Tabs.Root {...props}>{children}</Tabs.Root>
}

function TabsList({ children, className, ...props }: ComponentProps<typeof Tabs.List>) {
  const tabsListClassName = 'relative flex gap-4'
  const resolvedClassName: ComponentProps<typeof Tabs.List>['className'] =
    typeof className === 'function'
      ? (state) => `${tabsListClassName} ${className(state) ?? ''}`
      : `${tabsListClassName} ${className ?? ''}`

  return (
    <Tabs.List className={resolvedClassName} {...props}>
      {children}
      <Tabs.Indicator className="absolute bottom-0 left-0 block h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) rounded-xl bg-theme-accent-fg transition-all duration-200 ease-in-out" />
    </Tabs.List>
  )
}

function Tab({ children, className, ...props }: ComponentProps<typeof Tabs.Tab>) {
  const tabClassName =
    'cursor-pointer text-sm py-2 px-3 whitespace-nowrap select-none rounded-xl bg-theme-neutral-bg hover:text-(--theme-accent-fg) focus-visible:outline-(--focus-outline) focus-visible:outline-offset-2 data-active:text-theme-accent-bg'
  const resolvedClassName: ComponentProps<typeof Tabs.Tab>['className'] =
    typeof className === 'function'
      ? (state) => `${tabClassName} ${className(state) ?? ''}`
      : `${tabClassName} ${className ?? ''}`

  return (
    <Tabs.Tab className={resolvedClassName} {...props}>
      <span className="relative z-2">{children}</span>
    </Tabs.Tab>
  )
}

function TabPanel({ children, ...props }: ComponentProps<typeof Tabs.Panel>) {
  return <Tabs.Panel {...props}>{children}</Tabs.Panel>
}

export { TabsRoot, TabsList, Tab, TabPanel }
export type { TabValue }
