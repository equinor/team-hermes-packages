import { Button } from '@equinor/eds-core-react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ConfirmOperationDialog } from './ConfirmOperationDialog'

const meta = {
  title: 'Feature Components/ConfirmOperationDialog',
  component: ConfirmOperationDialog,
  args: {
    trigger: <Button>Open dialog</Button>,
    title: 'Delete item?',
    description: 'This action cannot be undone.',
    onConfirm: () => {},
  },
  argTypes: {
    title: {
      description: 'The title displayed at the top of the dialog.',
      control: 'text',
    },
    description: {
      description: 'Optional description text below the title.',
      control: 'text',
    },
    confirmButtonText: {
      description: 'Label for the confirm button.',
      control: 'text',
      table: { defaultValue: { summary: 'Yes, confirm' } },
    },
    cancelButtonText: {
      description: 'Label for the cancel button.',
      control: 'text',
      table: { defaultValue: { summary: 'Cancel' } },
    },
    confirmButtonColor: {
      description: 'Color variant of the confirm button.',
      control: 'select',
      options: ['primary', 'danger'],
      table: { defaultValue: { summary: 'danger' } },
    },
    onConfirm: {
      description: 'Callback invoked when the confirm button is clicked.',
    },
    operationIsLoading: {
      description: 'Shows a loading spinner on the confirm button while an operation is in progress.',
      control: 'boolean',
    },
    trigger: {
      description: 'The element that opens the dialog on click. Used in uncontrolled mode.',
      control: false,
    },
    isOpen: {
      description: 'Controls the open state of the dialog. Used in controlled mode.',
      control: false,
    },
    setIsOpen: {
      description: 'Callback to update the open state. Used in controlled mode.',
      control: false,
    },
  },
} satisfies Meta<typeof ConfirmOperationDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithCustomLabels: Story = {
  args: {
    title: 'Discard changes?',
    description: 'Any unsaved changes will be lost.',
    confirmButtonText: 'Discard',
    cancelButtonText: 'Keep editing',
  },
}

export const PrimaryConfirm: Story = {
  args: {
    title: 'Submit form?',
    description: 'Your data will be saved.',
    confirmButtonColor: 'primary',
    confirmButtonText: 'Submit',
  },
}

export const Loading: Story = {
  args: {
    operationIsLoading: true,
  },
}

export const NoDescription: Story = {
  args: {
    title: 'Are you sure?',
    description: undefined,
  },
}
