from typing import Any

from sqlalchemy import Select, String, cast
from sqlalchemy.orm import InstrumentedAttribute, RelationshipProperty
from sqlalchemy.sql import and_, or_

from team_hermes.core import ValidationException
from team_hermes.query import (
    BooleanFilterExpression,
    FilterBy,
    FilterExpression,
    FilterExpressions,
    FilterOperator,
    GeneralFilterExpression,
    LogicalFilter,
    LogicalOperator,
    NumericFilterExpression,
    StringFilterExpression,
)


def _get_expression(filter_query: FilterExpressions, column: InstrumentedAttribute):  # noqa: C901
    match filter_query:
        case GeneralFilterExpression():
            match filter_query.operator:
                case FilterOperator.eq:
                    return column == filter_query.value
                case FilterOperator.neq:
                    return column != filter_query.value
        case NumericFilterExpression():
            match filter_query.operator:
                case FilterOperator.gt:
                    return column > filter_query.value
                case FilterOperator.lt:
                    return column < filter_query.value
                case FilterOperator.gte:
                    return column >= filter_query.value
                case FilterOperator.lte:
                    return column <= filter_query.value
        case BooleanFilterExpression():
            match filter_query.operator:
                case FilterOperator.isnull:
                    return column.is_(None)
                case FilterOperator.notnull:
                    return column.isnot(None)
        case StringFilterExpression():
            match filter_query.operator:
                case FilterOperator.like:
                    return cast(column, String).like(
                        f"%{filter_query.value.replace('_', '__').replace('*', '%').replace('?', '_')}%"
                    )
                case FilterOperator.ilike:
                    return cast(column, String).ilike(
                        f"%{filter_query.value.replace('_', '__').replace('*', '%').replace('?', '_')}%"
                    )
                case FilterOperator.notlike:
                    return cast(column, String).notlike(
                        f"%{filter_query.value.replace('_', '__').replace('*', '%').replace('?', '_')}%"
                    )
                case FilterOperator.notilike:
                    return cast(column, String).notilike(
                        f"%{filter_query.value.replace('_', '__').replace('*', '%').replace('?', '_')}%"
                    )
                case FilterOperator.contains:
                    return column.contains(filter_query.value)
                case FilterOperator.notcontains:
                    return ~column.contains(filter_query.value)
                case FilterOperator.inlist:
                    return column.in_(filter_query.value.split(","))
                case FilterOperator.notinlist:
                    return column.notin_(filter_query.value.split(","))
                case FilterOperator.ends_with:
                    return column.endswith(filter_query.value)
                case FilterOperator.starts_with:
                    return column.startswith(filter_query.value)

    raise ValidationException(f"Unsupported operator '{filter_query.operator}'")


def _is_relationship(attr: Any) -> bool:
    return hasattr(attr, "property") and isinstance(attr.property, RelationshipProperty)


def _resolve_filter_target[T](entity: type[T], key: str) -> tuple[Any, list[Any]]:
    """Walk a dotted key path and return (target_column, relationships_chain).

    The relationships chain is ordered from outermost to innermost, so the caller
    can wrap the expression from the inside out by iterating in reverse.
    """
    parts = key.split(".")
    relationships: list[Any] = []
    current: Any = entity
    for part in parts:
        attr = getattr(current, part)
        if _is_relationship(attr):
            relationships.append(attr)
            current = attr.property.mapper.class_
        else:
            current = attr
    return current, relationships


def _create_expression[T](entity: type[T], filter_query: FilterExpression) -> Any:
    try:
        column, relationships = _resolve_filter_target(entity, filter_query.key)
    except AttributeError as error:
        raise ValidationException(f"Attribute '{filter_query.key}' not found in entity '{entity.__name__}'") from error

    expression = _get_expression(filter_query.expression, column)
    for relationship in reversed(relationships):
        expression = relationship.any(expression) if relationship.property.uselist else relationship.has(expression)
    return expression


def _build_where_clause[T](entity: type[T], filter_query: FilterBy) -> Any:
    if isinstance(filter_query, FilterExpression):
        return _create_expression(entity, filter_query)
    elif isinstance(filter_query, LogicalFilter):
        match filter_query.operator:
            case LogicalOperator.and_:
                return and_(*(_build_where_clause(entity, f) for f in filter_query.filters))
            case LogicalOperator.or_:
                return or_(*(_build_where_clause(entity, f) for f in filter_query.filters))
    else:
        raise NotImplementedError(f"Filter expression of type {type(filter_query)} is not supported yet")


def apply_filters[Entity, Statement: Select](
    entity: type[Entity], query: Statement, filters: FilterBy | None
) -> Statement:
    if not filters:
        return query
    return query.where(_build_where_clause(entity, filters))
