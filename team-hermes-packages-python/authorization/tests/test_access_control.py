from dataclasses import FrozenInstanceError, dataclass

import pytest

from team_hermes.authorization import AccessControl, Action, AuthorizationSubject, PermissionCheck, Resource, Role


@dataclass
class User:
    roles: list[str]
    user_id: str = "alice"


DOCUMENTS = Resource("documents")
READER = Role("reader")


@pytest.mark.parametrize(
    ("roles", "resource", "action"),
    [
        ([], DOCUMENTS, Action.VIEW),
        (["unknown"], DOCUMENTS, Action.VIEW),
        (["reader"], Resource("unknown"), Action.VIEW),
        (["reader"], DOCUMENTS, Action.DELETE),
    ],
)
def test_missing_permission_denies(roles: list[str], resource: Resource, action: Action) -> None:
    access = AccessControl({READER: {DOCUMENTS: {Action.VIEW: True}}})
    assert not access.has_permission(User(roles), resource, action)


def test_empty_configuration_denies() -> None:
    assert not AccessControl().has_permission(User(["reader"]), DOCUMENTS, Action.VIEW)


@pytest.mark.parametrize("allowed", [True, False])
def test_boolean_permission(allowed: bool) -> None:
    access = AccessControl({READER: {DOCUMENTS: {Action.VIEW: allowed}}})
    assert access.has_permission(User(["reader"]), DOCUMENTS, Action.VIEW) is allowed


@pytest.mark.parametrize("roles", [["reader", "denied"], ["denied", "reader"]])
def test_any_role_can_grant(roles: list[str]) -> None:
    access = AccessControl(
        {
            READER: {DOCUMENTS: {Action.VIEW: True}},
            Role("denied"): {DOCUMENTS: {Action.VIEW: False}},
        }
    )
    assert access.has_permission(User(roles), DOCUMENTS, Action.VIEW)


def test_default_roles_do_not_mutate_user() -> None:
    user = User([])
    default_roles = ["reader"]
    access = AccessControl({READER: {DOCUMENTS: {Action.VIEW: True}}}, default_roles=default_roles)
    assert access.has_permission(user, DOCUMENTS, Action.VIEW)
    assert user.roles == []
    assert default_roles == ["reader"]


def test_custom_and_builtin_string_actions() -> None:
    access = AccessControl({READER: {DOCUMENTS: {"publish": True, Action.VIEW: True}}})
    user = User(["reader"])
    assert access.has_permission(user, DOCUMENTS, "publish")
    assert access.has_permission(user, DOCUMENTS, "view")
    assert not access.has_permission(user, DOCUMENTS, "archive")


def test_value_objects() -> None:
    assert [action.value for action in Action] == ["view", "create", "update", "delete"]
    assert Resource("documents") == DOCUMENTS
    assert {Resource("documents"): True}[DOCUMENTS]
    assert {Role("reader"): True}[READER]
    assert str(DOCUMENTS) == "documents"
    assert str(READER) == "reader"
    with pytest.raises(FrozenInstanceError):
        DOCUMENTS.__setattr__("value", "changed")
    with pytest.raises(FrozenInstanceError):
        READER.__setattr__("value", "changed")


def test_predicate_receives_original_user_and_filters_context() -> None:
    user = User(["reader"])

    def owns_document(subject: User, owner: str, *, enabled: bool = True) -> bool:
        assert subject is user
        return enabled and subject.user_id == owner

    access = AccessControl({READER: {DOCUMENTS: {Action.UPDATE: owns_document}}})
    assert access.has_permission(user, DOCUMENTS, Action.UPDATE, owner="alice", unrelated=123)
    assert not access.has_permission(user, DOCUMENTS, Action.UPDATE, owner="bob")
    assert not access.has_permission(user, DOCUMENTS, Action.UPDATE, owner="alice", enabled=False)


def test_predicate_accepts_subject_protocol_annotation() -> None:
    def is_reader(subject: AuthorizationSubject) -> bool:
        return "reader" in subject.roles

    user = User(["reader"])
    assert isinstance(user, AuthorizationSubject)
    access = AccessControl({READER: {DOCUMENTS: {Action.VIEW: is_reader}}})
    assert access.has_permission(user, DOCUMENTS, Action.VIEW)


def test_unannotated_predicate() -> None:
    access = AccessControl({READER: {DOCUMENTS: {Action.VIEW: lambda user, owner="alice": user.user_id == owner}}})
    assert access.has_permission(User(["reader"]), DOCUMENTS, Action.VIEW)


def test_role_order_and_short_circuit() -> None:
    calls: list[str] = []

    def record(name: str, allowed: bool) -> PermissionCheck:
        def check(user: User) -> bool:
            calls.append(name)
            return allowed

        return check

    access = AccessControl(
        {
            Role("first"): {DOCUMENTS: {Action.VIEW: record("first", False)}},
            Role("second"): {DOCUMENTS: {Action.VIEW: record("second", True)}},
            Role("default"): {DOCUMENTS: {Action.VIEW: record("default", True)}},
        },
        default_roles=["default"],
    )
    assert access.has_permission(User(["first", "second"]), DOCUMENTS, Action.VIEW)
    assert calls == ["first", "second"]
    calls.clear()
    assert access.has_permission(User(["first"]), DOCUMENTS, Action.VIEW)
    assert calls == ["first", "default"]


def test_missing_predicate_argument_raises() -> None:
    def check(user: User, owner: str) -> bool:
        return user.user_id == owner

    access = AccessControl({READER: {DOCUMENTS: {Action.VIEW: check}}})
    with pytest.raises(TypeError, match="Error binding arguments for permission check 'check'.*owner"):
        access.has_permission(User(["reader"]), DOCUMENTS, Action.VIEW)


def test_wrong_predicate_argument_type_raises() -> None:
    def check(user: User, owner: str) -> bool:
        return user.user_id == owner

    access = AccessControl({READER: {DOCUMENTS: {Action.VIEW: check}}})
    with pytest.raises(TypeError, match="Invalid type for argument 'owner' in permission check 'check'"):
        access.has_permission(User(["reader"]), DOCUMENTS, Action.VIEW, owner=123)


def test_predicate_exception_propagates_before_later_grant() -> None:
    def check(user: User) -> bool:
        raise ValueError("predicate failed")

    access = AccessControl(
        {
            READER: {DOCUMENTS: {Action.VIEW: check}},
            Role("admin"): {DOCUMENTS: {Action.VIEW: True}},
        }
    )
    with pytest.raises(ValueError, match="predicate failed"):
        access.has_permission(User(["reader", "admin"]), DOCUMENTS, Action.VIEW)
