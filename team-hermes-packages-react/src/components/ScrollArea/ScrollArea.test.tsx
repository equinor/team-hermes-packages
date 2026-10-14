import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vite-plus/test'
import { ScrollArea } from './ScrollArea'

describe('ScrollArea', () => {
  test('renders its children', () => {
    render(
      <ScrollArea>
        <p>Hello</p>
      </ScrollArea>
    )
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  test('merges className and forwards props to the root', () => {
    render(
      <ScrollArea className="custom" data-testid="root">
        <p>Hello</p>
      </ScrollArea>
    )
    const root = screen.getByTestId('root')
    expect(root).toHaveClass('h-full', 'w-full', 'custom')
  })
})
