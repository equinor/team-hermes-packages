"""Explicit pagination states, stateless cursor tokens, and page navigation."""

import base64
import binascii
import json
import math
from dataclasses import dataclass
from typing import Any, Literal, NamedTuple, Self

from elasticsearch.dsl.response import Hit

from .errors import InvalidCursorError

type Direction = Literal["f", "b"]
FORWARD: Direction = "f"
BACKWARD: Direction = "b"

_ANCHOR_KEY = "a"
_DIRECTION_KEY = "d"


@dataclass(frozen=True, slots=True, kw_only=True)
class Cursor:
    """A stateless page anchor with its traversal direction and wire encoding."""

    anchor: tuple[Any, ...]
    direction: Direction = FORWARD

    def __post_init__(self) -> None:
        """Reject invalid sort values for both decoded tokens and direct callers."""
        if not isinstance(self.anchor, tuple) or not self.anchor or self.direction not in (FORWARD, BACKWARD):
            raise InvalidCursorError("Invalid pagination cursor")
        for value in self.anchor:
            if value is not None and not isinstance(value, str | int | float | bool):
                raise InvalidCursorError("Cursor anchor must contain only scalar sort values")
            if isinstance(value, float) and not math.isfinite(value):
                raise InvalidCursorError("Cursor anchor numbers must be finite")

    def encode(self) -> str:
        """Encode sort values and direction into an opaque, URL-safe token."""
        payload = json.dumps({_ANCHOR_KEY: self.anchor, _DIRECTION_KEY: self.direction}, separators=(",", ":"))
        return base64.urlsafe_b64encode(payload.encode()).decode()

    @classmethod
    def decode(cls, token: str) -> Self:
        """Read a token; raise InvalidCursorError for malformed payloads."""
        try:
            raw = base64.urlsafe_b64decode(token.encode())
            payload = json.loads(raw)
            anchor = payload[_ANCHOR_KEY]
            direction = payload[_DIRECTION_KEY]
        except (binascii.Error, ValueError, KeyError, TypeError) as exc:
            raise InvalidCursorError("Invalid pagination cursor") from exc

        if not isinstance(anchor, list):
            raise InvalidCursorError("Invalid pagination cursor")
        return cls(anchor=tuple(anchor), direction=direction)


class Cursors(NamedTuple):
    """Typed links to neighboring pages; token encoding belongs to the HTTP boundary."""

    prev: Cursor | None = None
    next: Cursor | None = None

    @classmethod
    def from_hits(cls, hits: list[Hit], *, has_prev: bool, has_next: bool) -> Self:
        """Build cursor values from display-ordered hits, omitting missing sort metadata."""
        if not hits:
            return cls()
        first_sort = getattr(hits[0].meta, "sort", ()) or ()
        last_sort = getattr(hits[-1].meta, "sort", ()) or ()
        prev = Cursor(anchor=tuple(first_sort), direction=BACKWARD) if has_prev and first_sort else None
        next_ = Cursor(anchor=tuple(last_sort)) if has_next and last_sort else None
        return cls(prev=prev, next=next_)


@dataclass(frozen=True, slots=True, kw_only=True)
class _Page:
    """Share requested page size and exact-total arithmetic, not pagination policy."""

    page_size: int

    def pages_for(self, total: int | None) -> int | None:
        """Calculate requested-size pages, or None when the total was not computed."""
        if total is None:
            return None
        if self.page_size < 1:
            raise ValueError("Cannot calculate pages without a positive page size")
        return (total + self.page_size - 1) // self.page_size


@dataclass(frozen=True, slots=True, kw_only=True)
class OffsetPagination(_Page):
    """Read a page by skipping offset hits; zero page size permits aggregation-only execution."""

    offset: int = 0

    def neighbor_cursors(self, hits: list[Hit]) -> Cursors:
        """Allow offset-to-cursor navigation; the first page has no previous link."""
        return Cursors.from_hits(hits, has_prev=self.offset != 0, has_next=len(hits) >= self.page_size)


@dataclass(frozen=True, slots=True, kw_only=True)
class CursorPagination(_Page):
    """Resume from a hit's sort values in the requested traversal direction."""

    cursor: Cursor

    @property
    def backward(self) -> bool:
        """Whether the page is read in reverse sort order."""
        return self.cursor.direction == BACKWARD

    def neighbor_cursors(self, hits: list[Hit]) -> Cursors:
        """Short pages end traversal; full pages retain an optimistic link without lookahead."""
        full_page = len(hits) >= self.page_size
        return Cursors.from_hits(hits, has_prev=not self.backward or full_page, has_next=self.backward or full_page)


@dataclass(frozen=True, slots=True, kw_only=True)
class _WindowProbe(_Page):
    """Count instead of fetching a deep offset, retaining the requested page size."""

    requested_offset: int

    def neighbor_cursors(self, hits: list[Hit]) -> Cursors:
        """Probes fetch no page and never offer navigation."""
        return Cursors()


type Pagination = OffsetPagination | CursorPagination | _WindowProbe


def resolve_pagination(
    *,
    number: int,
    size: int,
    cursor: Cursor | str | None,
    max_result_window: int,
    sort_field_count: int,
) -> Pagination:
    """Resolve validated page input and check cursor compatibility with sorting.

    Pass the number of effective sort clauses, including tiebreakers. Cursor
    requests require a positive count and one anchor value per clause. Decode
    tokens once and retain existing cursor values; offset requests ignore sorting.
    """
    if cursor is not None:
        if sort_field_count < 1:
            raise ValueError("Cursor pagination requires an explicit stable sort")

        resolved_cursor = Cursor.decode(cursor) if isinstance(cursor, str) else cursor
        if len(resolved_cursor.anchor) != sort_field_count:
            raise InvalidCursorError("Cursor anchor must contain one value for each sort field")

        return CursorPagination(page_size=size, cursor=resolved_cursor)

    offset = (number - 1) * size
    if offset + size > max_result_window:
        return _WindowProbe(page_size=size, requested_offset=offset)
    return OffsetPagination(page_size=size, offset=offset)
