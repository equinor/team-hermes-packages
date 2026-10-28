import inspect
from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum, auto
from typing import Protocol, runtime_checkable


@runtime_checkable
class AuthorizationSubject(Protocol):
    @property
    def roles(self) -> list[str]: ...


class Action(StrEnum):
    VIEW = auto()
    CREATE = auto()
    UPDATE = auto()
    DELETE = auto()


@dataclass(frozen=True)
class Resource:
    value: str

    def __str__(self) -> str:
        return self.value


@dataclass(frozen=True)
class Role:
    value: str

    def __str__(self) -> str:
        return self.value


type PermissionCheck = Callable[..., bool]
type Permissions = dict[Resource, dict[Action | str, bool | PermissionCheck]]


def _execute_permission_check(check: PermissionCheck, user: AuthorizationSubject, /, **kwargs: object) -> bool:
    signature = inspect.signature(check)
    filtered_kwargs = {name: value for name, value in kwargs.items() if name in signature.parameters}

    try:
        bound = signature.bind(user, **filtered_kwargs)
        bound.apply_defaults()
    except TypeError as error:
        raise TypeError(f"Error binding arguments for permission check '{check.__name__}': {error}") from error

    for param_name, param_value in bound.arguments.items():
        expected_type = signature.parameters[param_name].annotation
        if expected_type is not inspect.Parameter.empty and not isinstance(param_value, expected_type):
            raise TypeError(
                f"Invalid type for argument '{param_name}' in permission check '{check.__name__}': "
                f"expected {expected_type}, got {type(param_value)}"
            )

    return check(*bound.args, **bound.kwargs)


class AccessControl:
    def __init__(self, rules: dict[Role, Permissions] | None = None, default_roles: list[str] | None = None) -> None:
        self.rules = rules or {}
        self.default_roles = default_roles or []

    def has_permission(
        self, user: AuthorizationSubject, resource: Resource, action: Action | str, **kwargs: object
    ) -> bool:
        roles = user.roles + self.default_roles
        return any(
            (_execute_permission_check(check, user, **kwargs) if callable(check) else check)
            for role in roles
            if (check := self.rules.get(Role(role), {}).get(resource, {}).get(action))
        )
