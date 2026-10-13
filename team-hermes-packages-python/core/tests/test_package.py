import ast
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "team_hermes"


def test_namespace_contains_only_empty_core():
    assert {path.name for path in SOURCE.iterdir() if path.name != "__pycache__"} == {"core"}
    core = SOURCE / "core"
    assert {path.name for path in core.iterdir() if path.name != "__pycache__"} == {"__init__.py"}
    module = ast.parse((core / "__init__.py").read_text())
    assert len(module.body) == 1
    assert ast.get_docstring(module) is not None


def test_distribution_has_no_dependencies():
    project = tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]
    assert project["name"] == "team-hermes-core"
    assert project["dependencies"] == []


def test_core_import_uses_namespace():
    import team_hermes
    import team_hermes.core

    assert team_hermes.__file__ is None
    assert team_hermes.core.__doc__ == "Reserved for future shared functionality."
