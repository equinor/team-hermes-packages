import { fireEvent, render, screen } from '@testing-library/react'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import { describe, expect, test } from 'vite-plus/test'
import { FinderExample } from './FinderExample'

const wait = { timeout: 4000 }

function renderExample() {
  return render(<FinderExample />, { wrapper: withNuqsTestingAdapter({ hasMemory: true }) })
}

describe('FinderExample', () => {
  test('loads results and narrows them when a term is selected', async () => {
    renderExample()
    expect(await screen.findByText('80 results', {}, wait)).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('checkbox')[0])

    expect(await screen.findByText(/^\d+ results$/, {}, wait)).not.toHaveTextContent('80 results')
    expect(screen.getByText(/country eq/)).toBeInTheDocument()
  }, 15000)

  test('switching view changes the data and pinned facets', async () => {
    renderExample()
    await screen.findByText('80 results', {}, wait)

    fireEvent.click(screen.getByRole('button', { name: 'Reports' }))

    expect(await screen.findByText('60 results', {}, wait)).toBeInTheDocument()
    expect(screen.getAllByText('report type').length).toBeGreaterThan(0)
  }, 15000)
})
