from dataclasses import dataclass, field

import pytest

from team_hermes.validation import (
    ValidationContext,
    ValidationEngine,
    ValidationFailure,
    ValidationResult,
    ValidationRule,
    ValidationSet,
    ValidationSeverityLevel,
    validation_rule,
)


def make_rule(severity=ValidationSeverityLevel.WARNING):
    return ValidationRule(
        name=severity.value.lower(),
        display_name=severity.value,
        check=lambda context: [ValidationFailure(value="failure", code="test_failure", message="Test failure")],
        severity_level=severity,
    )


def test_applies_rule_to_context_and_returns_failures():
    result = make_rule(ValidationSeverityLevel.ERROR).apply(ValidationContext())
    assert result.has_errors()
    assert len(result.rules) == 1


def test_applies_validation_set_to_context_and_aggregates_results():
    validation_set = ValidationSet(rules=[make_rule(), make_rule(ValidationSeverityLevel.ERROR)])
    result = validation_set.apply(ValidationContext())
    assert result.has_errors()
    assert len(result.rules) == 2


@pytest.mark.parametrize("findings", [None, []])
def test_returns_no_failures_when_no_rules_are_violated(findings):
    rule = ValidationRule(name="pass", display_name="Pass", check=lambda context: findings)
    result = rule.apply(ValidationContext())
    assert not result.has_errors()
    assert result.is_valid
    assert result.rules == []


def test_aggregates_results_from_multiple_validation_sets_without_mutating_inputs():
    context = ValidationContext()
    warnings = ValidationSet(rules=[make_rule()]).apply(context)
    errors = ValidationSet(rules=[make_rule(ValidationSeverityLevel.ERROR)]).apply(context)
    result = warnings + errors
    assert result.has_errors()
    assert len(result.rules) == 2
    assert len(warnings.rules) == len(errors.rules) == 1
    assert result.rules == warnings.rules + errors.rules


def test_handles_empty_validation_set_without_errors():
    result = ValidationSet().apply(ValidationContext())
    assert result.is_valid
    assert result.rules == []


def test_validation_result_warnings():
    result = ValidationSet(rules=[make_rule(), make_rule(ValidationSeverityLevel.ERROR)]).apply(ValidationContext())
    assert len(result.warnings()) == 1
    assert result.warnings()[0][0].name == "warning"


@pytest.mark.parametrize(
    ("severity", "valid", "has_errors"),
    [
        (ValidationSeverityLevel.INFO, True, False),
        (ValidationSeverityLevel.WARNING, False, False),
        (ValidationSeverityLevel.ERROR, False, True),
    ],
)
def test_severity_controls_validity(severity, valid, has_errors):
    result = make_rule(severity).apply(ValidationContext())
    assert result.is_valid is valid
    assert result.has_errors() is has_errors
    assert str(severity) == severity.value


def test_cache_preserves_falsey_values_and_is_per_context():
    context = ValidationContext()
    calls = []

    def populate():
        calls.append("called")
        return None

    assert context.cached("key", populate) is None
    assert context.cached("key", populate) is None
    assert calls == ["called"]
    context.clear_cached("key")
    context.clear_cached("missing")
    assert context.cached("key", populate) is None
    assert calls == ["called", "called"]
    assert context.cached(("item", 1), lambda: 3) == 3
    assert ValidationContext().context_cache == {}


def test_nested_sets_expand_paths_and_forward_context():
    @dataclass
    class Group:
        values: list[int]

    @dataclass
    class Context(ValidationContext):
        groups: list[Group] = field(default_factory=list)

    context = Context(groups=[Group(values=[1, 2]), Group(values=[3])])

    @validation_rule("Check values")
    def check_value(value: int, context: Context, path: str):
        assert len(context.groups) == 2
        return [ValidationFailure(value=value, code="value", location=path)]

    nested = ValidationSet(path="groups", rules=[ValidationSet(path="values", rules=[check_value])])
    engine = ValidationEngine()
    assert engine.add_rule(nested) is engine
    assert engine.add_rules([make_rule(ValidationSeverityLevel.INFO)]) is engine
    result = engine.validate(context)
    assert len(result.rules) == 2
    assert [finding.location for finding in result.rules[0][1]] == ["values[0]", "values[1]", "values[0]"]
    assert [finding.value for finding in result.rules[0][1]] == [1, 2, 3]


def test_engine_does_not_accumulate_results_between_runs():
    engine = ValidationEngine().add_rules([make_rule()])
    assert len(engine.validate(ValidationContext()).rules) == 1
    assert len(engine.validate(ValidationContext()).rules) == 1
    assert ValidationEngine().validate(ValidationContext()).is_valid


def test_result_rejects_non_result_addition():
    with pytest.raises(TypeError, match="Can only add ValidationResult instances"):
        ValidationResult() + 1


@pytest.mark.parametrize("error_type", [TypeError, RuntimeError])
def test_rule_exceptions_propagate(error_type):
    def fail(context):
        raise error_type("check failed")

    with pytest.raises(error_type, match="check failed"):
        ValidationRule(name="broken", display_name="Broken", check=fail).apply(ValidationContext())


def test_failure_string_representation():
    assert str(ValidationFailure(value=3, code="test")) == "3"
    assert str(ValidationFailure(value=3, code="test", location="values[0]", message="Invalid")) == (
        "3 at values[0] - Invalid"
    )
