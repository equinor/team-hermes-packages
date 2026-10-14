import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { FileUploadInput } from './FileUploadInput'

const png = new File(['x'], 'a.png', { type: 'image/png' })
const png2 = new File(['x'], 'b.png', { type: 'image/png' })
const pdf = new File(['x'], 'a.pdf', { type: 'application/pdf' })

const drop = (container: HTMLElement, files: File[]) =>
  fireEvent.drop(container.firstElementChild!, { dataTransfer: { files, types: ['Files'] } })

describe('FileUploadInput drop', () => {
  it('filters out files not matching accept', () => {
    const onFileChange = vi.fn()
    const { container } = render(<FileUploadInput onFileChange={onFileChange} accept="image/*" multiple />)
    drop(container, [png, pdf, png2])
    expect(onFileChange).toHaveBeenCalledWith([png, png2])
  })

  it('does not call onFileChange when no files are accepted', () => {
    const onFileChange = vi.fn()
    const { container } = render(<FileUploadInput onFileChange={onFileChange} accept="image/*" />)
    drop(container, [pdf])
    expect(onFileChange).not.toHaveBeenCalled()
  })

  it('keeps only the first accepted file when multiple is not set', () => {
    const onFileChange = vi.fn()
    const { container } = render(<FileUploadInput onFileChange={onFileChange} accept="image/*" />)
    drop(container, [pdf, png, png2])
    expect(onFileChange).toHaveBeenCalledWith([png])
  })

  it('accepts all files when accept is not set', () => {
    const onFileChange = vi.fn()
    const { container } = render(<FileUploadInput onFileChange={onFileChange} multiple />)
    drop(container, [png, pdf])
    expect(onFileChange).toHaveBeenCalledWith([png, pdf])
  })
})
