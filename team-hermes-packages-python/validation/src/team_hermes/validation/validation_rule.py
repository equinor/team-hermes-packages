import functools
import inspect
from collections.abc import Callable
from typing import Any

from .entities import ValidationRule, ValidationSeverityLevel


def validation_rule(
    display_name: str,
    severity_level: ValidationSeverityLevel = ValidationSeverityLevel.WARNING,
    target_path: str | None = None,
    description: str | None = None,
) -> Callable[[Callable[..., Any]], ValidationRule]:
    """Turn a check function into a :class:`ValidationRule`.

    The decorated name refers to a rule, not a callable function. Run it with
    ``rule.apply(context)`` or add it to a ``ValidationSet`` or ``ValidationEngine``.
    A check returns a list of ``ValidationFailure`` objects, or ``[]``/``None``
    when there are no findings. Exceptions are not converted into findings.

    Args:
        display_name: Human-readable rule label. The function name is the rule ID.
        severity_level: Severity of findings; defaults to WARNING. Warnings make
            ``result.is_valid`` false but do not make ``result.has_errors()`` true.
        target_path: Optional dotted attribute path relative to the context.
            Lists are expanded into individual targets; missing or None attributes
            are skipped. Without a path, the check receives the whole context.
        description: Optional explanatory text stored on the rule.

    Returns:
        A decorator that replaces the check function with a configured rule.

    With a target path, the check receives each target as its first positional
    argument. ``context`` and ``path`` are forwarded only when declared by the
    check. ``path`` omits the first dotted segment of the target location and is
    None for a top-level target. Other optional parameters retain their defaults.

    Scalar arguments with annotations are checked using ``isinstance``. Use
    concrete runtime annotations: postponed/string annotations are not resolved,
    and parameterized types such as ``list[int]`` are not generally supported by
    this check. List and dict argument values bypass the annotation check.

    Examples:
        Validate the whole context and select ERROR severity explicitly:

        >>> from dataclasses import dataclass
        >>> from team_hermes.validation import ValidationContext, ValidationFailure
        >>> @dataclass
        ... class Batch(ValidationContext):
        ...     values: list[int]
        >>> @validation_rule("Batch is not empty", severity_level=ValidationSeverityLevel.ERROR)
        ... def not_empty(context: Batch):
        ...     if not context.values:
        ...         return [ValidationFailure(value=context.values, code="empty")]
        ...     return []
        >>> not_empty.name
        'not_empty'
        >>> not_empty.apply(Batch(values=[1])).is_valid
        True
        >>> not_empty.apply(Batch(values=[])).has_errors()
        True

        Validate each list item. This check does not declare ``context`` or
        ``path``, so neither is forwarded, and ``minimum`` keeps its default:

        >>> @validation_rule("Non-negative values", target_path="values")
        ... def non_negative(value: int, minimum: int = 0):
        ...     if value < minimum:
        ...         return [ValidationFailure(value=value, code="below_minimum")]
        ...     return None
        >>> result = non_negative.apply(Batch(values=[2, -1]))
        >>> result.rules[0][1][0].value
        -1
        >>> result.is_valid, result.has_errors()
        (False, False)
        >>> non_negative.apply(Batch(values=[0, 2])).is_valid
        True
    """

    def decorator(func: Callable[..., Any]) -> ValidationRule:
        signature = inspect.signature(func)
        parameter_names = list(signature.parameters.keys())

        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            filtered_kwargs = {key: value for key, value in kwargs.items() if key in parameter_names}
            try:
                bound = signature.bind_partial(*args, **filtered_kwargs)
            except TypeError as error:
                raise TypeError(f"Error binding arguments for {func.__name__}: {error}") from error
            bound.apply_defaults()

            for parameter_name, parameter_value in bound.arguments.items():
                expected = signature.parameters[parameter_name].annotation
                if (
                    not isinstance(parameter_value, dict | list)
                    and expected is not inspect.Parameter.empty
                    and not isinstance(parameter_value, expected)
                ):
                    raise TypeError(
                        f"Argument '{parameter_name}' to '{func.__name__}' "
                        f"must be {expected}, got {type(parameter_value)}"
                    )

            return func(*bound.args, **bound.kwargs)

        return ValidationRule(
            name=func.__name__,
            display_name=display_name,
            severity_level=severity_level,
            check=wrapper,
            target_path=target_path,
            description=description,
        )

    return decorator
