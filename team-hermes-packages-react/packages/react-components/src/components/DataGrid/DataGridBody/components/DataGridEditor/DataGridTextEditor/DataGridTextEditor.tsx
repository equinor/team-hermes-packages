type DataGridTextEditorProps = {
  value: string
  initialValue: string
  setValue: (value: string) => void
  onBlur: () => void
  type?: 'text' | 'number' | 'date'
}

export const DataGridTextEditor = (props: DataGridTextEditorProps) => {
  const { value, onBlur, setValue, initialValue, type = 'text' } = props

  // Save on Enter, reset on Escape
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      onBlur()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setValue(initialValue) // Reset to original value on escape
      return
    }
  }

  return (
    <input
      className="w-full h-full p-2"
      // biome-ignore lint/a11y/noAutofocus: input renders in-place of cell content, so autofocus is appropriate here
      autoFocus
      type={type}
      inputMode={type === 'number' ? 'decimal' : 'text'}
      value={value as string}
      onKeyDown={handleKeyDown}
      onChange={(e) => setValue(e.target.value)}
      onBlur={onBlur}
    />
  )
}
