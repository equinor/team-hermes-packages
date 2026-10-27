"""Run with installed query/core wheels and only their declared runtime dependencies."""

import importlib.util
import json
from importlib.metadata import metadata
from importlib.resources import files


def main() -> None:
    import team_hermes.core

    import team_hermes
    import team_hermes.query

    assert team_hermes.__file__ is None
    assert all("site-packages" in path for path in team_hermes.__path__)
    assert {path.name for path in files("team_hermes").iterdir()} == {"core", "query"}
    assert files("team_hermes.query").joinpath("py.typed").is_file()
    assert files("team_hermes.core").joinpath("py.typed").is_file()
    assert not metadata("team-hermes-core").get_all("Requires-Dist")
    package_metadata = metadata("team-hermes-query")
    assert package_metadata.get_all("License-File") == ["LICENSE"]
    assert set(package_metadata.get_all("Requires-Dist") or []) == {"pydantic<3,>=2", "team-hermes-core>=0.1.0"}
    assert not package_metadata.get_all("Provides-Extra")
    for heading in ("Query Contracts", "Compatibility Boundaries"):
        assert heading in package_metadata["Description"]
    for module in (
        "team_hermes.elasticsearch",
        "team_hermes.validation",
        "team_hermes.core.query",
        "elasticsearch",
        "pytest",
        "fastapi",
        "starlette",
        "sqlalchemy",
        "azure",
        "wellcoredb",
    ):
        assert importlib.util.find_spec(module) is None, module

    from team_hermes.core import ValidationException

    from team_hermes.query import (
        FilterExpression,
        FilterOperator,
        LogicalFilter,
        LogicalOperator,
        OrderBy,
        Select,
        SortDirection,
    )

    assert not hasattr(team_hermes.core, "FilterExpression")
    expression = FilterExpression(key="quantity", operator=FilterOperator.gt, value=5)
    filters = LogicalFilter(operator=LogicalOperator.and_, filters=[expression])
    assert json.loads(filters.model_dump_json())["filters"][0] == {
        "key": "quantity",
        "expression": {"operator": "gt", "value": 5},
    }
    assert OrderBy(key="id", direction=SortDirection.asc).model_dump(mode="json")["direction"] == "asc"
    assert Select(fields=["id"]).fields == ["id"]
    try:
        FilterExpression(key="quantity", operator="unknown", value=5)
    except ValidationException as error:
        assert error.detail == "Unsupported operator: 'unknown'"
    else:
        raise AssertionError("Unknown operators must raise core's ValidationException")
    print("Installed query wheel verified")


if __name__ == "__main__":
    main()
