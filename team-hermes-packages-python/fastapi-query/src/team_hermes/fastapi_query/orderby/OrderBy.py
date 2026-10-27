from collections.abc import Callable
from typing import Any

from fastapi import Query

from team_hermes.core import ValidationException
from team_hermes.query import OrderBy, SortDirection


def create_order_by_options(valid_options: list[str] | None = None) -> Callable[[str], Any]:
    async def _parse_sort(
        orderby: str = Query(
            None, description="Order items by property values", examples=["name asc, created_at desc"]
        ),
    ) -> list[OrderBy]:
        if not orderby:
            return []
        items: list[OrderBy] = []
        for option in orderby.split(","):
            option_parts = option.strip().split(" ")
            field = option_parts[0]
            if valid_options and field not in valid_options:
                raise ValidationException(f"Invalid orderby field: {field}")
            option_direction = option_parts[1] if len(option_parts) > 1 else SortDirection.desc
            items.append(OrderBy(key=field, direction=SortDirection(option_direction)))
        return items

    return _parse_sort
