"""Fresh search definitions and offline clients for faceted-search unit tests."""

import pytest

from team_hermes.elasticsearch import (
    CardinalityAggregation,
    DynamicFacetFamily,
    NumericHistogramFacet,
    SearchDefinition,
    SortClause,
    SortPolicy,
    TermsFacet,
)
from team_hermes.elasticsearch.indexing import DynamicField
from tests.search_test_helpers import StubSearchClient


@pytest.fixture
def search_client_factory() -> type[StubSearchClient]:
    """Create independent clients with explicit canned responses."""
    return StubSearchClient


@pytest.fixture
def client(search_client_factory: type[StubSearchClient]) -> StubSearchClient:
    """Provide an empty response and request history isolated to one test."""
    return search_client_factory(total=0)


@pytest.fixture
def attributes() -> DynamicFacetFamily:
    """A domain-independent dynamic attribute family."""
    return DynamicFacetFamily(field=DynamicField("attributes"))


@pytest.fixture
def definition() -> SearchDefinition:
    """A static category/brand catalog with public ID sorting."""
    return SearchDefinition(
        facets=(TermsFacet(field="category"), TermsFacet(field="brand")),
        sorting=SortPolicy(fields={"id": "id"}),
    )


@pytest.fixture
def products(attributes: DynamicFacetFamily) -> SearchDefinition:
    """A product catalog with fixed price buckets and dynamic attributes."""
    return SearchDefinition(
        facets=(TermsFacet(field="brand"), NumericHistogramFacet(field="price", interval=10), attributes),
    ).with_sorting(default=(SortClause(field="id", order="asc"),))


@pytest.fixture
def scope() -> CardinalityAggregation:
    """Count matching documents and distinct categories."""
    return CardinalityAggregation(name="scope", fields=("category",))


@pytest.fixture
def brand_scope() -> CardinalityAggregation:
    """Count matching documents and distinct brands."""
    return CardinalityAggregation(name="scope", fields=("brand",))
