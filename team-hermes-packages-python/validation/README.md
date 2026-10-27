# Team Hermes Validation

Framework-independent validation rules, contextual caching, and serializable reports
for Python 3.13+. Pydantic 2 is the only direct runtime dependency. Neither FastAPI
nor another Team Hermes package is required.

## Installation

Build from this repository and install the wheel into an activated environment:

```shell
mise run python:pack
uv pip install team-hermes-packages-python/dist/team_hermes_validation-*.whl
```

See the [Python workspace guide](../README.md) for development prerequisites.

## Usage

Import the public API from `team_hermes.validation`. Checks return a list of
`ValidationFailure` objects, or `None`/an empty list when no findings apply.
Register checks with `ValidationEngine`; use `ValidationSet` to group related
rules or apply them to nested targets. Each validation run returns a fresh result.

The response models belong to this package, alongside the engine. They can be used
for JSON reports, background jobs, or API responses without a web framework.

## Example

```pycon
>>> from dataclasses import dataclass
>>> from team_hermes.validation import (
...     ValidationContext,
...     ValidationEngine,
...     ValidationFailure,
...     ValidationResponse,
...     ValidationSeverityLevel,
...     ValidationStatus,
...     validation_rule,
... )
>>> @dataclass
... class ImportContext(ValidationContext):
...     values: list[float]
>>> @validation_rule("Non-negative values", severity_level=ValidationSeverityLevel.ERROR)
... def non_negative(context: ImportContext) -> list[ValidationFailure]:
...     return [
...         ValidationFailure(
...             value=value,
...             code="negative_value",
...             location=f"values[{index}]",
...             message="Value must be non-negative",
...         )
...         for index, value in enumerate(context.values)
...         if value < 0
...     ]
>>> engine = ValidationEngine().add_rule(non_negative)
>>> result = engine.validate(ImportContext(values=[1.0, -2.0]))
>>> response = ValidationResponse.from_validation_result(result, failure_message="Import rejected")
>>> result.is_valid
False
>>> response.validation_status is ValidationStatus.FAILURE
True
>>> response.validation_message
'Import rejected'
>>> response.validation_rules[0].validation_failures[0].location
'values[1]'
>>> payload = response.model_dump(mode="json")
>>> payload["validation_status"]
'FAILURE'

```

## Nested Model Example

This example validates a batch of customer orders. Each order contains shipments,
and each shipment contains line items. The models and quantity-limit lookup below are self-contained; real
applications supply their own models and repository/client callbacks.

Pydantic validates the input structure. The rule engine then checks business rules,
collecting a warning for an empty shipment and errors for invalid line-item quantities.

```pycon
>>> from collections.abc import Callable
>>> from dataclasses import dataclass
>>> from pydantic import BaseModel
>>> from team_hermes.validation import (
...   ValidationContext,
...   ValidationEngine,
...   ValidationFailure,
...   ValidationResponse,
...   ValidationSet,
...   ValidationSeverityLevel,
...   ValidationStatus,
...   validation_rule,
... )
>>> class LineItem(BaseModel):
...   sku: str
...   quantity: int
>>> class Shipment(BaseModel):
...   shipment_id: str
...   items: list[LineItem]
>>> class Order(BaseModel):
...   order_id: str
...   shipments: list[Shipment]
>>> class OrderBatch(BaseModel):
...   orders: list[Order]
>>> @dataclass
... class OrderValidationContext(ValidationContext):
...   batch: OrderBatch
...   load_quantity_limits: Callable[[], dict[str, int]]
>>> @validation_rule("Shipment has items", severity_level=ValidationSeverityLevel.WARNING)
... def shipment_has_items(shipment: Shipment, path: str) -> list[ValidationFailure]:
...   if shipment.items:
...     return []
...   return [
...     ValidationFailure(
...       value=shipment.shipment_id,
...       code="empty_shipment",
...       location=f"{path}.items",
...       message="Shipment has no line items",
...     )
...   ]
>>> @validation_rule("Line-item quantity within limit", severity_level=ValidationSeverityLevel.ERROR)
... def quantity_within_limit(
...   item: LineItem, context: OrderValidationContext, path: str
... ) -> list[ValidationFailure]:
...   limits = context.cached("quantity_limits", context.load_quantity_limits)
...   maximum = limits[item.sku]
...   if 1 <= item.quantity <= maximum:
...     return []
...   return [
...     ValidationFailure(
...       value=item.quantity,
...       code="invalid_quantity",
...       location=f"{path}.quantity",
...       message=f"Quantity for {item.sku} must be between 1 and {maximum} per line item",
...     )
...   ]
>>> rules = ValidationSet(
...   path="batch",
...   rules=[
...     ValidationSet(
...       path="orders",
...       rules=[
...         ValidationSet(
...           path="shipments",
...           rules=[
...             shipment_has_items,
...             ValidationSet(path="items", rules=[quantity_within_limit]),
...           ],
...         )
...       ],
...     )
...   ],
... )
>>> batch = OrderBatch(
...   orders=[
...     Order(
...       order_id="order-1",
...       shipments=[
...         Shipment(
...           shipment_id="shipment-1",
...           items=[
...             LineItem(sku="keyboard", quantity=2),
...             LineItem(sku="monitor", quantity=6),
...           ],
...         ),
...         Shipment(shipment_id="shipment-2", items=[]),
...       ]
...     ),
...     Order(
...       order_id="order-2",
...       shipments=[Shipment(shipment_id="shipment-3", items=[LineItem(sku="keyboard", quantity=12)])],
...     ),
...   ]
... )
>>> lookup_calls: list[str] = []
>>> def load_quantity_limits() -> dict[str, int]:
...   lookup_calls.append("loaded")
...   return {"keyboard": 10, "monitor": 4}
>>> context = OrderValidationContext(batch=batch, load_quantity_limits=load_quantity_limits)
>>> result = ValidationEngine().add_rule(rules).validate(context)
>>> response = ValidationResponse.from_validation_result(result, failure_message="Orders need correction")
>>> payload = response.model_dump(mode="json")
>>> lookup_calls
['loaded']
>>> result.is_valid
False
>>> len(result.warnings())
1
>>> response.validation_status is ValidationStatus.FAILURE
True
>>> response.validation_message
'Orders need correction'
>>> [rule["severity_level"] for rule in payload["validation_rules"]]
['WARNING', 'ERROR']
>>> for rule in payload["validation_rules"]:
...   for finding in rule["validation_failures"]:
...     print(finding["location"])
orders[0].shipments[1].items
orders[0].shipments[0].items[1].quantity
orders[1].shipments[0].items[0].quantity

```

The sets compose the path `batch.orders.shipments.items`, expanding
each list and retaining its indexes. Checks receive paths relative to `batch`,
so reports can identify fields within the submitted order batch. Set-scoped checks
do not need their own `target_path`; the decorator also omits `context` when a
check, such as `shipment_has_items`, does not declare it.

The quantity-limit callback runs only once for all three line items because they
share one context. Limits apply per line item, not to total quantities across
shipments. This example assumes every SKU exists in the limits lookup; an unknown
SKU raises `KeyError`, not a validation finding. Add a product-existence check if
unknown SKUs are valid input to your workflow.
Errors determine the overall `FAILURE` status, but warnings remain in the report.

## Configure

- `validation_rule` accepts a display name, severity, optional `target_path`, and
  description. The decorated name identifies the rule in reports.
- Without a target path, a check receives the context. With a target path, it
  receives the target plus `context` and `path` when those parameters are declared.
- Paths traverse object attributes with dots and expand lists. Missing or `None`
  attributes are skipped; mapping-key traversal is not supported. The check's
  relative `path` omits the first dotted segment, or is `None` for a top-level target.
- Nested `ValidationSet` paths compose with parent paths. A set's path controls
  its direct rules' targets; those rules' individual `target_path` values are not applied.
- `context.cached(key, populate)` populates once per key and context, including
  `None` values. Cache contents persist across runs when a context is reused;
  call `clear_cached(key)` or use a new context when inputs change.
- `ValidationResponse.from_validation_result` accepts custom success/failure
  messages and extra fields for response subclasses.
- All three response models are frozen: fields cannot be reassigned after
  construction. This is shallow freezing; contained lists remain mutable.
  Callers that previously reassigned fields must construct a new response instead.

### Result Semantics

| Findings                   | `is_valid` | Response status |
| -------------------------- | ---------- | --------------- |
| None or informational only | `True`     | `SUCCESS`       |
| Warnings without errors    | `False`    | `WARNING`       |
| Any errors                 | `False`    | `FAILURE`       |

Warning messages count warning-level rules, not individual findings. Rule order,
finding locations, codes, and messages are preserved in responses.

### Compatibility Boundaries

This package preserves the existing WellCoreDB validation behavior. Application
rules and context subclasses remain application-owned.

- Checks are synchronous. Exceptions raised by checks propagate instead of becoming
  validation findings. Non-`TypeError` exceptions also print their traceback.
- The decorator performs basic runtime `isinstance` checks for annotated scalar
  parameters, but skips list/dict values. Use concrete runtime annotations; postponed
  or string annotations and general typing constructs are not resolved.
- Native failures accept arbitrary values, while response values retain the existing
  `str | float | None | list[Any]` schema. Integers serialize as floats; unsupported
  values such as mappings raise a Pydantic validation error during conversion.
- Responses contain validation data, not HTTP statuses, routes, or transport policy.

## Development

Both README examples are executed with `doctest` as part of the pytest suite.
Run the checks from the repository root:

```shell
mise run python:test -- validation/tests
mise run python:lint
mise run python:typecheck
mise run python:pack
```
