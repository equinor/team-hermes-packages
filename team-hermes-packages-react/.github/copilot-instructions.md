# team-hermes-packages-react

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
