import { Textarea, TextField } from '@equinor/eds-core-react'
import type { ComponentProps } from 'react'
import { tv } from 'tailwind-variants/lite'

type StyledExtras = {
  $padding?: 'normal' | 'compact'
  $textSize?: 'small' | 'default'
}

const formTextField = tv({
  slots: {
    root: [
      '[&>div:first-of-type]:shadow-none! [&>div:first-of-type]:border! [&>div:first-of-type]:border-stroke-subtle!',
      '[&>div:first-of-type]:rounded-lg! [&>div:first-of-type]:bg-(--input-bg-color)!',
      '[&>div:first-of-type]:h-auto! [&>div:first-of-type]:text-(--text-primary-color)!',
      '[&_input]:px-3! [&_input]:py-2! [&_textarea]:px-3! [&_textarea]:py-2!',
      '[&_input::placeholder]:text-[#777]! [&_textarea::placeholder]:text-[#777]!',
      '[&_input:disabled]:text-(--text-secondary-color)! [&_textarea:disabled]:text-(--text-secondary-color)!',
    ],
  },
  variants: {
    padding: {
      normal: {},
      compact: {
        root: '[&_input]:px-2! [&_input]:py-[0.2rem]! [&_textarea]:px-2! [&_textarea]:py-[0.2rem]!',
      },
    },
    textSize: {
      default: {},
      small: {
        root: '[&_input]:text-[0.825rem]! [&_textarea]:text-[0.825rem]!',
      },
    },
  },
})

export const StyledTextField = ({
  $padding,
  $textSize,
  className,
  ...props
}: ComponentProps<typeof TextField> & StyledExtras) => (
  <TextField
    {...props}
    className={formTextField({ padding: $padding, textSize: $textSize }).root({ class: className })}
  />
)

export const StyledTextarea = ({
  $padding,
  $textSize,
  className,
  ...props
}: ComponentProps<typeof Textarea> & StyledExtras) => (
  <Textarea
    {...props}
    className={formTextField({ padding: $padding, textSize: $textSize }).root({ class: className })}
  />
)
