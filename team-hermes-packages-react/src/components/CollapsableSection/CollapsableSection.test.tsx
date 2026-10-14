import { Accordion } from '@base-ui/react/accordion'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vite-plus/test'
import { CollapsableSection } from './CollapsableSection'

function renderSection(props: Partial<React.ComponentProps<typeof CollapsableSection>> = {}) {
  return render(
    <Accordion.Root>
      <CollapsableSection title="Well" {...props}>
        <p>Panel content</p>
      </CollapsableSection>
    </Accordion.Root>
  )
}

describe('CollapsableSection', () => {
  test('renders the title and toggles content', () => {
    renderSection()
    const trigger = screen.getByRole('button', { name: /Well/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Panel content')).toBeInTheDocument()
  })

  test('shows chip count only when greater than zero', () => {
    const { unmount } = renderSection({ chipCount: 0 })
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    unmount()
    renderSection({ chipCount: 3 })
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  test('shows the stats label', () => {
    renderSection({ statsLabel: '1,234 values' })
    expect(screen.getByText('1,234 values')).toBeInTheDocument()
  })

  test('renders a remove button that calls onRemove', () => {
    const onRemove = vi.fn()
    renderSection({ onRemove })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Well filter' }))
    expect(onRemove).toHaveBeenCalledOnce()
  })

  test('has no remove button without onRemove', () => {
    renderSection()
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  })
})
