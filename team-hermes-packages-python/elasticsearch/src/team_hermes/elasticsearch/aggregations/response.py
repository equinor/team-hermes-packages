"""Read-only aggregation payload views, separate from definitions and API models."""

from collections.abc import Iterator, Mapping
from dataclasses import dataclass
from typing import Any

# Scoped metric payloads remain raw mappings, not root response readers.
type AggregationPayload = Mapping[str, Any]


@dataclass(frozen=True, slots=True, eq=False)
class AggregationBucket(Mapping[str, Any]):
    """One bucket and its sub-aggregations; raw nested values are not copied or frozen."""

    _data: AggregationPayload

    def __getitem__(self, key: str) -> Any:
        return self._data[key]

    def __iter__(self) -> Iterator[str]:
        return iter(self._data)

    def __len__(self) -> int:
        return len(self._data)

    @property
    def key(self) -> Any:
        """The original bucket key, without coercion."""
        return self._data["key"]

    @property
    def doc_count(self) -> int:
        """Number of matching documents in this bucket."""
        return self._data["doc_count"]

    def first_key(self, sub_name: str) -> str | None:
        """Read the first terms sub-bucket key, or None when empty."""
        buckets = self._sub_buckets(sub_name)
        return buckets[0]["key"] if buckets else None

    def keys_for(self, sub_name: str) -> list[str]:
        """Read every terms sub-bucket key in response order."""
        return [bucket["key"] for bucket in self._sub_buckets(sub_name)]

    def cardinality(self, sub_name: str) -> int:
        """Read a cardinality sub-metric, defaulting to zero when absent or null."""
        sub = self._data.get(sub_name)
        return int(sub.get("value") or 0) if isinstance(sub, Mapping) else 0

    def _sub_buckets(self, sub_name: str) -> list[AggregationPayload]:
        sub = self._data.get(sub_name)
        return (sub.get("buckets") or []) if isinstance(sub, Mapping) else []


@dataclass(frozen=True, slots=True, eq=False)
class AggregationsResponse(Mapping[str, Any]):
    """Root aggregation reader; raw mapping access is shallow and does not wrap children."""

    _data: AggregationPayload

    def __getitem__(self, key: str) -> Any:
        return self._data[key]

    def __iter__(self) -> Iterator[str]:
        return iter(self._data)

    def __len__(self) -> int:
        return len(self._data)

    def extract_buckets(self, name: str) -> list[AggregationBucket]:
        """Read filter/sampler-wrapped buckets at name/name; empty when absent or null."""
        try:
            buckets = self._data[name][name]["buckets"]
        except KeyError:
            return []
        return [AggregationBucket(bucket) for bucket in (buckets or [])]
