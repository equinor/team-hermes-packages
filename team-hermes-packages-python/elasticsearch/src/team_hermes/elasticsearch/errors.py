"""Exceptions raised by the Elasticsearch faceting package."""


class InvalidSearchRequestError(ValueError):
    """A structured request uses filters incompatible with its search definition."""


class FacetBoundsPrefetchError(RuntimeError):
    """Pre-fetching min/max bounds for auto-interval histograms failed."""

    def __init__(self, facet_names: tuple[str, ...]) -> None:
        super().__init__(
            f"Failed to pre-fetch histogram bounds for auto-interval facets "
            f"{list(facet_names)}; see the chained ES exception for details.",
        )
        self.facet_names = facet_names


class InvalidRangeFilterError(ValueError):
    """Range filter declares ``min > max`` (an empty interval)."""

    def __init__(self, field: str, min_value: object, max_value: object) -> None:
        super().__init__(
            f"Invalid range filter for {field!r}: min ({min_value}) > max ({max_value}).",
        )


class InvalidCursorError(ValueError):
    """A pagination cursor token is malformed or carries an unknown direction.

    Raised by :meth:`team_hermes.elasticsearch.pagination.Cursor.decode`.
    Like :class:`InvalidRangeFilterError`, this is a transport-agnostic
    ``ValueError`` — the application boundary maps it to an HTTP 422.
    """


class UnknownFacetError(ValueError):
    """``request.facets`` named a facet this index cannot aggregate.

    Silently dropping it would be indistinguishable from a facet that matched
    nothing, so a client typo or a stale deep link would surface as "no data"
    rather than as the error it is. Transport-agnostic, like the errors above;
    the application boundary maps it to an HTTP 422.
    """

    def __init__(self, unknown: list[str], known: list[str]) -> None:
        super().__init__(
            f"Unknown facet(s) {unknown}. This index aggregates: {known}.",
        )
        self.unknown = unknown
        self.known = known


class ResultWindowError(ValueError):
    """An offset page contains hits that must be reached using a cursor."""

    def __init__(self, limit: int) -> None:
        super().__init__(
            f"Results beyond {limit:,} can't be reached by page number; "
            "page with the Next/Previous controls or refine your filters to narrow the results."
        )
