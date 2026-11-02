import { Accordion } from '@base-ui/react'
import { CircularProgress, Icon, Typography } from '@equinor/eds-core-react'
import { chevron_down, new_alert } from '@equinor/eds-icons'
import { Chip } from '../Chip/Chip'
import { IconContainer } from '../IconContainer/IconContainer'
import { Message } from '../Message/Message'
import { ReleaseCard } from './ReleaseCard'
import type { WhatsNewPanelProps } from './WhatsNewPanel.types'
import { isRecentRelease } from './WhatsNewPanel.utils'

const PANEL_VALUE = 'whats-new'

/**
 * Collapsible homepage panel that highlights the latest release and links to
 * the full release notes. Flags the release with a "New release" chip when it
 * is younger than `newReleaseThresholdDays`.
 */
export function WhatsNewPanel(props: WhatsNewPanelProps) {
  const {
    appName,
    releases,
    releaseNotesHref,
    LinkComponent,
    isLoading = false,
    error,
    newReleaseThresholdDays = 3,
    defaultOpen = false,
  } = props

  const latestRelease = releases[0]
  const hasNewRelease = !!latestRelease && isRecentRelease(latestRelease.date, newReleaseThresholdDays)

  return (
    <Accordion.Root defaultValue={defaultOpen ? [PANEL_VALUE] : []}>
      <Accordion.Item
        value={PANEL_VALUE}
        className="bg-surface text-primary shadow-(--box-elevation) rounded overflow-hidden flex flex-col"
      >
        <Accordion.Header>
          <Accordion.Trigger className="flex items-center gap-3 px-6 py-4 w-full text-left hover:bg-surface-hover group">
            <IconContainer icon={new_alert} iconSize={18} size={36} variant="accent" />
            <Typography variant="h5" as="span" token={{ fontWeight: 'bold' }}>
              What's new in {appName}
            </Typography>
            {hasNewRelease && <Chip theme="success">New release</Chip>}
            <Icon
              className="ml-auto shrink-0 group-aria-expanded:rotate-180 transition-transform motion-reduce:transition-none"
              data={chevron_down}
              size={16}
            />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel className="accordion-panel">
          <div className="flex flex-col p-6 gap-4 border-t border-stroke-subtle">
            {isLoading ? (
              <CircularProgress size={24} />
            ) : error ? (
              <Message type="danger">Could not load release notes.</Message>
            ) : (
              <>
                {latestRelease ? (
                  <ReleaseCard release={latestRelease} headingLevel={4} />
                ) : (
                  <Typography>No releases yet.</Typography>
                )}
                <LinkComponent to={releaseNotesHref} className="text-link self-start">
                  See all release notes
                </LinkComponent>
              </>
            )}
          </div>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  )
}
