import ast
import importlib.util
import re
import tomllib
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "team_hermes"


def test_namespace_root_contains_only_elasticsearch():
    assert {path.name for path in SOURCE.iterdir() if path.name != "__pycache__"} == {"elasticsearch"}


def test_distribution_is_independent():
    project = tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]
    assert project["name"] == "team-hermes-elasticsearch"
    assert not any("team-hermes" in dependency for dependency in project["dependencies"])


def test_no_application_imports_or_excluded_modules():
    for source in SOURCE.rglob("*.py"):
        for node in ast.walk(ast.parse(source.read_text())):
            modules = []
            if isinstance(node, ast.Import):
                modules = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module:
                modules = [node.module]
            assert all(not module.startswith("wellcoredb") for module in modules), source
    assert not {"las", "xlsx", "chunked", "access_control", "select"}.intersection(
        path.name for path in SOURCE.iterdir()
    )


def test_colocated_markdown_links_resolve():
    for document in [ROOT / "README.md", *SOURCE.rglob("*.md")]:
        for target in re.findall(r"\[[^\]]*\]\(([^\s)]+)\)", document.read_text()):
            parsed = urlsplit(target)
            if parsed.scheme or not parsed.path:
                continue
            assert (document.parent / unquote(parsed.path)).exists(), (document, target)


def test_public_modules_have_usage_guides():
    readme = (ROOT / "README.md").read_text()
    for section in ("Usage", "Example", "Configure"):
        assert re.search(rf"^#{{2,3}} \W*{section}$", readme, re.MULTILINE), section
    for group in SOURCE.iterdir():
        if (group / "__init__.py").is_file():
            assert (group / "py.typed").is_file(), group


def test_elasticsearch_public_api():
    from team_hermes.elasticsearch import SearchDefinition, SearchQuery
    from team_hermes.elasticsearch.search import SearchDefinition as Implementation

    assert SearchDefinition is Implementation
    assert isinstance(SearchDefinition.from_mapping({"brand": {"type": "keyword"}}).search(), SearchQuery)
    assert importlib.util.find_spec("team_hermes.faceted_search") is None
