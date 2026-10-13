# 🧩 Team Hermes Core

Reserved for future shared Team Hermes Python code. This package has no runtime

**Requires:** Python 3.13+ and Git for installation from source.

## ⬇️ Installation

Install into a virtual environment:

```shell
python -m pip install \
  "team-hermes-core @ git+https://github.com/equinor/team-hermes-packages.git@main#subdirectory=team-hermes-packages-python/core"
```

For reproducible installs, replace `main` with a release tag or full commit SHA.

## 🛠️ Development

Follow the [workspace setup](../README.md), then run from the repository root:

```shell
mise run python:test -- core/tests
mise run python:lint
mise run python:typecheck
```

## 💭 Feedback and Contributing

[Open an issue](https://github.com/equinor/team-hermes-packages/issues) to suggest
shared functionality. See the [repository guide](../../README.md) for contributing.

## ⚖️ License

See [LICENSE.md](LICENSE.md).
