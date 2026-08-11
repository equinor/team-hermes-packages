# @team-hermes/react-components

A React component library providing shared code and components for Team Hermes projects. Components are previewed and documented via Storybook. The package is hosted on GitHub Packages for internal consumption.

## Stack

- React
- TypeScript
- Vite+ (unified toolchain: Vite, Vitest, Oxlint, Oxfmt)
- Storybook for component development and documentation
- pnpm (managed via Vite+)

## Conventions

- Use `vp` commands for all tooling (dev, build, test, lint, fmt, install).
- Import test utilities from `vite-plus/test`.
- Components should have accompanying Storybook stories.

## Tailwind CSS

- This project uses Tailwind CSS v4.
- Prefer Tailwind v4 CSS variable shorthand for plain custom-property values, for example `max-w-(--available-width)`, `bg-(--token)`, and `text-(--token)`.
- Use bracket arbitrary values only for expressions or values that are not plain CSS variables, for example `max-h-[min(var(--available-height),23rem)]`.
