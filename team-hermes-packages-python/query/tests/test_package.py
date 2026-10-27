import ast
import doctest
import json
import re
import tomllib
from pathlib import Path
from urllib.parse import unquote, urlsplit

import pytest
from team_hermes.core import ValidationException

import team_hermes
from team_hermes import query
from team_hermes.query import models

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "team_hermes"


def test_distribution_dependencies_and_typing():
    configuration = tomllib.loads((ROOT / "pyproject.toml").read_text())
    project = configuration["project"]
    assert project["name"] == "team-hermes-query"
    assert project["dependencies"] == ["team-hermes-core>=0.1.0", "pydantic>=2,<3"]
    assert configuration["tool"]["uv"]["sources"]["team-hermes-core"] == {"workspace": True}
    assert team_hermes.__file__ is None
    assert {path.name for path in SOURCE.iterdir() if path.name != "__pycache__"} == {"query"}
    assert (SOURCE / "query" / "py.typed").is_file()


def test_no_application_framework_or_unrelated_sibling_imports():
    forbidden = (
        "wellcoredb",
        "fastapi",
        "starlette",
        "sqlalchemy",
        "azure",
        "elasticsearch",
        "team_hermes.elasticsearch",
        "team_hermes.validation",
    )
    for source in SOURCE.rglob("*.py"):
        for node in ast.walk(ast.parse(source.read_text())):
            modules = []
            if isinstance(node, ast.Import):
                modules = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module:
                modules = [node.module]
            assert not any(module.startswith(forbidden) for module in modules), source


def test_public_api_preserves_model_identity():
    expected = {
        "BooleanFilterExpression",
        "FilterBy",
        "FilterExpression",
        "FilterExpressionDict",
        "FilterExpressions",
        "FilterOperator",
        "FilterValue",
        "GeneralFilterExpression",
        "LogicalFilter",
        "LogicalOperator",
        "NumericFilterExpression",
        "OrderBy",
        "Select",
        "SortDirection",
        "StringFilterExpression",
    }
    assert set(query.__all__) == expected
    assert all(getattr(query, name) is getattr(models, name) for name in expected)
    assert not hasattr(query, "RepositoryInterface")


def test_query_raises_core_exception():
    assert models.ValidationException is ValidationException
    with pytest.raises(ValidationException, match="Unsupported operator"):
        query.FilterExpression(key="quantity", operator="unknown", value=5)


def test_package_registered_for_workspace_and_releases():
    workspace = tomllib.loads((ROOT.parent / "pyproject.toml").read_text())
    assert "query" in workspace["tool"]["uv"]["workspace"]["members"]
    assert "query/src" in workspace["tool"]["pyrefly"]["search-path"]
    repository = ROOT.parent.parent
    package_path = "team-hermes-packages-python/query"
    release = json.loads((repository / "release-please-config.json").read_text())["packages"][package_path]
    assert release["component"] == "team-hermes-query"
    assert release["release-type"] == "python"
    assert release["extra-files"] == [
        {
            "type": "toml",
            "path": "/team-hermes-packages-python/uv.lock",
            "jsonpath": "$.package[?(@.name.value == 'team-hermes-query')].version",
        }
    ]
    manifest = json.loads((repository / ".release-please-manifest.json").read_text())
    project = tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]
    assert manifest[package_path] == project["version"]


def test_readme_doctests() -> None:
    result = doctest.testfile(
        str(ROOT / "README.md"),
        module_relative=False,
        encoding="utf-8",
        raise_on_error=True,
    )
    assert result.attempted > 0


def test_readme_links_resolve():
    for target in re.findall(r"\[[^\]]*\]\(([^\s)]+)\)", (ROOT / "README.md").read_text()):
        parsed = urlsplit(target)
        if parsed.scheme or not parsed.path:
            continue
        assert (ROOT / unquote(parsed.path)).exists(), target
