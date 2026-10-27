import pytest
from pydantic import ValidationError

from team_hermes.validation import (
    ValidationContext,
    ValidationFailure,
    ValidationFailureResponse,
    ValidationResponse,
    ValidationResult,
    ValidationRule,
    ValidationRuleResponse,
    ValidationSet,
    ValidationSeverityLevel,
    ValidationStatus,
)


def make_rule(severity):
    return ValidationRule(
        name=severity.value.lower(),
        display_name=severity.value,
        severity_level=severity,
        check=lambda context: [
            ValidationFailure(value="bad", code="invalid", location="values[0]", message="Invalid value"),
            ValidationFailure(value=None, code="missing"),
        ],
    )


def test_empty_result_serializes_as_success():
    response = ValidationResponse.from_validation_result(ValidationResult())
    assert response.model_dump(mode="json") == {
        "validation_rules": [],
        "validation_message": "No validation errors",
        "validation_status": "SUCCESS",
    }
    assert ValidationResponse.model_validate_json(response.model_dump_json()) == response


@pytest.mark.parametrize(
    ("severity", "status", "message"),
    [
        (ValidationSeverityLevel.INFO, ValidationStatus.SUCCESS, "No validation errors"),
        (ValidationSeverityLevel.WARNING, ValidationStatus.WARNING, "Found 1 validation issue(s)"),
        (ValidationSeverityLevel.ERROR, ValidationStatus.FAILURE, "Validation failed"),
    ],
)
def test_status_and_message_preserve_severity_semantics(severity, status, message):
    result = make_rule(severity).apply(ValidationContext())
    response = ValidationResponse.from_validation_result(result)
    assert response.validation_status is status
    assert response.validation_message == message
    assert len(response.validation_rules[0].validation_failures) == 2
    assert response.validation_rules[0].severity_level == severity.value


def test_errors_take_precedence_over_warnings_and_allow_custom_message():
    result = ValidationSet(
        rules=[make_rule(ValidationSeverityLevel.WARNING), make_rule(ValidationSeverityLevel.ERROR)]
    ).apply(ValidationContext())
    response = ValidationResponse.from_validation_result(result, failure_message="Upload rejected")
    assert response.validation_status is ValidationStatus.FAILURE
    assert response.validation_message == "Upload rejected"


def test_rule_conversion_preserves_fields():
    result = make_rule(ValidationSeverityLevel.ERROR).apply(ValidationContext())
    response = ValidationRuleResponse.from_entity(result.rules[0])
    assert response.model_dump(mode="json") == {
        "name": "error",
        "display_name": "ERROR",
        "severity_level": "ERROR",
        "validation_failures": [
            {"value": "bad", "code": "invalid", "location": "values[0]", "message": "Invalid value"},
            {"value": None, "code": "missing", "location": None, "message": None},
        ],
    }


@pytest.mark.parametrize("value", ["text", 3, 1.5, None, [1, "text", None]])
def test_failure_response_supports_existing_value_types(value):
    response = ValidationFailureResponse.from_entity(ValidationFailure(value=value, code="value"))
    assert response.value == value


def test_failure_response_rejects_mapping_values():
    with pytest.raises(ValidationError):
        ValidationFailureResponse.from_entity(ValidationFailure(value={"unsupported": True}, code="value"))


@pytest.mark.parametrize(
    ("target", "field_name"),
    [("response", "validation_message"), ("rule", "display_name"), ("failure", "message")],
)
def test_response_models_reject_field_reassignment(target, field_name):
    result = make_rule(ValidationSeverityLevel.ERROR).apply(ValidationContext())
    response = ValidationResponse.from_validation_result(result)
    models = {
        "response": response,
        "rule": response.validation_rules[0],
        "failure": response.validation_rules[0].validation_failures[0],
    }
    model = models[target]
    original = model.model_dump(mode="json")
    with pytest.raises(ValidationError) as error:
        setattr(model, field_name, "Changed")
    assert error.value.errors()[0]["type"] == "frozen_instance"
    assert model.model_dump(mode="json") == original
    assert type(model).model_validate_json(model.model_dump_json()) == model


def test_response_freezing_preserves_mutable_lists():
    failure = ValidationFailureResponse(value=["original"], code="invalid")
    rule = ValidationRuleResponse(name="rule", display_name="Rule", severity_level="ERROR", validation_failures=[])
    response = ValidationResponse.from_validation_result(ValidationResult())
    assert isinstance(failure.value, list)
    failure.value.append("additional")
    rule.validation_failures.append(failure)
    response.validation_rules.append(rule)
    assert response.validation_rules[0].validation_failures[0].value == ["original", "additional"]


@pytest.mark.parametrize("field_name", ["upload_id", "validation_message"])
def test_response_subclass_accepts_additional_fields_and_success_message(field_name):
    class UploadValidationResponse(ValidationResponse):
        upload_id: str

    response = UploadValidationResponse.from_validation_result(
        ValidationResult(), success_message="Ready", upload_id="upload-1"
    )
    assert isinstance(response, UploadValidationResponse)
    assert response.upload_id == "upload-1"
    assert response.validation_message == "Ready"
    with pytest.raises(ValidationError) as error:
        setattr(response, field_name, "Changed")
    assert error.value.errors()[0]["type"] == "frozen_instance"
