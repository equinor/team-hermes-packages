import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ApiError } from '@/shared/platform/api'
import { ErrorPanel } from './ErrorPanel'

const meta = {
  title: 'UI/ErrorPanel',
  component: ErrorPanel,
  argTypes: {
    error: { control: false },
  },
} satisfies Meta<typeof ErrorPanel>

export default meta
type Story = StoryObj<typeof meta>

const networkError: ApiError = {
  kind: 'network',
  traceId: 'abc-123-def-456',
  message: 'Unable to reach the server. Check your connection and try again.',
}

const serverError: ApiError = {
  kind: 'http',
  status: 500,
  traceId: '9f2e-4a1b-c8d7-3e6f',
  message: 'An internal server error occurred.',
}

const notFoundError: ApiError = {
  kind: 'http',
  status: 404,
  traceId: 'f1a2-b3c4-d5e6-7890',
  message: 'The requested resource could not be found.',
}

const forbiddenError: ApiError = {
  kind: 'http',
  status: 403,
  traceId: 'a1b2-c3d4-e5f6-7890',
  message: 'You do not have permission to access this resource.',
}

const parseError: ApiError = {
  kind: 'parse',
  traceId: 'd4e5-f6a7-b8c9-0123',
  message: 'The server returned a response that could not be parsed.',
}

export const NetworkError: Story = {
  args: { error: networkError },
}

export const ServerError: Story = {
  args: { error: serverError },
}

export const NotFound: Story = {
  args: { error: notFoundError },
}

export const Forbidden: Story = {
  args: { error: forbiddenError },
}

export const ParseError: Story = {
  args: { error: parseError },
}

export const CustomHttpStatus: Story = {
  args: {
    error: {
      kind: 'http',
      status: 418,
      traceId: 'tea-pot-trace',
      message: "I'm a teapot.",
    } satisfies ApiError,
  },
}

export const UnknownError: Story = {
  args: { error: new Error('Something unexpected happened') },
}

export const AllVariants: Story = {
  args: { error: networkError },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <ErrorPanel error={networkError} />
      <ErrorPanel error={serverError} />
      <ErrorPanel error={notFoundError} />
      <ErrorPanel error={forbiddenError} />
      <ErrorPanel error={parseError} />
      <ErrorPanel error={new Error('Something unexpected happened')} />
    </div>
  ),
}
