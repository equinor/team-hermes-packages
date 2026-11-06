import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { SupportSection } from '@/components/NavBar/components/SupportSection'
import { VersionText } from '@/components/NavBar/components/VersionText'

const versionFile = 'hash: abc123\r\ndate: 2026-11-05\r\nrefs: tag: v1.2.3\r\n'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  history.replaceState(null, '', '/')
})

describe('VersionText', () => {
  it('fetches from the origin root on a nested route and displays the parsed version', async () => {
    history.replaceState(null, '', '/todos/123')
    const fetchMock = vi.fn().mockResolvedValue(new Response(versionFile))
    vi.stubGlobal('fetch', fetchMock)
    render(<VersionText githubRepoName="equinor/my-app" />)

    expect(fetchMock).toHaveBeenCalledWith('/version.txt')
    expect(await screen.findByRole('link', { name: 'tag: v1.2.3' })).toHaveAttribute(
      'href',
      'https://github.com/equinor/my-app/commit/abc123'
    )
    expect(screen.getByText('(2026-11-05)')).toBeInTheDocument()
  })

  it('forwards a configured base-path URL through the support section', async () => {
    const dialogDescriptors = Object.getOwnPropertyDescriptors(HTMLDialogElement.prototype)
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: { configurable: true, value: vi.fn() },
      close: { configurable: true, value: vi.fn() },
    })
    const fetchMock = vi.fn().mockResolvedValue(new Response(versionFile))
    vi.stubGlobal('fetch', fetchMock)
    try {
      render(
        <SupportSection
          applicationConfig={{
            name: 'MyApp',
            githubRepoName: 'equinor/my-app',
            versionUrl: '/my-app/version.txt',
          }}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Open Help and support dialog' }))
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/my-app/version.txt'))
    } finally {
      for (const method of ['showModal', 'close']) {
        Reflect.deleteProperty(HTMLDialogElement.prototype, method)
        if (dialogDescriptors[method]) {
          Object.defineProperty(HTMLDialogElement.prototype, method, dialogDescriptors[method])
        }
      }
    }
  })

  it('falls back to the hash and omits missing date punctuation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('hash: abc123\nrefs: \n')))
    const { container } = render(<VersionText githubRepoName="equinor/my-app" />)

    expect(await screen.findByRole('link', { name: 'abc123' })).toBeInTheDocument()
    expect(container).not.toHaveTextContent('()')
  })

  it.each([
    { name: 'non-OK response', response: () => new Response(versionFile, { status: 404 }) },
    {
      name: 'HTML content type',
      response: () => new Response(versionFile, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    },
    { name: 'HTML body without an HTML content type', response: () => new Response('<html>\nhash: garbage\n</html>') },
    { name: 'malformed file', response: () => new Response('refs: garbage\nmalformed') },
    { name: 'empty response', response: () => new Response('') },
    { name: 'empty hash', response: () => new Response('hash: \nrefs: main\n') },
  ])('logs and shows unknown without a commit link for $name', async ({ response }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<VersionText githubRepoName="equinor/my-app" />)

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('Could not load version information', expect.any(Error))
    )
    expect(screen.getByText('unknown')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('logs network failures and shows unknown without a commit link', async () => {
    const error = new Error('Network unavailable')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<VersionText githubRepoName="equinor/my-app" />)

    await waitFor(() => expect(consoleError).toHaveBeenCalledWith('Could not load version information', error))
    expect(screen.getByText('unknown')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('shows unknown when returning to a previously loaded URL until its new request resolves', async () => {
    let resolveB: (response: Response) => void = () => {}
    let resolveNewA: (response: Response) => void = () => {}
    const requestB = new Promise<Response>((resolve) => {
      resolveB = resolve
    })
    const newRequestA = new Promise<Response>((resolve) => {
      resolveNewA = resolve
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(versionFile))
      .mockReturnValueOnce(requestB)
      .mockReturnValueOnce(newRequestA)
    vi.stubGlobal('fetch', fetchMock)
    const { rerender } = render(<VersionText githubRepoName="equinor/my-app" versionUrl="/a/version.txt" />)
    await screen.findByRole('link', { name: 'tag: v1.2.3' })

    rerender(<VersionText githubRepoName="equinor/my-app" versionUrl="/b/version.txt" />)
    rerender(<VersionText githubRepoName="equinor/my-app" versionUrl="/a/version.txt" />)

    expect(fetchMock.mock.calls).toEqual([['/a/version.txt'], ['/b/version.txt'], ['/a/version.txt']])
    expect(screen.getByText('unknown')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText('(2026-11-05)')).not.toBeInTheDocument()

    await act(async () => resolveB(new Response('hash: stale-b')))
    expect(screen.getByText('unknown')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()

    await act(async () => resolveNewA(new Response('hash: fresh-a\ndate: 2026-11-06')))
    expect(screen.getByRole('link', { name: 'fresh-a' })).toHaveAttribute(
      'href',
      'https://github.com/equinor/my-app/commit/fresh-a'
    )
    expect(screen.getByText('(2026-11-06)')).toBeInTheDocument()
    expect(screen.queryByText('unknown')).not.toBeInTheDocument()
  })

  it('hides previous details when the URL changes and ignores stale responses', async () => {
    let resolveOldRequest: (response: Response) => void = () => {}
    const oldRequest = new Promise<Response>((resolve) => {
      resolveOldRequest = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(versionFile))
        .mockReturnValueOnce(oldRequest)
        .mockResolvedValueOnce(new Response('hash: latest'))
    )
    const { rerender } = render(<VersionText githubRepoName="equinor/my-app" />)
    await screen.findByRole('link', { name: 'tag: v1.2.3' })

    rerender(<VersionText githubRepoName="equinor/my-app" versionUrl="/old/version.txt" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('unknown')).toBeInTheDocument()
    rerender(<VersionText githubRepoName="equinor/my-app" versionUrl="/new/version.txt" />)
    await screen.findByRole('link', { name: 'latest' })

    await act(async () => resolveOldRequest(new Response('hash: stale')))
    expect(screen.getByRole('link', { name: 'latest' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'stale' })).not.toBeInTheDocument()
  })
})
