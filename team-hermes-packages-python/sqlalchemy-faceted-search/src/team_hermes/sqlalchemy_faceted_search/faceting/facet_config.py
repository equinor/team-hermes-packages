from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, cast

from sqlalchemy import Select, func, select

from team_hermes.query import FilterBy, FilterExpression, LogicalFilter
from team_hermes.sqlalchemy_core.filtering import apply_filters


def _resolve_column(facet_id: str, entity: type) -> Any:
    """Resolve a facet ID to a SQLAlchemy column expression."""
    if "." in facet_id:
        parts = facet_id.split(".")
        column = getattr(entity, parts[0])
        for part in parts[1:]:
            column = getattr(column, part)
        return column

    return getattr(entity, facet_id)


def _remove_facet_from_filters(filters: FilterBy | None, facet_key: str) -> FilterBy | None:
    """Remove all FilterExpressions matching `facet_key` from a FilterBy tree."""
    if filters is None:
        return None

    if isinstance(filters, FilterExpression):
        return None if filters.key == facet_key else filters

    if isinstance(filters, LogicalFilter):
        pruned = [f for f in (_remove_facet_from_filters(f, facet_key) for f in filters.filters) if f is not None]
        if len(pruned) == 0:
            return None
        if len(pruned) == 1:
            return pruned[0]
        return LogicalFilter(operator=filters.operator, filters=pruned)

    return filters


@dataclass(frozen=True)
class FacetConfig:
    """Declarative configuration for a single facet."""

    cross_filter_exclusions: list[str] = field(default_factory=list)
    """Other facet keys to strip from cross-filters before counting."""

    build_query: Callable[[type], Select] | None = None
    """Optional callable(entity) -> Select that overrides the default query."""

    column_override: Any | None = None
    """Optional SQLAlchemy column expression that replaces the default column resolution."""

    scope: Any | None = None
    """Optional SQLAlchemy WHERE clause to restrict which rows are counted."""

    def resolve_query(self, facet_id: str, entity: Any, filters: FilterBy | None = None) -> Select:
        """Build the facet query with cross-filters applied."""
        cross_filters = self._apply_cross_filter(filters, facet_id)

        if self.build_query is not None:
            query = self.build_query(entity)
        else:
            col_expr = self.column_override if self.column_override is not None else _resolve_column(facet_id, entity)
            query = select(col_expr, func.count()).select_from(entity).group_by(col_expr)
            if self.scope is not None:
                query = query.where(self.scope)

        return apply_filters(entity, cast(Select, query), cross_filters)

    def _apply_cross_filter(self, filters: FilterBy | None, facet_id: str) -> FilterBy | None:
        """Strip the facet itself and its exclusions from the filter tree."""
        result = _remove_facet_from_filters(filters, facet_id)
        for exclusion in self.cross_filter_exclusions:
            result = _remove_facet_from_filters(result, exclusion)
        return result
