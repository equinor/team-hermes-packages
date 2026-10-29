import doctest
import inspect
from dataclasses import dataclass
from typing import Any

import pytest

from team_hermes.validation import ValidationContext, ValidationFailure, ValidationSeverityLevel, validation_rule


def test_validation_rule_doctests():
    module = inspect.getmodule(validation_rule)
    assert module is not None
    result = doctest.testmod(module, raise_on_error=True)
    assert result.attempted > 0


def test_raises_type_error_for_invalid_context_argument():
    @validation_rule("Type Check Rule", target_path="target")
    def check_func(value: int, context: ValidationContext, path: str | None):
        return None

    @dataclass
    class Context(ValidationContext):
        target: Any

    with pytest.raises(TypeError, match="must be <class 'int'>"):
        check_func.apply(Context(target="should_be_int"))


def test_validation_rule_decorator_usage_with_failure():
    @validation_rule("Decorator Rule", severity_level=ValidationSeverityLevel.ERROR, description="A check")
    def decorator_rule(value):
        return [ValidationFailure(value="fail", code="test_failure", message="Test failure")]

    result = decorator_rule.apply(ValidationContext())
    assert result.has_errors()
    assert len(result.rules) == 1
    assert result.rules[0][0].name == "decorator_rule"
    assert decorator_rule.display_name == "Decorator Rule"
    assert decorator_rule.description == "A check"


def test_validation_rule_decorator_usage_without_failure():
    @validation_rule("Decorator Rule", severity_level=ValidationSeverityLevel.ERROR)
    def check_func(value):
        return []

    result = check_func.apply(ValidationContext())
    assert not result.has_errors()
    assert result.rules == []


def test_target_check_filters_unused_arguments_and_preserves_defaults():
    @dataclass
    class Context(ValidationContext):
        target: int

    @validation_rule("Check target", target_path="target")
    def check_target(value: int, minimum: int = 2):
        return [ValidationFailure(value=value, code="too_small")] if value < minimum else None

    result = check_target.apply(Context(target=1))
    assert len(result.rules) == 1
    assert check_target.apply(Context(target=2)).is_valid


def test_top_level_target_has_no_relative_path():
    @dataclass
    class Context(ValidationContext):
        target: int

    @validation_rule("Check target", target_path="target")
    def check_target(value: int, path: str | None):
        assert path is None
        return None

    assert check_target.apply(Context(target=1)).is_valid


@pytest.mark.parametrize(
    ("rule_path", "expected_locations"),
    [
        ("target", ["target"]),
        ("values", ["values[0]", "values[1]"]),
        ("group.values", ["group.values[0]", "group.values[1]"]),
    ],
)
def test_target_check_receives_full_target_path(rule_path, expected_locations):
    @dataclass
    class Group:
        values: list[int]

    @dataclass
    class Context(ValidationContext):
        target: int
        values: list[int]
        group: Group

    @validation_rule("Check target location", target_path=rule_path)
    def check_target(value: int, target_path: str):
        return [ValidationFailure(value=value, code="invalid", location=target_path)]

    context = Context(target=1, values=[2, 3], group=Group(values=[4, 5]))
    result = check_target.apply(context)
    assert [finding.location for finding in result.rules[0][1]] == expected_locations


@pytest.mark.parametrize("value", [[1, "mixed"], {"value": 1}])
def test_collection_values_bypass_runtime_annotation_check(value):
    @validation_rule("Collections")
    def check_collection(value: int):
        return None

    assert check_collection.check(value) is None


def test_binding_error_identifies_check():
    @validation_rule("Check")
    def check_target(value: int):
        return None

    with pytest.raises(TypeError, match="Error binding arguments for check_target"):
        check_target.check(1, 2)


def test_missing_target_does_not_run_check():
    @validation_rule("Missing", target_path="missing")
    def check_missing(value):
        pytest.fail("Missing targets should not run checks")

    assert check_missing.apply(ValidationContext()).is_valid
