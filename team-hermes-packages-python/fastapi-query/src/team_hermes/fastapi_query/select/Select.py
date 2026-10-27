from collections.abc import Callable

from fastapi import Query

from team_hermes.core import ValidationException
from team_hermes.query import Select


def parse_select(valid_options: list[str] | None = None) -> Callable[[str], Select | None]:
    def _parse_projection(
        select: str = Query(
            None,
            alias="$select",
            description="Choose which fields should be fetched from the resource and returned",
            examples=["$select=name,created_at"],
        ),
    ) -> Select | None:
        if select is None:
            return None
        selected_fields = [item.strip() for item in select.split(",")]
        if valid_options is not None and (invalid_fields := (set(valid_options) - set(selected_fields))):
            raise ValidationException(f"Invalid select field(s): {', '.join(invalid_fields)}")
        return Select(fields=selected_fields)

    return _parse_projection
