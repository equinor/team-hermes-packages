# Team Hermes Authorization

Role and attribute-based permission checks for Python 3.12+, with no runtime dependencies.

## Installation

From the repository root, install the package locally:

```shell
uv pip install ./team-hermes-packages-python/authorization
```

Import from `team_hermes.authorization`. The package uses the shared implicit
`team_hermes` namespace and includes `py.typed`.

## Usage

The caller supplies an authenticated subject with a `roles: list[str]` attribute.
It need not inherit from `AuthorizationSubject`, the runtime-checkable structural
protocol used by the engine. Identity models and authentication stay in the application.

```pycon
>>> from dataclasses import dataclass
>>> from team_hermes.authorization import AccessControl, Action, AuthorizationSubject, Permissions, Resource, Role
>>> @dataclass
... class User:
...     user_id: str
...     roles: list[str]
>>> @dataclass
... class Document:
...     owner_id: str
>>> def is_owner(user: User, document: Document) -> bool:
...     return user.user_id == document.owner_id
>>> documents = Resource("documents")
>>> member_permissions: Permissions = {
...     documents: {Action.VIEW: True, Action.UPDATE: is_owner},
... }
>>> access = AccessControl({Role("member"): member_permissions})
>>> alice = User("alice", ["member"])
>>> isinstance(alice, AuthorizationSubject)
True
>>> access.has_permission(alice, documents, Action.VIEW)
True
>>> access.has_permission(alice, documents, Action.UPDATE, document=Document("alice"))
True
>>> access.has_permission(alice, documents, Action.UPDATE, document=Document("bob"))
False
>>> access.has_permission(alice, documents, Action.DELETE)
False
>>> access.has_permission(User("guest", []), documents, Action.VIEW)
False

```

Default roles are appended to the subject's roles without modifying the subject.
Custom actions can be strings:

```pycon
>>> access = AccessControl(
...     {Role("default"): {documents: {"download": True}}},
...     default_roles=["default"],
... )
>>> access.has_permission(User("guest", []), documents, "download")
True

```

## Permission Semantics

- Missing roles, resources, and actions deny access.
- Any role may grant access. A `False` permission is not a deny override for other roles.
- Roles are evaluated in subject order, followed by default roles. The first grant
  short-circuits evaluation.
- Predicates receive the original subject as their first positional argument.
  Only context keywords matching declared parameter names are forwarded, and
  parameter defaults are applied. A catch-all `**kwargs` parameter does not collect
  arbitrary context keywords.
- Missing required arguments and incompatible annotated values raise `TypeError`.
  Predicate exceptions propagate, even when a later role could grant access.
  Callers must not treat errors as grants.
- Parameter annotations are checked with `isinstance`. Use concrete runtime types
  or runtime-checkable protocols. String/postponed annotations, `typing.Any`, and
  parameterized containers such as `list[str]` are not supported. Unannotated
  parameters are accepted.
- Predicates are synchronous boolean-returning functions. Async predicates are
  unsupported; the engine does not await or validate return types.

`Action` defines `view`, `create`, `update`, and `delete`. `Resource` and `Role` are
immutable, hashable value objects. `PermissionCheck` describes a predicate, and
`Permissions` describes a resource-to-action permission mapping.

The package does not supply role assignments, domain policies, HTTP exceptions,
authentication, or persistence. Applications own and enforce those boundaries.

## Development

From the repository root:

```shell
mise run python:test -- authorization/tests
mise run python:test:authorization
mise run python:lint
mise run python:typecheck
```

The isolated authorization task builds the sdist and wheel and runs tests against
the installed wheel, including the README embedded in its metadata.
