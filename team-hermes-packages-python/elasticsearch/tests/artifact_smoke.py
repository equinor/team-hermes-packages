"""Run with an isolated interpreter containing only the installed wheel and its dependencies."""

import importlib.util
import sys
from importlib.metadata import metadata
from importlib.resources import files


def main() -> None:
    import team_hermes
    from team_hermes.elasticsearch import SearchDefinition, SearchQuery

    assert team_hermes.__file__ is None
    assert all("site-packages" in path for path in team_hermes.__path__)
    assert importlib.util.find_spec("wellcoredb") is None
    assert importlib.util.find_spec("pytest") is None
    root = files("team_hermes")
    assert {path.name for path in root.iterdir()} == {"elasticsearch"}
    assert root.joinpath("elasticsearch/py.typed").is_file()
    package_metadata = metadata("team-hermes-elasticsearch")
    readme = package_metadata["Description"]
    for section in ("Usage", "Example", "Configure"):
        assert section in readme, section
    assert "SearchDefinition.from_mapping" in readme
    assert package_metadata.get_all("License-File") == ["LICENSE.md"]
    assert not package_metadata.get_all("Provides-Extra")
    assert importlib.util.find_spec("team_hermes.core") is None
    for module in ("fastapi", "starlette", "sqlalchemy", "httpx"):
        assert importlib.util.find_spec(module) is None, module
    definition = SearchDefinition.from_mapping({"brand": {"type": "keyword"}})
    assert isinstance(definition.search(), SearchQuery)
    assert not any(name == "wellcoredb" or name.startswith("wellcoredb.") for name in sys.modules)
    print("Installed wheel verified")


if __name__ == "__main__":
    main()
