import { Button, Icon } from '@equinor/eds-core-react'
import { check_circle_outlined, collapse, comment_chat, error_outlined, warning_outlined } from '@equinor/eds-icons'
import { useState } from 'react'
import { Stack } from '@/components'
import { useDataGridContext } from '../context/DataGridContext'
import { DataGridCommentSection } from './DataGridCommentSection/DataGridCommentSection'
import { DataGridSidebarSection } from './DataGridSidebarSection/DataGridSidebarSection'
import { DataGridValidationSection } from './DataGridValidationSection/DataGridValidationSection'

export const DataGridSidebar = <TData extends Record<string, any>>() => {
  const { table, cellActions, editable, commentConfig } = useDataGridContext<TData>()
  const [collapsed, setCollapsed] = useState<boolean>(false)
  const [minimizeContent, setMinimizeContent] = useState<boolean>(false)

  const hasComments = commentConfig?.enabled

  const validationErrorsAmount = table.options.meta?.validationErrors
    ? Object.keys(table.options.meta.validationErrors).length
    : 0

  const validationWarningsAmount = table.options.meta?.validationWarnings
    ? Object.keys(table.options.meta.validationWarnings)?.length
    : 0

  if (!editable && !hasComments && !validationErrorsAmount && !validationWarningsAmount) return null
  const commentCount = hasComments ? commentConfig.getAllComments().length : 0

  const toggleCollapse = () => {
    if (collapsed) {
      setCollapsed(false)
      setTimeout(() => {
        setMinimizeContent(false)
      }, 300) // Match the transition duration
    } else {
      setMinimizeContent(true)
      setTimeout(() => {
        setCollapsed(true)
      }, 300) // Match the transition duration
    }
  }

  return (
    <div
      className="grid grid-rows-[1fr_auto] shrink-0 w-full h-full max-w-[320px] transition-[max-width] duration-300 overflow-hidden border-l border-stroke-subtle data-[collapsed=true]:max-w-[48px]"
      data-collapsed={collapsed}
      data-testid="data-grid-sidebar"
    >
      <Stack $scrollY>
        {editable && (
          <>
            <DataGridSidebarSection
              label={`Validation Errors (${validationErrorsAmount})`}
              icon={validationErrorsAmount ? error_outlined : check_circle_outlined}
              variant={validationErrorsAmount ? 'danger' : 'success'}
              initiallyOpen
              minimizeContent={minimizeContent}
              toggleContentCallback={toggleCollapse}
            >
              <DataGridValidationSection
                cellSelection={cellActions}
                validationMessages={table.options.meta?.validationErrors || {}}
                type="error"
              />
            </DataGridSidebarSection>
            <DataGridSidebarSection
              label={`Validation Warnings (${validationWarningsAmount})`}
              icon={validationWarningsAmount ? warning_outlined : check_circle_outlined}
              variant={validationWarningsAmount ? 'warning' : 'success'}
              initiallyOpen
              minimizeContent={minimizeContent}
              toggleContentCallback={toggleCollapse}
            >
              <DataGridValidationSection
                cellSelection={cellActions}
                validationMessages={table.options.meta?.validationWarnings || {}}
                type="warning"
              />
            </DataGridSidebarSection>
          </>
        )}
        {hasComments && (
          <DataGridSidebarSection
            label={`Comments (${commentCount})`}
            icon={comment_chat}
            variant={commentCount ? 'info' : 'neutral'}
            initiallyOpen
            minimizeContent={minimizeContent}
            toggleContentCallback={toggleCollapse}
          >
            <DataGridCommentSection commentConfig={commentConfig} cellActions={cellActions} />
          </DataGridSidebarSection>
        )}
      </Stack>
      <Stack $padding={0.5} $alignItems="flex-start" $justifyContent="center" data-testid="sidebar-collapse-button">
        <Button
          variant="ghost_icon"
          className="rotate-180 duration-300 data-[collapsed=true]:rotate-0"
          data-collapsed={collapsed}
          onClick={toggleCollapse}
        >
          <Icon data={collapse} />
        </Button>
      </Stack>
    </div>
  )
}
