# 📦 Team Hermes Packages

Shared libraries for Team Hermes projects.

Maintained by Team Hermes at [Equinor](https://github.com/equinor).

## 🚀 Usage

Start with the README for your package:

- [React components](team-hermes-packages-react/packages/react-components/README.md)
- [React ArcGIS map](team-hermes-packages-react/packages/react-omnia-map/README.md)
- [Python packages](team-hermes-packages-python/README.md)

## ⬇️ Installation

### React

Requires React 19 and compatible Equinor Design System peer dependencies, listed in
the [package metadata](team-hermes-packages-react/packages/react-components/package.json).

```sh
npm install @team-hermes/react-components
```

The ArcGIS map wrapper is a separate package. It requires `@arcgis/core` and `@arcgis/map-components` (^5.1) as peer
dependencies.

```sh
npm install @team-hermes/react-omnia-map @arcgis/core @arcgis/map-components
```

### Python

See the [Python package guide](team-hermes-packages-python/README.md) for available
packages and installation instructions.

## 💭 Feedback and Contributing

[Open an issue](https://github.com/equinor/team-hermes-packages/issues) to report a bug
or suggest an improvement. Contributions to code, tests, and documentation are welcome
through [pull requests](https://github.com/equinor/team-hermes-packages/pulls).
