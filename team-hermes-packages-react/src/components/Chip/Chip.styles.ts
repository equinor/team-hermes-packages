import { tv } from "tailwind-variants/lite";

export const chip = tv({
  slots: {
    root: "inline-flex items-center max-w-max rounded-full bg-(--eds-color-bg-surface) text-(--eds-color-text-subtle) font-medium border border-(--eds-color-border-subtle)",
    content: "inline-flex items-center gap-1 px-2 py-0.5 rounded-full",
    dismiss:
      "inline-flex items-center justify-center rounded-full shrink-0 cursor-pointer p-0.5 text-(--eds-color-text-subtle) hover:bg-(--eds-color-bg-fill-muted-hover) disabled:pointer-events-none disabled:opacity-50",
  },
  variants: {
    size: {
      xs: { root: "text-xs" },
      sm: { root: "text-sm", content: "px-2.5" },
      base: { root: "text-base", content: "px-3 py-1", dismiss: "p-1" },
      lg: { root: "text-lg", content: "px-4 py-1.5", dismiss: "p-1.5" },
    },
    interactive: {
      true: {
        content: "cursor-pointer hover:bg-(--eds-color-bg-fill-muted-hover) disabled:cursor-text",
      },
    },
  },
});
