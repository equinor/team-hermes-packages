import type { Meta, StoryObj } from '@storybook/react-vite'
import { FileUploadInput } from './FileUploadInput'

const meta = {
  title: 'UI/FileUploadInput',
  component: FileUploadInput,
  args: {
    onFileChange: (files) => console.log('Files:', files),
    accept: '.pdf,.docx,.txt',
    multiple: true,
  },
  argTypes: {
    onFileChange: {
      description: 'Callback invoked with the selected or dropped files.',
    },
    accept: {
      description: 'Comma-separated list of accepted file types (MIME types or extensions).',
      control: 'text',
    },
    multiple: {
      description: 'Whether multiple files can be selected at once.',
      control: 'boolean',
      table: {
        defaultValue: { summary: 'undefined' },
      },
    },
  },
} satisfies Meta<typeof FileUploadInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SingleFile: Story = {
  args: {
    multiple: false,
    accept: '.pdf',
  },
}

export const ImageUpload: Story = {
  args: {
    accept: 'image/png,image/jpeg,image/webp',
    multiple: true,
  },
}

export const CustomAcceptMessage: Story = {
  args: {
    accept: 'image/png,image/jpeg,image/webp',
    acceptString: 'PNG, JPEG, WEBP images',
    multiple: true,
  },
}
