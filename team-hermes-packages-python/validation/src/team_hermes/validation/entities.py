import traceback
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import Enum, unique
from typing import Any, Self

from .paths import get_targets_by_path


@unique
class ValidationSeverityLevel(Enum):
    """Levels of validation severity."""

    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"

    def __str__(self) -> str:
        return self.value


@dataclass(kw_only=True)
class ValidationContext:
    """Base class for validation contexts with an explicitly managed cache."""

    context_cache: dict[str | tuple, Any] = field(default_factory=dict)

    def cached(self, key: str | tuple, populate: Callable[[], Any]) -> Any:
        """Retrieve a cached value or populate it if not present."""
        if key not in self.context_cache:
            self.context_cache[key] = populate()
        return self.context_cache[key]

    def clear_cached(self, key: str) -> None:
        """Clear a cached value for the given key."""
        self.context_cache.pop(key, None)


@dataclass(frozen=True)
class ValidationFailure:
    """A validation finding with a code and optional location and message."""

    value: Any
    code: str
    location: str | None = None
    message: str | None = None

    def __str__(self) -> str:
        return f"{self.value} at {self.location} - {self.message}" if self.message else str(self.value)


@dataclass(frozen=True)
class ValidationRule:
    """A named check applied to a context or targets within it."""

    name: str
    display_name: str
    check: Callable[..., list[ValidationFailure] | None]
    severity_level: ValidationSeverityLevel = ValidationSeverityLevel.WARNING
    target_path: str | None = None
    description: str | None = None

    def apply(self, context: ValidationContext) -> "ValidationResult":
        """Apply this rule to the context."""
        result = ValidationResult()
        targets = get_targets_by_path(context, self.target_path) if self.target_path else [(context, "")]
        if failures := self.check_targets(targets, context):
            result.add_rule(self, failures)
        return result

    def check_targets(self, targets: list[tuple[Any, str]], context: ValidationContext) -> list[ValidationFailure]:
        """Apply the check to targets, preserving their relative locations."""
        failures: list[ValidationFailure] = []
        for target, target_path in targets:
            filtered_path = target_path.split(".", 1)[1] if target_path and "." in target_path else None
            try:
                if target_path != "":
                    if target_failures := self.check(
                        target, context=context, path=filtered_path, target_path=target_path
                    ):
                        failures.extend(target_failures)
                else:
                    if target_failures := self.check(context):
                        failures.extend(target_failures)
            except TypeError:
                raise
            except Exception as error:
                print(f"Error applying validation rule '{self.name}' to target at path '{target_path}': {error}")
                traceback.print_exc()
                raise
        return failures


@dataclass(frozen=True)
class ValidationSet:
    """A group of rules or nested sets optionally scoped to a target path."""

    rules: list[ValidationRule | Self] = field(default_factory=list)
    path: str | None = None

    def apply(self, context: ValidationContext, parent_path: str | None = None) -> "ValidationResult":
        """Apply all rules in the set to the context."""
        result = ValidationResult()
        full_path = f"{parent_path}.{self.path}" if parent_path and self.path else self.path or parent_path
        targets = get_targets_by_path(context, full_path) if full_path else [(context, "")]
        for rule in self.rules:
            if isinstance(rule, ValidationSet):
                result += rule.apply(context, parent_path=full_path)
            else:
                if failures := rule.check_targets(targets, context):
                    result.add_rule(rule, failures)
        return result


class ValidationResult:
    """Findings grouped by rule, including informational findings and warnings."""

    def __init__(self) -> None:
        self.rules: list[tuple[ValidationRule, list[ValidationFailure]]] = []

    def add_rule(self, rule: ValidationRule, validation_failures: list[ValidationFailure]) -> None:
        """Append a rule and its findings."""
        self.rules.append((rule, validation_failures))

    def has_errors(self) -> bool:
        """Return whether any recorded rule has error severity."""
        return any(finding[0].severity_level == ValidationSeverityLevel.ERROR for finding in self.rules)

    def warnings(self) -> list[tuple[ValidationRule, list[ValidationFailure]]]:
        """Return findings grouped by warning-level rule."""
        return [finding for finding in self.rules if finding[0].severity_level == ValidationSeverityLevel.WARNING]

    @property
    def is_valid(self) -> bool:
        """Return whether neither errors nor warnings were recorded."""
        return not self.has_errors() and len(self.warnings()) == 0

    def __add__(self, other: Any) -> "ValidationResult":
        if not isinstance(other, ValidationResult):
            raise TypeError("Can only add ValidationResult instances")
        result = ValidationResult()
        result.rules = self.rules + other.rules
        return result


class ValidationEngine:
    """Evaluate registered rules and sets against a context."""

    def __init__(self) -> None:
        self.rules: list[ValidationRule | ValidationSet] = []

    def add_rule(self, rule: ValidationRule | ValidationSet) -> Self:
        self.rules.append(rule)
        return self

    def add_rules(self, rules: list[ValidationRule | ValidationSet]) -> Self:
        for rule in rules:
            self.add_rule(rule)
        return self

    def validate(self, context: ValidationContext) -> ValidationResult:
        result = ValidationResult()
        for rule in self.rules:
            result += rule.apply(context)
        return result
