"""Query expression contracts without parsing or database execution."""

from __future__ import annotations

import datetime
from enum import StrEnum, auto, unique
from typing import Literal, Self, TypedDict, Unpack, cast

from pydantic import BaseModel, ConfigDict, Field

from team_hermes.core import ValidationException


@unique
class SortDirection(StrEnum):
    """Sorting directions."""

    asc = auto()
    desc = auto()


class FilterOperator(StrEnum):
    """Filtering operators."""

    eq = auto()
    neq = auto()
    like = auto()
    ilike = auto()
    notlike = auto()
    notilike = auto()
    gt = auto()
    lt = auto()
    gte = auto()
    lte = auto()
    inlist = auto()
    notinlist = auto()
    isnull = auto()
    notnull = auto()
    contains = auto()
    notcontains = auto()
    starts_with = auto()
    ends_with = auto()


class LogicalOperator(StrEnum):
    """Logical operators."""

    and_ = auto()
    or_ = auto()


class OrderBy(BaseModel):
    key: str
    direction: SortDirection


FilterValue = str | int | float | bool | None | datetime.datetime | datetime.date | datetime.time

NUM_OPERATORS = [FilterOperator.gt, FilterOperator.lt, FilterOperator.gte, FilterOperator.lte]
BOOL_OPERATORS = [FilterOperator.isnull, FilterOperator.notnull]
STR_OPERATORS = [
    FilterOperator.like,
    FilterOperator.ilike,
    FilterOperator.notlike,
    FilterOperator.notilike,
    FilterOperator.contains,
    FilterOperator.notcontains,
    FilterOperator.inlist,
    FilterOperator.notinlist,
    FilterOperator.starts_with,
    FilterOperator.ends_with,
]
DEFAULT_OPERATORS = [FilterOperator.eq, FilterOperator.neq]

NumericOperatorType = Literal[FilterOperator.gt, FilterOperator.lt, FilterOperator.gte, FilterOperator.lte]
BooleanOperatorType = Literal[FilterOperator.isnull, FilterOperator.notnull]
StringOperatorType = Literal[
    FilterOperator.like,
    FilterOperator.ilike,
    FilterOperator.notlike,
    FilterOperator.notilike,
    FilterOperator.contains,
    FilterOperator.notcontains,
    FilterOperator.inlist,
    FilterOperator.notinlist,
    FilterOperator.starts_with,
    FilterOperator.ends_with,
]
GeneralOperatorType = Literal[FilterOperator.eq, FilterOperator.neq]
NumericTypes = int | float | datetime.date | datetime.datetime | datetime.time


class GeneralFilterExpression(BaseModel):
    operator: Literal[FilterOperator.eq, FilterOperator.neq]
    value: NumericTypes | bool | str | None


class NumericFilterExpression(BaseModel):
    operator: Literal[FilterOperator.gt, FilterOperator.lt, FilterOperator.gte, FilterOperator.lte]
    value: NumericTypes


class BooleanFilterExpression(BaseModel):
    operator: Literal[FilterOperator.isnull, FilterOperator.notnull]
    value: bool | None


class StringFilterExpression(BaseModel):
    operator: Literal[
        FilterOperator.like,
        FilterOperator.ilike,
        FilterOperator.notlike,
        FilterOperator.notilike,
        FilterOperator.contains,
        FilterOperator.notcontains,
        FilterOperator.inlist,
        FilterOperator.notinlist,
        FilterOperator.starts_with,
        FilterOperator.ends_with,
    ]
    value: str


class FilterExpressionDict(TypedDict):
    key: str
    operator: FilterOperator | str
    value: NumericTypes | bool | str | None


FilterExpressions = (
    NumericFilterExpression | BooleanFilterExpression | StringFilterExpression | GeneralFilterExpression
)


class FilterExpression(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    key: str
    expression: FilterExpressions = Field(discriminator="operator")

    @property
    def operator(self) -> FilterOperator:
        return self.expression.operator

    @property
    def value(self) -> FilterValue:
        return self.expression.value

    def __init__(self, /, **expression: Unpack[FilterExpressionDict]) -> None:
        key = expression["key"]
        operator = expression["operator"]
        value = expression["value"]

        if operator not in FilterOperator:
            raise ValidationException(f"Unsupported operator: '{operator}'")

        filter_expression: FilterExpressions
        if isinstance(value, NumericTypes) and operator in NUM_OPERATORS:
            filter_expression = NumericFilterExpression(operator=cast(NumericOperatorType, operator), value=value)
        elif isinstance(value, bool | None) and operator in BOOL_OPERATORS:
            filter_expression = BooleanFilterExpression(operator=cast(BooleanOperatorType, operator), value=value)
        elif isinstance(value, str) and operator in STR_OPERATORS:
            filter_expression = StringFilterExpression(operator=cast(StringOperatorType, operator), value=value)
        elif operator in DEFAULT_OPERATORS:
            filter_expression = GeneralFilterExpression(operator=cast(GeneralOperatorType, operator), value=value)
        else:
            raise ValidationException(f"Invalid operator '{operator}' for value '{value}' of type '{type(value)}'")
        super().__init__(key=key, expression=filter_expression)


class LogicalFilter(BaseModel):
    operator: LogicalOperator
    filters: list[FilterExpression | Self]


type FilterBy = FilterExpression | LogicalFilter


class Select(BaseModel):
    fields: list[str]
