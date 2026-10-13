"""Cursor encoding, pagination resolution and neighboring-page links."""

import base64
from dataclasses import FrozenInstanceError
from typing import Any

import pytest
from elasticsearch.dsl.response import Hit

from team_hermes.elasticsearch import (
    BACKWARD,
    FORWARD,
    Cursor,
    CursorPagination,
    Cursors,
    Direction,
    OffsetPagination,
    Pagination,
    resolve_pagination,
)
from team_hermes.elasticsearch.errors import InvalidCursorError
from team_hermes.elasticsearch.pagination import _WindowProbe


def test_round_trips_sort_values_forward_by_default() -> None:
    cursor = Cursor(anchor=(12.5, "RCA", 42, "a1b2c3d4e5"))

    assert Cursor.decode(cursor.encode()) == cursor
    assert cursor.direction == FORWARD


def test_round_trips_backward_direction() -> None:
    cursor = Cursor(anchor=(1, "x"), direction=BACKWARD)

    assert Cursor.decode(cursor.encode()) == cursor


def test_round_trips_null_and_scalar_sort_values() -> None:
    cursor = Cursor(anchor=(None, True, False, 0, -42, 12.5, ""))

    assert Cursor.decode(cursor.encode()) == cursor


@pytest.mark.parametrize(
    ("direction", "token"),
    [(FORWARD, "eyJhIjpbMSwieCJdLCJkIjoiZiJ9"), (BACKWARD, "eyJhIjpbMSwieCJdLCJkIjoiYiJ9")],
)
def test_cursor_wire_format_is_unchanged(direction: Direction, token: str) -> None:
    cursor = Cursor(anchor=(1, "x"), direction=direction)
    assert cursor.encode() == token
    assert Cursor.decode(token) == cursor


def test_token_is_url_safe_text() -> None:
    token = Cursor(anchor=(1, "x")).encode()
    # URL-safe base64 uses only [A-Za-z0-9_-=]; no '+' or '/'.
    assert "+" not in token and "/" not in token
    assert token == token.strip()


@pytest.mark.parametrize(
    "bad_token",
    [
        "not-base64-!@#$",  # invalid base64
        base64.urlsafe_b64encode(b"not json").decode(),  # valid b64, invalid json
        base64.urlsafe_b64encode(b"[1, 2]").decode(),  # a bare list, missing keys
        base64.urlsafe_b64encode(b'{"a": "nope", "d": "f"}').decode(),  # anchor not a list
        base64.urlsafe_b64encode(b'{"a": [1], "d": "x"}').decode(),  # invalid direction
        base64.urlsafe_b64encode(b'{"a": [], "d": "f"}').decode(),
        base64.urlsafe_b64encode(b'{"a": [{}], "d": "f"}').decode(),
        base64.urlsafe_b64encode(b'{"a": [[1]], "d": "f"}').decode(),
        base64.urlsafe_b64encode(b'{"a": [NaN], "d": "f"}').decode(),
        base64.urlsafe_b64encode(b'{"a": [Infinity], "d": "f"}').decode(),
        base64.urlsafe_b64encode(b'{"a": [-Infinity], "d": "f"}').decode(),
    ],
)
def test_rejects_malformed_cursor(bad_token: str) -> None:
    with pytest.raises(InvalidCursorError):
        Cursor.decode(bad_token)


@pytest.mark.parametrize("anchor", [(), ({},), ([1],), (float("nan"),), (float("inf"),), (float("-inf"),)])
def test_direct_callers_cannot_construct_invalid_anchors(anchor: tuple[Any, ...]) -> None:
    with pytest.raises(InvalidCursorError):
        Cursor(anchor=anchor)


def _hit(*sort_values: object) -> Hit:
    """Use real DSL sort metadata to exercise AttrList-to-JSON conversion."""
    return Hit({"_source": {}, "sort": list(sort_values)})


def test_offset_window_when_no_cursor() -> None:
    page = resolve_pagination(number=3, size=20, cursor=None, max_result_window=10_000, sort_field_count=0)
    assert page == OffsetPagination(offset=40, page_size=20)


def test_first_page_resolves_to_zero_offset() -> None:
    page = resolve_pagination(number=1, size=20, cursor=None, max_result_window=10_000, sort_field_count=0)
    assert page == OffsetPagination(offset=0, page_size=20)


@pytest.mark.parametrize("direction", [FORWARD, BACKWARD])
@pytest.mark.parametrize("encoded", [False, True])
def test_resolve_uses_cursor_without_calculating_an_offset_probe(direction: Direction, encoded: bool) -> None:
    cursor = Cursor(anchor=(42,), direction=direction)
    page = resolve_pagination(
        number=10_001,
        size=20,
        cursor=cursor.encode() if encoded else cursor,
        max_result_window=10_000,
        sort_field_count=1,
    )
    assert page == CursorPagination(cursor=cursor, page_size=20)
    assert isinstance(page, CursorPagination)
    if not encoded:
        assert page.cursor is cursor


def test_resolve_keeps_an_offset_page_ending_at_the_result_window() -> None:
    page = resolve_pagination(number=500, size=20, cursor=None, max_result_window=10_000, sort_field_count=0)
    assert page == OffsetPagination(offset=9_980, page_size=20)


@pytest.mark.parametrize(
    ("number", "size", "window", "offset"),
    [(501, 20, 10_000, 10_000), (334, 30, 10_000, 9_990), (2, 20, 35, 20)],
)
def test_resolve_replaces_a_page_exceeding_the_window_with_a_probe(
    number: int, size: int, window: int, offset: int
) -> None:
    page = resolve_pagination(number=number, size=size, cursor=None, max_result_window=window, sort_field_count=0)
    assert page == _WindowProbe(requested_offset=offset, page_size=size)


@pytest.mark.parametrize(
    "page",
    [
        OffsetPagination(page_size=20),
        CursorPagination(cursor=Cursor(anchor=(42,)), page_size=20),
        CursorPagination(cursor=Cursor(anchor=(42,), direction=BACKWARD), page_size=20),
        _WindowProbe(requested_offset=10_000, page_size=20),
    ],
)
@pytest.mark.parametrize(("total", "pages"), [(0, 0), (1, 1), (20, 1), (21, 2), (None, None)])
def test_page_count_uses_the_requested_page_size(page: Pagination, total: int | None, pages: int | None) -> None:
    assert page.pages_for(total) == pages


def test_page_count_requires_a_resolved_page_size() -> None:
    with pytest.raises(ValueError, match="positive page size"):
        OffsetPagination(page_size=0).pages_for(1)


def test_unknown_total_does_not_require_a_page_size() -> None:
    assert OffsetPagination(page_size=0).pages_for(None) is None


def test_forward_cursor_resumes_via_search_after() -> None:
    cursor = Cursor(anchor=(12.5, "x"))
    page = resolve_pagination(number=1, size=20, cursor=cursor.encode(), max_result_window=10_000, sort_field_count=2)
    assert page == CursorPagination(cursor=cursor, page_size=20)
    assert isinstance(page, CursorPagination)
    assert page.backward is False


def test_backward_cursor_reads_in_reverse() -> None:
    cursor = Cursor(anchor=(1,), direction=BACKWARD)
    page = resolve_pagination(number=1, size=20, cursor=cursor.encode(), max_result_window=10_000, sort_field_count=1)
    assert page == CursorPagination(cursor=cursor, page_size=20)
    assert isinstance(page, CursorPagination)
    assert page.backward is True


def test_pagination_rejects_malformed_cursor() -> None:
    with pytest.raises(InvalidCursorError):
        resolve_pagination(
            number=1, size=20, cursor="not-a-valid-cursor-!@#", max_result_window=10_000, sort_field_count=1
        )


@pytest.mark.parametrize("encoded", [False, True])
@pytest.mark.parametrize("sort_field_count", [0, -1])
def test_resolve_rejects_cursor_without_sort_fields(encoded: bool, sort_field_count: int) -> None:
    cursor = Cursor(anchor=(42,))

    with pytest.raises(ValueError, match="explicit stable sort"):
        resolve_pagination(
            number=1,
            size=20,
            cursor=cursor.encode() if encoded else cursor,
            max_result_window=10_000,
            sort_field_count=sort_field_count,
        )


@pytest.mark.parametrize("encoded", [False, True])
@pytest.mark.parametrize("sort_field_count", [1, 3])
def test_resolve_rejects_cursor_anchor_length_mismatch(encoded: bool, sort_field_count: int) -> None:
    cursor = Cursor(anchor=(42, "item"))

    with pytest.raises(InvalidCursorError, match="one value for each sort field"):
        resolve_pagination(
            number=1,
            size=20,
            cursor=cursor.encode() if encoded else cursor,
            max_result_window=10_000,
            sort_field_count=sort_field_count,
        )


def test_resolve_checks_sort_before_decoding_cursor() -> None:
    with pytest.raises(ValueError, match="explicit stable sort"):
        resolve_pagination(number=1, size=20, cursor="invalid-token", max_result_window=10_000, sort_field_count=0)


def test_neighbor_cursors_full_page_links_both_ways() -> None:
    prev_cursor, next_cursor = OffsetPagination(offset=20, page_size=2).neighbor_cursors([_hit(1), _hit(2)])
    assert next_cursor is not None
    assert prev_cursor is not None
    assert next_cursor == Cursor(anchor=(2,), direction=FORWARD)
    assert prev_cursor == Cursor(anchor=(1,), direction=BACKWARD)


def test_neighbor_cursors_omits_prev_at_start() -> None:
    prev_cursor, next_cursor = OffsetPagination(page_size=2).neighbor_cursors([_hit(1), _hit(2)])
    assert prev_cursor is None
    assert next_cursor is not None
    assert next_cursor == Cursor(anchor=(2,), direction=FORWARD)


def test_neighbor_cursors_omits_next_on_short_page() -> None:
    prev_cursor, next_cursor = OffsetPagination(offset=20, page_size=2).neighbor_cursors([_hit(1)])
    assert next_cursor is None
    assert prev_cursor is not None
    assert prev_cursor == Cursor(anchor=(1,), direction=BACKWARD)


@pytest.mark.parametrize(
    ("direction", "values", "has_prev", "has_next"),
    [
        (FORWARD, (1, 2), True, True),
        (FORWARD, (1,), True, False),
        (FORWARD, (), False, False),
        (BACKWARD, (1, 2), True, True),
        (BACKWARD, (1,), False, True),
        (BACKWARD, (), False, False),
    ],
)
def test_cursor_boundaries_follow_traversal_direction(
    direction: Direction, values: tuple[int, ...], has_prev: bool, has_next: bool
) -> None:
    anchor = 0 if direction == FORWARD else 3
    page = CursorPagination(cursor=Cursor(anchor=(anchor,), direction=direction), page_size=2)

    cursors = page.neighbor_cursors([_hit(value) for value in values])

    assert cursors.prev == (Cursor(anchor=(values[0],), direction=BACKWARD) if has_prev else None)
    assert cursors.next == (Cursor(anchor=(values[-1],), direction=FORWARD) if has_next else None)


@pytest.mark.parametrize("direction", [FORWARD, BACKWARD])
@pytest.mark.parametrize("hit", [Hit({"_source": {}}), _hit()])
def test_cursor_page_without_sort_metadata_has_no_neighbors(direction: Direction, hit: Hit) -> None:
    page = CursorPagination(cursor=Cursor(anchor=(1,), direction=direction), page_size=1)

    cursors = page.neighbor_cursors([hit])

    assert cursors.prev is None
    assert cursors.next is None


@pytest.mark.parametrize(
    "page",
    [
        OffsetPagination(page_size=20),
        OffsetPagination(offset=20, page_size=20),
        CursorPagination(cursor=Cursor(anchor=(42,)), page_size=20),
        CursorPagination(cursor=Cursor(anchor=(42,), direction=BACKWARD), page_size=20),
        _WindowProbe(requested_offset=10_000, page_size=20),
    ],
)
def test_empty_pages_have_no_neighbors(page: Pagination) -> None:
    assert page.neighbor_cursors([]) == Cursors(prev=None, next=None)


def test_probe_never_produces_navigation() -> None:
    page = _WindowProbe(requested_offset=10_000, page_size=1)
    assert page.neighbor_cursors([_hit(42)]) == Cursors(prev=None, next=None)


@pytest.mark.parametrize("has_prev", [False, True])
@pytest.mark.parametrize("has_next", [False, True])
def test_cursors_from_hits_respects_requested_links(has_prev: bool, has_next: bool) -> None:
    cursors = Cursors.from_hits([_hit(1), _hit(2)], has_prev=has_prev, has_next=has_next)

    assert cursors.prev == (Cursor(anchor=(1,), direction=BACKWARD) if has_prev else None)
    assert cursors.next == (Cursor(anchor=(2,)) if has_next else None)


@pytest.mark.parametrize(
    ("hits", "expected"),
    [
        ([], Cursors(prev=None, next=None)),
        ([_hit(), _hit(2)], Cursors(next=Cursor(anchor=(2,)))),
        ([_hit(1), _hit()], Cursors(prev=Cursor(anchor=(1,), direction=BACKWARD))),
    ],
)
def test_cursors_from_hits_handles_missing_anchors_independently(hits: list[Hit], expected: Cursors) -> None:
    assert Cursors.from_hits(hits, has_prev=True, has_next=True) == expected


@pytest.mark.parametrize(
    ("page", "attribute", "value"),
    [
        (OffsetPagination(page_size=20), "offset", 40),
        (CursorPagination(cursor=Cursor(anchor=(42,)), page_size=20), "cursor", Cursor(anchor=(43,))),
        (_WindowProbe(requested_offset=10_000, page_size=20), "requested_offset", 20_000),
        (OffsetPagination(page_size=20), "page_size", 40),
        (CursorPagination(cursor=Cursor(anchor=(42,)), page_size=20), "page_size", 40),
        (_WindowProbe(requested_offset=10_000, page_size=20), "page_size", 40),
        (Cursor(anchor=(42,)), "anchor", (43,)),
        (Cursor(anchor=(42,)), "direction", BACKWARD),
    ],
)
def test_pagination_values_are_frozen(page: Pagination | Cursor, attribute: str, value: object) -> None:
    with pytest.raises(FrozenInstanceError):
        setattr(page, attribute, value)
