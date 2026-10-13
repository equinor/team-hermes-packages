"""Index-owned field definitions; independent of facet execution and the host app."""

import math
import re
from collections.abc import Mapping as ValueMapping
from dataclasses import dataclass
from typing import Any

from elasticsearch.dsl import Document, Keyword, Mapping, Object


@dataclass(frozen=True, slots=True)
class DynamicField:
    """A named numeric/categorical object pair with one qualified-name catalog."""

    name: str

    def __post_init__(self) -> None:
        if re.fullmatch(r"[a-z][a-z0-9_]*", self.name) is None:
            raise ValueError("Dynamic field names must match [a-z][a-z0-9_]*")

    def __set_name__(self, owner: type[Document], name: str) -> None:
        """Register a Document declaration after the DSL has built its mapping.

        Annotated declarations must use ``ClassVar[DynamicField]`` so the DSL
        does not interpret the declaration itself as a stored scalar field.
        """
        if not issubclass(owner, Document):
            raise TypeError("DynamicField declarations require an Elasticsearch Document")
        if name != self.name:
            raise ValueError(f"DynamicField {self.name!r} must be declared as {self.name!r}, not {name!r}")
        self.add_to_mapping(owner._doc_type.mapping)

    @property
    def numeric_path(self) -> str:
        return f"numeric_{self.name}"

    @property
    def categorical_path(self) -> str:
        return f"categorical_{self.name}"

    @property
    def discovery_field(self) -> str:
        return f"{self.name}_fields"

    @property
    def paths(self) -> tuple[str, str]:
        return self.numeric_path, self.categorical_path

    @property
    def owned_fields(self) -> frozenset[str]:
        return frozenset((*self.paths, self.discovery_field))

    def add_to_mapping(self, mapping: Mapping) -> None:
        """Register the complete layout, rejecting collisions before any mutation."""
        current = mapping.to_dict()
        conflicts = self.owned_fields.intersection(current.get("properties", {}))
        templates = current.get("dynamic_templates", [])
        additions = [
            {f"{self.name}_{kind}": {"path_match": f"{path}.*", "mapping": {"type": value_type}}}
            for kind, path, value_type in (
                ("numeric", self.numeric_path, "float"),
                ("categorical", self.categorical_path, "keyword"),
            )
        ]
        names = {name for template in additions for name in template}
        patterns = {f"{path}.*" for path in self.paths}
        if conflicts or any(
            name in names or definition.get("path_match") in patterns
            for template in templates
            for name, definition in template.items()
        ):
            raise ValueError(f"Mapping already contains fields or templates for {self.name!r}")
        for path in self.paths:
            mapping.field(path, Object(dynamic=True, subobjects=False))
        mapping.field(self.discovery_field, Keyword(multi=True, meta={"facet_type": "dynamic", "family": self.name}))
        mapping.meta("dynamic_templates", [*templates, *additions])

    def index_values(
        self,
        *,
        numeric: ValueMapping[str, float],
        categorical: ValueMapping[str, str],
    ) -> dict[str, Any]:
        """Encode already-classified values and catalog exactly the values written."""
        if any(not name for name in (*numeric, *categorical)):
            raise ValueError("Dynamic attribute names must not be empty")
        if any(not math.isfinite(value) for value in numeric.values()):
            raise ValueError("Numeric dynamic values must be finite")
        document: dict[str, Any] = {}
        catalog: list[str] = []
        for path, values in ((self.numeric_path, numeric), (self.categorical_path, categorical)):
            if values:
                document[path] = dict(values)
                catalog.extend(f"{path}.{name}" for name in values)
        document[self.discovery_field] = sorted(catalog)
        return document
