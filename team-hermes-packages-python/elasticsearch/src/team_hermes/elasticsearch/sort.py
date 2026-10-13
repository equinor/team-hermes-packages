"""Declarative sort policy and typed Elasticsearch ordering clauses."""

import dataclasses
import re
from collections.abc import Mapping
from types import MappingProxyType
from typing import Literal

from .errors import InvalidSearchRequestError

SortOrder = Literal["asc", "desc"]


_FLIP_ORDER: dict[SortOrder, SortOrder] = {"asc": "desc", "desc": "asc"}
_FLIP_MISSING: dict[str, str] = {"_last": "_first", "_first": "_last"}


@dataclasses.dataclass(frozen=True, slots=True)
class SortClause:
    """One indexed field and its ordering policy; None omits the missing-value option."""

    field: str
    order: SortOrder
    missing: str | None = None

    def __post_init__(self) -> None:
        if not isinstance(self.field, str) or not self.field.strip():
            raise InvalidSearchRequestError("Sort field must be a nonempty string")
        if self.order not in ("asc", "desc"):
            raise InvalidSearchRequestError(f"Sort order {self.order!r} is not allowed")
        if self.missing is not None and not isinstance(self.missing, str):
            raise TypeError("Sort missing value must be a string or None")

    def reversed(self) -> "SortClause":
        """Reverse direction and effective missing placement, retaining custom values."""
        missing = self.missing
        if missing is None and self.field not in ("_score", "_doc", "_shard_doc", "_geo_distance", "_script"):
            missing = "_last"
        if missing is not None:
            missing = _FLIP_MISSING.get(missing, missing)
        return dataclasses.replace(self, order=_FLIP_ORDER[self.order], missing=missing)


_DYNAMIC_SORT_NAME_PATTERN = re.compile(r"[A-Za-z0-9_.-]{1,128}")


@dataclasses.dataclass(frozen=True, slots=True)
class SortPolicy:
    """Public fields and namespaces, separate from trusted internal ordering.

    Field aliases map public names to Elasticsearch paths. Dynamic names are
    validated syntactically, without looking up whether they exist in an index.
    Defaults and tiebreakers are application configuration, never user input.
    """

    fields: Mapping[str, str] = dataclasses.field(default_factory=dict)
    namespaces: frozenset[str] = frozenset()
    default: tuple[SortClause, ...] = ()
    tiebreakers: tuple[SortClause, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(self, "fields", MappingProxyType(dict(self.fields)))
        object.__setattr__(self, "namespaces", frozenset(self.namespaces))
        object.__setattr__(self, "default", tuple(self.default))
        object.__setattr__(self, "tiebreakers", tuple(self.tiebreakers))
        if any(not isinstance(clause, SortClause) for clause in (*self.default, *self.tiebreakers)):
            raise TypeError("Sort defaults and tiebreakers must contain SortClause values")

    def compile(self, field: str | None = None, order: SortOrder = "asc") -> tuple[SortClause, ...]:
        """Validate a public sort and append internal ordering before any I/O."""
        if order not in ("asc", "desc"):
            raise InvalidSearchRequestError(f"Sort order {order!r} is not allowed")
        clauses: tuple[SortClause, ...]
        if field is None:
            if order != "asc":
                raise InvalidSearchRequestError("Sort order requires a sort field")
            clauses = self.default
        else:
            es_field = self._resolve_field(field)
            clauses = (SortClause(field=es_field, order=order, missing="_last"),)
        return (*clauses, *self.tiebreakers)

    def _resolve_field(self, field: str) -> str:
        """Resolve only declared public fields or safe dynamic names."""
        if isinstance(field, str):
            if field in self.fields:
                return self.fields[field]
            for namespace in self.namespaces:
                prefix = f"{namespace}."
                if field.startswith(prefix) and _DYNAMIC_SORT_NAME_PATTERN.fullmatch(field[len(prefix) :]):
                    return field
        raise InvalidSearchRequestError(f"Sort field {field!r} is not allowed")
