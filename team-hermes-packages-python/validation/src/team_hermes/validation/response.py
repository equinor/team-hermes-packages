from enum import Enum, unique
from typing import Any, Self

from pydantic import BaseModel

from .entities import ValidationFailure, ValidationResult, ValidationRule


@unique
class ValidationStatus(Enum):
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    WARNING = "WARNING"


class ValidationFailureResponse(BaseModel, frozen=True):
    value: str | float | None | list[Any]
    location: str | None = None
    message: str | None = None
    code: str

    @classmethod
    def from_entity(cls, validation_failure: ValidationFailure) -> Self:
        return cls(
            value=validation_failure.value,
            location=validation_failure.location,
            message=validation_failure.message,
            code=validation_failure.code,
        )


class ValidationRuleResponse(BaseModel, frozen=True):
    name: str
    display_name: str
    severity_level: str
    validation_failures: list[ValidationFailureResponse]

    @classmethod
    def from_entity(cls, validation: tuple[ValidationRule, list[ValidationFailure]]) -> Self:
        validation_rule, validation_failures = validation
        return cls(
            name=validation_rule.name,
            display_name=validation_rule.display_name,
            severity_level=validation_rule.severity_level.value,
            validation_failures=[ValidationFailureResponse.from_entity(failure) for failure in validation_failures],
        )


class ValidationResponse(BaseModel, frozen=True):
    validation_rules: list[ValidationRuleResponse]
    validation_message: str
    validation_status: ValidationStatus = ValidationStatus.SUCCESS

    @classmethod
    def from_validation_result(
        cls,
        validation_result: ValidationResult,
        *,
        failure_message: str = "Validation failed",
        success_message: str = "No validation errors",
        **kwargs: Any,
    ) -> Self:
        rules = [ValidationRuleResponse.from_entity(item) for item in validation_result.rules]
        warnings = validation_result.warnings()

        match (validation_result.has_errors(), warnings):
            case (True, _):
                status, message = ValidationStatus.FAILURE, failure_message
            case (False, [_, *_]):
                status, message = ValidationStatus.WARNING, f"Found {len(warnings)} validation issue(s)"
            case _:
                status, message = ValidationStatus.SUCCESS, success_message

        return cls(
            validation_rules=rules,
            validation_message=message,
            validation_status=status,
            **kwargs,
        )
