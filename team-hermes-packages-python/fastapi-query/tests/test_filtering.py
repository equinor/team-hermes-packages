import datetime

import pytest
from team_hermes.core import ValidationException
from team_hermes.query import (
    FilterExpression,
    FilterOperator,
    LogicalFilter,
    LogicalOperator,
)

from team_hermes.fastapi_query.filtering.Filtering import (
    parse_filter_expression,
    parse_filter_string,
    parse_numeric,
    parse_value,
)


@pytest.fixture
def valid_options():
    return ["name", "age", "created_at", "submitted_by", "status"]


def test_single_filter(valid_options):
    result = parse_filter_string("name eq 'John'", valid_options)
    assert result == FilterExpression(key="name", operator=FilterOperator.eq, value="John")


def test_multiple_filters(valid_options):
    result = parse_filter_string("name eq 'John' and age gt 30", valid_options)

    assert result == LogicalFilter(
        operator=LogicalOperator.and_,
        filters=[
            FilterExpression(key="name", operator=FilterOperator.eq, value="John"),
            FilterExpression(key="age", operator=FilterOperator.gt, value=30),
        ],
    )


def test_with_parentheses(valid_options):
    result = parse_filter_string("(name eq 'John' or age gt 30) and created_at lt '2023-01-01'", valid_options)
    assert result == LogicalFilter(
        operator=LogicalOperator.and_,
        filters=[
            LogicalFilter(
                operator=LogicalOperator.or_,
                filters=[
                    FilterExpression(key="name", operator=FilterOperator.eq, value="John"),
                    FilterExpression(key="age", operator=FilterOperator.gt, value=30),
                ],
            ),
            FilterExpression(key="created_at", operator=FilterOperator.lt, value=datetime.date(2023, 1, 1)),
        ],
    )


def test_complex_filter(valid_options):
    filter_string = """
        (
        name eq 'John'
        or (age gt 30 and created_at lt '2023-01-01'))
        and (submitted_by eq 'admin' or status eq 'active'
        )
        """
    result = parse_filter_string(
        filter_string,
        valid_options,
    )

    assert result == LogicalFilter(
        operator=LogicalOperator.and_,
        filters=[
            LogicalFilter(
                operator=LogicalOperator.or_,
                filters=[
                    FilterExpression(key="name", operator=FilterOperator.eq, value="John"),
                    LogicalFilter(
                        operator=LogicalOperator.and_,
                        filters=[
                            FilterExpression(key="age", operator=FilterOperator.gt, value=30),
                            FilterExpression(
                                key="created_at", operator=FilterOperator.lt, value=datetime.date(2023, 1, 1)
                            ),
                        ],
                    ),
                ],
            ),
            LogicalFilter(
                operator=LogicalOperator.or_,
                filters=[
                    FilterExpression(key="submitted_by", operator=FilterOperator.eq, value="admin"),
                    FilterExpression(key="status", operator=FilterOperator.eq, value="active"),
                ],
            ),
        ],
    )


def test_with_parentheses_and_multiple_operators(valid_options):
    result = parse_filter_string("(name eq 'Item 10' or (name eq 'Item 11' or name eq 'Item 12'))", valid_options)

    assert result == LogicalFilter(
        operator=LogicalOperator.or_,
        filters=[
            FilterExpression(key="name", operator=FilterOperator.eq, value="Item 10"),
            LogicalFilter(
                operator=LogicalOperator.or_,
                filters=[
                    FilterExpression(key="name", operator=FilterOperator.eq, value="Item 11"),
                    FilterExpression(key="name", operator=FilterOperator.eq, value="Item 12"),
                ],
            ),
        ],
    )


def test_invalid_field(valid_options):
    with pytest.raises(ValidationException) as exc_info:
        parse_filter_string("invalid_field eq 'value'", valid_options)
    assert exc_info.value.detail == "Unsupported field: invalid_field"


def test_is_matched_parentheses(valid_options):
    with pytest.raises(ValidationException) as exc_info:
        parse_filter_string("(name eq 'John' and age gt 30", valid_options)
    assert exc_info.value.detail == "Mismatched parentheses in filter string"


def test_token_valid(valid_options):
    result = parse_filter_expression("name eq 'John'", valid_options)
    assert result == FilterExpression(key="name", operator=FilterOperator.eq, value="John")


def test_value_null():
    assert parse_value("null") is None


def test_mixed_operators_preserve_last_operator_for_group(valid_options):
    result = parse_filter_string("name eq 'John' or age gt 30 and status eq 'active'", valid_options)
    assert isinstance(result, LogicalFilter)
    assert result.operator == LogicalOperator.and_
    assert len(result.filters) == 3


def test_filter_without_recognized_expressions_preserves_index_error(valid_options):
    with pytest.raises(IndexError):
        parse_filter_string("invalid", valid_options)


def test_unmatched_closing_parenthesis(valid_options):
    with pytest.raises(ValidationException, match="Unmatched closing parenthesis"):
        parse_filter_string("name eq 'John')", valid_options)


def test_value_true():
    assert parse_value("true") is True


def test_value_false():
    assert parse_value("false") is False


def test_numeric_int():
    assert parse_numeric("123") == 123


def test_numeric_float():
    assert parse_numeric("123.45") == 123.45


def test_numeric_string():
    assert parse_numeric("'string'") == "string"


def test_validate_operator_value_invalid_operator():
    with pytest.raises(ValidationException):
        FilterExpression(key="", operator=FilterOperator.gt, value="string")


def test_token_invalid_operator(valid_options):
    with pytest.raises(ValidationException):
        parse_filter_expression("name invalid_operator 'John'", valid_options)


def test_that_and_has_higher_precedence_than_or(valid_options):
    test = parse_filter_string("name eq 'John' or (name eq 'John1' and age gt 30)", valid_options)
    assert test == LogicalFilter(
        operator=LogicalOperator.or_,
        filters=[
            FilterExpression(key="name", operator=FilterOperator.eq, value="John"),
            LogicalFilter(
                operator=LogicalOperator.and_,
                filters=[
                    FilterExpression(key="name", operator=FilterOperator.eq, value="John1"),
                    FilterExpression(key="age", operator=FilterOperator.gt, value=30),
                ],
            ),
        ],
    )
