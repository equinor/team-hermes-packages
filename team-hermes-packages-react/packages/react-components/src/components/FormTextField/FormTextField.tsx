import type { TextareaProps, TextFieldProps } from '@equinor/eds-core-react'
import { type ChangeEvent, memo, useEffect, useState } from 'react'
import { StyledTextarea, StyledTextField } from './FormTextField.styles'

export type InputValue = string | number | undefined | readonly string[]

type FormTextFieldProps = {
  name: string
  updateValue: (value: InputValue, name: string) => void
  error?: string | undefined
  multiline?: boolean
  'data-testid'?: string
} & Partial<TextFieldProps | TextareaProps>

export const FormTextField = memo((props: FormTextFieldProps) => {
  const { name, value: initialValue, updateValue, 'data-testid': dataTestId, error, multiline, ...inputProps } = props
  const [value, setValue] = useState<InputValue>(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  function updateInputValue(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setValue(event.target.value)
  }

  function onInputBlur() {
    updateValue(value, name)
  }

  const commonProps = {
    ...inputProps,
    id: name,
    value: value,
    onChange: updateInputValue,
    onBlur: onInputBlur,
    helperText: error || '',
    'data-testid': dataTestId,
  }

  if (multiline) {
    return <StyledTextarea {...(commonProps as any)} variant={error ? 'error' : undefined} />
  }
  return <StyledTextField {...(commonProps as any)} variant={error ? 'error' : undefined} />
})
