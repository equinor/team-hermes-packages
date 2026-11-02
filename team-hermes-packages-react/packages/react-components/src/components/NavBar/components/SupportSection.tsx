import { Button, Dialog, Icon, Tooltip, Typography } from '@equinor/eds-core-react'
import { close, info_circle, report_bug } from '@equinor/eds-icons'
import { useState } from 'react'
import { Stack } from '@/components'
import type { ApplicationConfig } from '../NavBar.types'
import { VersionText } from './VersionText'

export const SupportSection = ({ applicationConfig }: { applicationConfig?: ApplicationConfig }) => {
  const { serviceNowLink, githubRepoName } = applicationConfig || {}
  const [showSupportModal, setShowSupportModal] = useState<boolean>(false)
  return (
    <>
      <Tooltip title="Help and Support">
        <Button
          aria-haspopup="dialog"
          aria-label="Open Help and support dialog"
          onClick={() => setShowSupportModal(true)}
          variant="ghost_icon"
        >
          <Icon data={info_circle} />
        </Button>
      </Tooltip>
      <Dialog
        open={showSupportModal}
        style={{ minWidth: 420 }}
        onClose={() => setShowSupportModal(false)}
        isDismissable
      >
        <Dialog.Header>
          <Dialog.Title>Help and Support</Dialog.Title>
          <Button
            variant="ghost_icon"
            aria-label="Close Support and Help popup dialog"
            onClick={() => setShowSupportModal(false)}
            style={{ alignSelf: 'flex-end' }}
          >
            <Icon data={close} />
          </Button>
        </Dialog.Header>
        <Stack $padding={[0, 1, 1, 1]} $spacing={0.75} $alignItems="flex-start">
          {serviceNowLink && (
            <>
              <Typography variant="h6">Create a ticket in ServiceNow</Typography>
              <p className="text-sm">
                If you discover a bug or something that does not seem right, please let us know by creating a ticket in
                ServiceNow using the link below.
              </p>
              <Button variant="ghost" href={serviceNowLink} target="_blank" rel="noopener noreferrer">
                <Icon data={report_bug} />
                Report issue in ServiceNow
              </Button>
            </>
          )}
          {githubRepoName && <VersionText githubRepoName={githubRepoName} />}
        </Stack>
      </Dialog>
    </>
  )
}
