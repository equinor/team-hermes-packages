"""Run with an isolated interpreter containing only the installed core wheel."""

import importlib.util
from importlib.metadata import metadata
from importlib.resources import files


def main() -> None:
    import team_hermes
    import team_hermes.core

    assert team_hermes.__file__ is None
    assert all("site-packages" in path for path in team_hermes.__path__)
    assert {path.name for path in files("team_hermes").iterdir()} == {"core"}
    assert {path.name for path in files("team_hermes.core").iterdir() if path.name != "__pycache__"} == {"__init__.py"}
    package_metadata = metadata("team-hermes-core")
    assert package_metadata.get_all("License-File") == ["LICENSE.md"]
    assert not package_metadata.get_all("Requires-Dist")
    assert not package_metadata.get_all("Provides-Extra")
    for module in ("team_hermes.elasticsearch", "elasticsearch", "pydantic", "pytest", "fastapi", "wellcoredb"):
        assert importlib.util.find_spec(module) is None, module
    print("Installed empty core wheel verified")


if __name__ == "__main__":
    main()
