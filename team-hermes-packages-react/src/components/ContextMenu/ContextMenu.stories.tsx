import { copy, delete_to_trash, edit, external_link, paste, settings } from '@equinor/eds-icons'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ContextMenu } from './ContextMenu'

const meta = {
  title: 'UI/ContextMenu',
  component: ContextMenu,
  args: {
    trigger: (
      <div className="border border-stroke-subtle border-dashed rounded text-center px-16 py-8">Right-click here</div>
    ),
    items: [
      { label: 'Edit', icon: edit, onClick: () => {} },
      { label: 'Copy', icon: copy, shortcut: '⌘C', onClick: () => {} },
      { label: 'Paste', icon: paste, shortcut: '⌘V', onClick: () => {} },
      { label: 'Delete', icon: delete_to_trash, onClick: () => {} },
    ],
  },
  argTypes: {
    items: {
      description:
        'Array of menu items to display. Each item can have a label, icon, shortcut, onClick handler, subItems, and hidden flag.',
      control: false,
    },
    trigger: {
      description: 'The element that opens the context menu on right-click. Used in uncontrolled mode.',
      control: false,
    },
    container: {
      description: 'Ref to a DOM element used as the portal container for the menu.',
      control: false,
    },
    open: {
      description: 'Controls the open state of the menu. Used in controlled mode.',
      control: false,
    },
    setIsOpen: {
      description: 'Callback to update the open state. Used in controlled mode.',
      control: false,
    },
    triggerId: {
      description: 'ID of the trigger element. Required in controlled mode for accessibility.',
      control: false,
    },
    triggerRef: {
      description: 'Ref to the trigger element for positioning. Required in controlled mode.',
      control: false,
    },
  },
} satisfies Meta<typeof ContextMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithIcons: Story = {
  args: {
    items: [
      { label: 'Edit', icon: edit, onClick: () => {} },
      { label: 'Copy', icon: copy, onClick: () => {} },
      { label: 'Open in new tab', icon: external_link, onClick: () => {} },
      { label: 'Settings', icon: settings, onClick: () => {} },
    ],
  },
}

export const WithShortcuts: Story = {
  args: {
    items: [
      { label: 'Copy', icon: copy, shortcut: '⌘C', onClick: () => {} },
      { label: 'Paste', icon: paste, shortcut: '⌘V', onClick: () => {} },
      { label: 'Delete', icon: delete_to_trash, shortcut: '⌫', onClick: () => {} },
    ],
  },
}

export const WithSubmenus: Story = {
  args: {
    items: [
      { label: 'Edit', icon: edit, onClick: () => {} },
      {
        label: 'More options',
        icon: settings,
        subItems: [
          { label: 'Option A', onClick: () => {} },
          { label: 'Option B', onClick: () => {} },
          { label: 'Option C', shortcut: '⌘⇧C', onClick: () => {} },
        ],
      },
      { label: 'Delete', icon: delete_to_trash, onClick: () => {} },
    ],
  },
}

export const WithHiddenItems: Story = {
  args: {
    items: [
      { label: 'Edit', icon: edit, onClick: () => {} },
      { label: 'Copy', icon: copy, onClick: () => {} },
      { label: 'Admin only', hidden: true, onClick: () => {} },
      { label: 'Delete', icon: delete_to_trash, onClick: () => {} },
    ],
  },
}
