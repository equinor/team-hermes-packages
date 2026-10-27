"""Framework-independent validation rules, results, and serializable reports."""

from .entities import (
    ValidationContext,
    ValidationEngine,
    ValidationFailure,
    ValidationResult,
    ValidationRule,
    ValidationSet,
    ValidationSeverityLevel,
)
from .paths import get_targets_by_path
from .response import ValidationFailureResponse, ValidationResponse, ValidationRuleResponse, ValidationStatus
from .validation_rule import validation_rule

__all__ = [
    "ValidationContext",
    "ValidationEngine",
    "ValidationFailure",
    "ValidationFailureResponse",
    "ValidationResult",
    "ValidationResponse",
    "ValidationRule",
    "ValidationRuleResponse",
    "ValidationSet",
    "ValidationSeverityLevel",
    "ValidationStatus",
    "get_targets_by_path",
    "validation_rule",
]
