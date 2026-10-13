# 📦 Team Hermes Packages

Shared libraries for Team Hermes projects.

## 🌟 Highlights

- Reusable React components and Python code.
- Separate packages, so projects install only what they need.

## ℹ️ Overview

This repository brings together shared libraries used across Team Hermes projects.
It gives common code a single home so improvements can be reused across applications.

### ✍️ Authors

Maintained by Team Hermes at [Equinor](https://github.com/equinor).

## 🚀 Usage

Start with the README for your package:

- [React components](team-hermes-packages-react/README.md)
- [Python library](team-hermes-packages-python/README.md)

## ⬇️ Installation

### React

Requires React 19 and compatible Equinor Design System peer dependencies, listed in
the [package metadata](team-hermes-packages-react/package.json).

```sh
npm install @team-hermes/react-components
```

### Python

Requires Python 3.13+ and uv. Install into a virtual environment:

```sh
uv pip install "team-hermes-packages @ git+https://github.com/equinor/team-hermes-packages.git@main#subdirectory=team-hermes-packages-python"
```

Replace `main` with a tag or commit SHA to pin the version.

## 💭 Feedback and Contributing

[Open an issue](https://github.com/equinor/team-hermes-packages/issues) to report a bug
or suggest an improvement. Contributions to code, tests, and documentation are welcome
through [pull requests](https://github.com/equinor/team-hermes-packages/pulls).
