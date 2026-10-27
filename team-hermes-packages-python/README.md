# 🐍 Team Hermes Python Packages

Independent Python 3.13+ libraries sharing a uv workspace and lockfile.

## 📦 Packages

- [🔍 Elasticsearch](elasticsearch/README.md): typed search, filtering, pagination, and aggregations.
- [🧩 Core](core/README.md): reserved for future shared code; no public functionality yet.
- [Validation](validation/README.md): framework-independent validation rules, results, and serializable reports.

See each package's README for installation and usage.

## 🛠️ Development

Install [mise](https://mise.jdx.dev/getting-started.html), then run from the repository root:

```shell
mise install
```

Dependencies are installed automatically by the check tasks:

```shell
mise run python:test
mise run python:lint
mise run python:typecheck
mise run python:pack
```

Target tests and a Python version:

```shell
UV_PYTHON=3.15 mise run python:test -- elasticsearch/tests
```

Build output: `team-hermes-packages-python/dist/`.

After changing dependencies, run `uv lock` from `team-hermes-packages-python/`
and commit the updated lockfile.

## 💭 Feedback and Contributing

[Open an issue](https://github.com/equinor/team-hermes-packages/issues) to report a bug
or suggest an improvement. See the [repository guide](../README.md) for contributing.
