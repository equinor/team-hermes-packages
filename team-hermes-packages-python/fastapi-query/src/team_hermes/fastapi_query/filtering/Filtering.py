import datetime
import re
from collections import deque
from collections.abc import Callable

from fastapi import Query

from team_hermes.core import ValidationException
from team_hermes.query import (
    FilterBy,
    FilterExpression,
    FilterValue,
    LogicalFilter,
    LogicalOperator,
)

FILTER_EXPRESSION_REGEX = re.compile(
    r"""
    # Field name (supports dots for nested properties)
    (?P<field>[\w\.]+)
    # Comparison operator (accept any sequence of non-whitespace characters)
    \s*(?P<operator>\S+)
    # Optional quote for string values
    \s*(?P<quote>["']?)
    # Value (string, number, null, true, false, or any sequence of non-whitespace characters including spaces)
    (?P<value>(?:null|true|false|["'][^"']*["']|[^"'\s]+(?:\s[^"'\s]+)*))
    # Closing quote if opened
    (?P=quote)?
    """,
    re.VERBOSE,
)


type Stack = deque[tuple[list[FilterBy], LogicalOperator]]


def parse_filter_string(filter_string: str, valid_options: list[str] | None) -> FilterBy:
    tokens = re.findall(r"\(|\)|\b(?:or|and)\b|[^() ]+ [^() ]+ (?:'[^']*'|[^'() ]+)", filter_string.strip())
    stack: Stack = deque()
    current_filters: list[FilterBy] = []
    current_operator: LogicalOperator = LogicalOperator.and_

    for token in tokens:
        if not token:
            continue

        match token.lower():
            case "and":
                current_operator = LogicalOperator.and_
            case "or":
                current_operator = LogicalOperator.or_
            case "(":
                current_filters, current_operator = handle_opening_parenthesis(
                    stack, current_filters, current_operator
                )
            case ")":
                current_filters, current_operator = handle_closing_parenthesis(
                    stack, current_filters, current_operator
                )
            case _:
                current_filters.append(parse_filter_expression(token, valid_options))

    if stack:
        raise ValidationException("Mismatched parentheses in filter string")

    if len(current_filters) > 1:
        return LogicalFilter(operator=current_operator, filters=current_filters)

    return current_filters[0]


def handle_opening_parenthesis(
    stack: Stack,
    current_filters: list[FilterBy],
    current_operator: LogicalOperator,
) -> tuple[list[FilterBy], LogicalOperator]:
    stack.append((current_filters, current_operator))
    return [], LogicalOperator.and_


def handle_closing_parenthesis(
    stack: Stack,
    current_filters: list[FilterBy],
    current_operator: LogicalOperator,
) -> tuple[list[FilterBy], LogicalOperator]:
    if not stack:
        raise ValidationException("Unmatched closing parenthesis in filter string.")

    prev_filters, prev_operator = stack.pop()
    logical_filter = LogicalFilter(operator=current_operator, filters=current_filters)
    return prev_filters + [logical_filter], prev_operator


def parse_filter_expression(token: str, valid_fields: list[str] | None) -> FilterExpression:
    """Parse a single token into a FilterExpression object."""
    match = FILTER_EXPRESSION_REGEX.match(token)
    if not match:
        raise ValidationException(f"Invalid filter expression: {token}")

    field = match.group("field")
    if valid_fields and field not in valid_fields:
        raise ValidationException(f"Unsupported field: {field}")

    operator = match.group("operator")
    if operator is None:
        raise ValidationException("No operator provided")
    value = match.group("value").strip().strip('"').strip("'")
    is_string = f"'{value}'" in token  # Check if the value is a string, based on quotes
    parsed_value = value if is_string else parse_value(value)
    is_date = re.match(r"\d{4}-\d{2}-\d{2}", value)
    if is_date:
        parsed_value = datetime.datetime.strptime(value, "%Y-%m-%d").date()
    return FilterExpression(key=field, operator=operator, value=parsed_value)


def parse_value(value: str) -> FilterValue:
    """Convert the string value to its appropriate type."""
    match value.lower():
        case "null":
            return None
        case "true":
            return True
        case "false":
            return False
        case _:
            return parse_numeric(value)


def parse_numeric(value: str) -> int | float | str:
    """Attempt to parse a numeric value from a string."""
    try:
        return int(value)  # Try parsing as int
    except ValueError:
        try:
            return float(value)  # Try parsing as float
        except ValueError:
            return value.strip("\"'")  # Treat as string


def parse_filter(valid_options: list[str] | None = None) -> Callable[[str], FilterBy | None]:
    def _parse_filter(
        filters: str = Query(None, description="Filter items by property values", examples=["name eq 'test'"]),
    ) -> FilterBy | None:
        if not filters:
            return None
        parsed_filter: FilterBy = parse_filter_string(filters.strip(), valid_options)
        if not parsed_filter:
            raise ValidationException(f"Invalid filter string {filters}")
        return parsed_filter

    return _parse_filter
