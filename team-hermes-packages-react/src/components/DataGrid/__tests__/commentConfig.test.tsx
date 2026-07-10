import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Mock to break circular dependency: @/hooks → useFilters → @/common/components → DataGridCell → FilterDialog.utils → @/hooks
vi.mock('@/common/components/FilterDialog/FilterDialog.utils', () => ({}))

import type { CellActions } from '../context/DataGridContext'
import { DataGridCommentSection } from '../DataGridSidebar/DataGridCommentSection/DataGridCommentSection'
import { createTestCommentConfig, testComments } from './testUtils'

function createMockCellActions(overrides: Partial<CellActions> = {}): CellActions {
  return {
    selectedCells: [],
    isCellSelected: () => false,
    isRowSelected: () => false,
    handleCellMouseDown: vi.fn(),
    handleCellMouseOver: vi.fn(),
    handleCellMouseUp: vi.fn(),
    clearSelection: vi.fn(),
    setSelectedCellsByRow: vi.fn(),
    setSelectedCellsByColumn: vi.fn(),
    selectErrorCell: vi.fn(),
    selectedErrorIndex: -1,
    selectedWarningIndex: -1,
    rowHasErrors: () => false,
    rowHasWarnings: () => false,
    scrollToRow: vi.fn(),
    navigateToCell: vi.fn(),
    activeEditingCell: null,
    setActiveEditingCell: vi.fn(),
    editingCellValue: undefined,
    setEditingCellValue: vi.fn(),
    isCellEditing: () => false,
    isCellCommenting: () => false,
    handleDoubleClick: vi.fn(),
    setCurrentSelectedCellAsEditingCell: vi.fn(),
    setCommentingCell: vi.fn(),
    isCopied: false,
    isCellCopied: () => false,
    copySelectedCells: vi.fn(),
    pasteSelectedCells: vi.fn(),
    deleteSelectedCells: vi.fn(),
    shortenDecimals: vi.fn(),
    handleCellsKeyDown: vi.fn(),
    ...overrides,
  }
}

describe('DataGridCommentSection', () => {
  it('should render individual comments', () => {
    const commentConfig = createTestCommentConfig()
    const cellActions = createMockCellActions()

    render(<DataGridCommentSection commentConfig={commentConfig} cellActions={cellActions} />)

    const previews = screen.getAllByTestId('comment-preview')
    expect(previews).toHaveLength(3)
  })

  it('should render nothing when there are no comments', () => {
    const commentConfig = createTestCommentConfig([])
    const cellActions = createMockCellActions()

    const { container } = render(<DataGridCommentSection commentConfig={commentConfig} cellActions={cellActions} />)

    expect(container.innerHTML).toBe('')
  })

  it('should navigate to cell on click', () => {
    const navigateToCell = vi.fn()
    const commentConfig = createTestCommentConfig()
    const cellActions = createMockCellActions({ navigateToCell })

    render(<DataGridCommentSection commentConfig={commentConfig} cellActions={cellActions} />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])

    // First comment is at "0.depth"
    expect(navigateToCell).toHaveBeenCalledWith('0', 'depth')
  })

  it('should navigate to correct cell for each comment', () => {
    const navigateToCell = vi.fn()
    const commentConfig = createTestCommentConfig()
    const cellActions = createMockCellActions({ navigateToCell })

    render(<DataGridCommentSection commentConfig={commentConfig} cellActions={cellActions} />)

    const buttons = screen.getAllByRole('button')

    // Third comment is at "2.porosity"
    fireEvent.click(buttons[2])
    expect(navigateToCell).toHaveBeenCalledWith('2', 'porosity')
  })

  it('should pass correct props to CommentPreview', () => {
    const commentConfig = createTestCommentConfig()
    const cellActions = createMockCellActions()

    render(<DataGridCommentSection commentConfig={commentConfig} cellActions={cellActions} />)

    const previews = screen.getAllByTestId('comment-preview')
    expect(previews[0]).toHaveAttribute('data-path', '0.depth')
    expect(previews[0]).toHaveTextContent('Check this depth value')

    expect(previews[2]).toHaveAttribute('data-path', '2.porosity')
    expect(previews[2]).toHaveTextContent('Porosity seems high')
  })
})

describe('DataGridCommentConfig', () => {
  it('getComments should return matching comments for a cell', () => {
    const config = createTestCommentConfig()

    const result = config.getComments('0', 'depth')
    expect(result).toHaveLength(2)
    expect(result[0].uid).toBe('c1')
    expect(result[1].uid).toBe('c2')
  })

  it('getComments should return empty array for cell without comments', () => {
    const config = createTestCommentConfig()

    const result = config.getComments('1', 'name')
    expect(result).toEqual([])
  })

  it('getAllComments should return all comments', () => {
    const config = createTestCommentConfig()

    expect(config.getAllComments()).toHaveLength(3)
  })

  it('getCommentCellPath should return the location', () => {
    const config = createTestCommentConfig()
    const comment = testComments[0]

    expect(config.getCommentCellPath(comment)).toBe('0.depth')
  })

  it('rowHasComments should return true for rows with comments', () => {
    const config = createTestCommentConfig()

    expect(config.rowHasComments('0')).toBe(true)
    expect(config.rowHasComments('1')).toBe(false)
    expect(config.rowHasComments('2')).toBe(true)
  })
})
