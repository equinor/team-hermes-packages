import datetime
import json

import pytest
from pydantic import TypeAdapter, ValidationError
from team_hermes.core.exceptions import ValidationException

from team_hermes.query.models import (
    BOOL_OPERATORS,
    DEFAULT_OPERATORS,
    NUM_OPERATORS,
    STR_OPERATORS,
    BooleanFilterExpression,
    FilterBy,
    FilterExpression,
    FilterExpressions,
    FilterOperator,
    GeneralFilterExpression,
    LogicalFilter,
    LogicalOperator,
    NumericFilterExpression,
    OrderBy,
    Select,
    SortDirection,
    StringFilterExpression,
)

NUMERIC_VALUES = [
    12,
    12.5,
    datetime.date(2026, 10, 27),
    datetime.datetime(2026, 10, 27, 10, 30, tzinfo=datetime.UTC),
    datetime.time(10, 30),
]


@pytest.mark.parametrize("operator", NUM_OPERATORS)
@pytest.mark.parametrize("value", NUMERIC_VALUES)
def test_numeric_operators(operator, value):
    expression = FilterExpression(key="items.quantity", operator=operator, value=value)
    assert isinstance(expression.expression, NumericFilterExpression)
    assert expression.key == "items.quantity"
    assert expression.operator is operator
    assert expression.value == value
    assert type(expression.value) is type(value)


@pytest.mark.parametrize("operator", BOOL_OPERATORS)
@pytest.mark.parametrize("value", [True, False, None])
def test_boolean_operators(operator, value):
    expression = FilterExpression(key="deleted_at", operator=operator, value=value)
    assert isinstance(expression.expression, BooleanFilterExpression)
    assert expression.value is value


@pytest.mark.parametrize("operator", STR_OPERATORS)
def test_string_operators(operator):
    expression = FilterExpression(key="name", operator=operator.value, value="Alice,Bob")
    assert isinstance(expression.expression, StringFilterExpression)
    assert expression.operator is operator
    assert expression.value == "Alice,Bob"


@pytest.mark.parametrize("operator", DEFAULT_OPERATORS)
@pytest.mark.parametrize("value", [*NUMERIC_VALUES, True, False, "pending", None])
def test_general_operators(operator, value):
    expression = FilterExpression(key="value", operator=operator, value=value)
    assert isinstance(expression.expression, GeneralFilterExpression)
    assert expression.value == value
    assert type(expression.value) is type(value)


def test_operator_groups_cover_all_operators_without_overlap():
    operators = [*NUM_OPERATORS, *BOOL_OPERATORS, *STR_OPERATORS, *DEFAULT_OPERATORS]
    assert len(operators) == len(set(operators)) == 18
    assert set(operators) == set(FilterOperator)
    assert [operator.value for operator in LogicalOperator] == ["and_", "or_"]
    assert [direction.value for direction in SortDirection] == ["asc", "desc"]


def test_unknown_operator_raises_application_validation_exception():
    with pytest.raises(ValidationException, match="Unsupported operator: 'unknown'"):
        FilterExpression(key="quantity", operator="unknown", value=5)


@pytest.mark.parametrize(
    "operator,value",
    [
        (FilterOperator.gt, "5"),
        (FilterOperator.gt, None),
        (FilterOperator.isnull, 1),
        (FilterOperator.notnull, "true"),
        (FilterOperator.like, 1),
        (FilterOperator.inlist, ["Alice", "Bob"]),
    ],
)
def test_invalid_operator_value_pairs(operator, value):
    with pytest.raises(ValidationException, match="Invalid operator"):
        FilterExpression(key="value", operator=operator, value=value)


def test_numeric_boolean_coercion_is_preserved():
    expression = FilterExpression(key="quantity", operator=FilterOperator.gt, value=True)
    assert expression.value == 1
    assert type(expression.value) is int


def test_serialized_expression_uses_nested_discriminated_model():
    expression = FilterExpression(key="quantity", operator="gt", value=5)
    payload = {"key": "quantity", "expression": {"operator": "gt", "value": 5}}
    assert expression.model_dump(mode="json") == payload
    assert json.loads(expression.model_dump_json()) == payload
    schema = FilterExpression.model_json_schema()["properties"]["expression"]
    assert schema["discriminator"]["propertyName"] == "operator"
    assert set(schema["discriminator"]["mapping"]) == {operator.value for operator in FilterOperator}
    with pytest.raises(KeyError, match="operator"):
        FilterExpression.model_validate(payload)


def test_flat_input_validation():
    expression = FilterExpression.model_validate({"key": "quantity", "operator": "gt", "value": 5})
    assert expression.operator is FilterOperator.gt
    assert expression.value == 5
    with pytest.raises(KeyError, match="value"):
        FilterExpression.model_validate({"key": "quantity", "operator": "gt"})


def test_nested_logical_filters_and_filter_alias():
    quantity = FilterExpression(key="quantity", operator="gte", value=5)
    status = FilterExpression(key="status", operator="eq", value="pending")
    alternative = LogicalFilter(operator=LogicalOperator.or_, filters=[quantity, status])
    filters = LogicalFilter(operator=LogicalOperator.and_, filters=[alternative, quantity])
    assert filters.filters[0] is alternative
    assert alternative.filters == [quantity, status]
    assert TypeAdapter(FilterBy).validate_python(filters) is filters
    assert TypeAdapter(FilterBy).validate_python(quantity) is quantity
    schema = TypeAdapter(FilterBy).json_schema()
    assert {"FilterExpression", "LogicalFilter"} <= schema["$defs"].keys()
    assert json.loads(filters.model_dump_json()) == {
        "operator": "and_",
        "filters": [
            {
                "operator": "or_",
                "filters": [quantity.model_dump(mode="json"), status.model_dump(mode="json")],
            },
            quantity.model_dump(mode="json"),
        ],
    }


def test_logical_filter_empty_group_and_invalid_operator():
    assert LogicalFilter(operator=LogicalOperator.and_, filters=[]).filters == []
    with pytest.raises(ValidationError):
        LogicalFilter.model_validate({"operator": "and", "filters": []})


@pytest.mark.parametrize(
    "expression_class,operator,value",
    [
        (NumericFilterExpression, "gt", 5),
        (BooleanFilterExpression, "isnull", None),
        (StringFilterExpression, "like", "item%"),
        (GeneralFilterExpression, "eq", "pending"),
    ],
)
def test_expression_models_round_trip_and_reject_wrong_operator(expression_class, operator, value):
    expression = expression_class(operator=operator, value=value)
    assert expression_class.model_validate_json(expression.model_dump_json()) == expression
    assert TypeAdapter(FilterExpressions).validate_python(expression.model_dump()) == expression
    with pytest.raises(ValidationError):
        expression_class(operator="unknown", value=value)


def test_sorting_and_selection():
    order = OrderBy.model_validate({"key": "created_at", "direction": "desc"})
    assert order.direction is SortDirection.desc
    assert order.model_dump(mode="json") == {"key": "created_at", "direction": "desc"}
    selection = Select(fields=["id", "items.name", "id"])
    assert selection.model_dump() == {"fields": ["id", "items.name", "id"]}
    assert Select(fields=[]).fields == []
    assert OrderBy.model_validate_json(order.model_dump_json()) == order
    with pytest.raises(ValidationError):
        OrderBy.model_validate({"key": "id", "direction": "DESC"})
    with pytest.raises(ValidationError):
        Select.model_validate({"fields": [1]})
