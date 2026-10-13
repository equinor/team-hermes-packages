"""Fluent sorting validates public fields and snapshots declaration inputs."""

from dataclasses import FrozenInstanceError
from typing import Any

import pytest

from team_hermes.elasticsearch import SearchDefinition, SortClause, SortPolicy
from team_hermes.elasticsearch.errors import InvalidSearchRequestError
from team_hermes.elasticsearch.sort import SortOrder
from tests.search_test_helpers import StubSearchClient


@pytest.fixture
def definition() -> SearchDefinition:
    """A minimal definition for exercising public ID sorting."""
    return SearchDefinition(sorting=SortPolicy(fields={"id": "id"}))


@pytest.fixture
def relevance_sort() -> tuple[SortClause, ...]:
    """Default relevance ordering."""
    return (SortClause(field="_score", order="desc"),)


@pytest.fixture
def document_tiebreakers() -> tuple[SortClause, ...]:
    """Stable document ordering for otherwise equal sort values."""
    return (SortClause(field="doc_id", order="asc"),)


@pytest.mark.parametrize("field", ["unknown", "", "_score", "doc_id", "numbers.*", {"id": "asc"}])
def test_sort_rejects_invalid_fields_immediately_without_io(
    field: Any,
    client: StubSearchClient,
    definition: SearchDefinition,
    relevance_sort: tuple[SortClause, ...],
    document_tiebreakers: tuple[SortClause, ...],
) -> None:
    """The fluent API rejects unknown fields and the former raw-clause bypass."""
    query = (
        definition.with_sorting(namespaces=("numbers",), default=relevance_sort, tiebreakers=document_tiebreakers)
        .search()
        .using(client)
        .index("items")
    )
    with pytest.raises(InvalidSearchRequestError, match="Sort field"):
        query.sort(field)
    assert client.calls == []


@pytest.mark.parametrize("order", ["ASC", "invalid", "", None])
@pytest.mark.parametrize("field", ["id", None])
def test_sort_rejects_invalid_directions_even_without_a_field(
    field: str | None,
    order: Any,
    definition: SearchDefinition,
) -> None:
    """Direct library callers receive validation without a Pydantic request."""
    with pytest.raises(InvalidSearchRequestError, match="Sort order"):
        definition.search().sort(field, order)


def test_sort_direction_requires_a_field(definition: SearchDefinition) -> None:
    with pytest.raises(InvalidSearchRequestError, match="requires a sort field"):
        definition.search().sort(order="desc")


def test_definition_always_has_a_sort_policy() -> None:
    definition = SearchDefinition()

    assert definition.sorting == SortPolicy()
    assert definition.search()._sort == ()


def test_definition_accepts_an_explicit_sort_policy(
    client: StubSearchClient,
    relevance_sort: tuple[SortClause, ...],
    document_tiebreakers: tuple[SortClause, ...],
) -> None:
    definition = SearchDefinition(
        sorting=SortPolicy(
            fields={"label": "title.keyword"},
            default=relevance_sort,
            tiebreakers=document_tiebreakers,
        ),
    )
    query = definition.search().using(client).index("items")

    query.execute()
    query.sort("label", "desc").execute()

    assert definition.sorting.fields == {"label": "title.keyword"}
    assert client.calls[0]["sort"] == [{"_score": {"order": "desc"}}, {"doc_id": {"order": "asc"}}]
    assert client.calls[1]["sort"] == [
        {"title.keyword": {"order": "desc", "missing": "_last"}},
        {"doc_id": {"order": "asc"}},
    ]


@pytest.mark.parametrize("fields", [{}, {"label": "title.keyword"}])
def test_sort_policy_fields_follow_replacement_without_mutating_definition(fields: dict[str, str]) -> None:
    base = SearchDefinition.from_mapping({"title": {"type": "text", "fields": {"keyword": {"type": "keyword"}}}})

    updated = base.with_sorting(fields=fields)

    assert updated.sorting.fields == fields
    assert base.sorting.fields == {"title": "title.keyword"}
    assert base.search().sort("title")._sort == (SortClause(field="title.keyword", order="asc", missing="_last"),)
    for name, path in fields.items():
        assert updated.search().sort(name)._sort == (SortClause(field=path, order="asc", missing="_last"),)
    with pytest.raises(InvalidSearchRequestError):
        updated.search().sort("title")


def test_sort_resolves_mapping_keyword_fields_without_application_helpers(client: StubSearchClient) -> None:
    """Every mapped text field uses its sortable keyword subfield."""
    definition = SearchDefinition.from_mapping({"title": {"type": "text", "fields": {"keyword": {"type": "keyword"}}}})
    definition.search().using(client).index("items").sort("title", "desc").execute()
    assert client.calls[0]["sort"] == [{"title.keyword": {"order": "desc", "missing": "_last"}}]


@pytest.mark.parametrize("namespace", ["numbers", "labels"])
@pytest.mark.parametrize("name", ["weight", "text_weight", "id", "Weight_1.test-value", "a" * 128])
@pytest.mark.parametrize("order", ["asc", "desc"])
def test_namespaced_sorts_preserve_identity_missing_values_and_tiebreakers(
    namespace: str,
    name: str,
    order: SortOrder,
    client: StubSearchClient,
    definition: SearchDefinition,
    relevance_sort: tuple[SortClause, ...],
    document_tiebreakers: tuple[SortClause, ...],
) -> None:
    definition = definition.with_sorting(
        namespaces=("numbers", "labels"),
        default=relevance_sort,
        tiebreakers=(SortClause(field="id", order="asc"), *document_tiebreakers),
    )
    field = f"{namespace}.{name}"

    definition.search().using(client).index("items").sort(field, order).execute()

    assert client.calls[0]["sort"] == [
        {field: {"order": order, "missing": "_last"}},
        {"id": {"order": "asc"}},
        {"doc_id": {"order": "asc"}},
    ]


@pytest.mark.parametrize("namespace", ["numbers", "labels"])
@pytest.mark.parametrize("name", ["", "*", "weight\n", "item weight", "bad/name", "a" * 129])
def test_invalid_dynamic_sort_names_are_rejected_before_io(
    namespace: str,
    name: str,
    client: StubSearchClient,
    definition: SearchDefinition,
) -> None:
    query = definition.with_sorting(namespaces=("numbers", "labels")).search().using(client).index("items")

    with pytest.raises(InvalidSearchRequestError, match="Sort field"):
        query.sort(f"{namespace}.{name}")

    assert client.calls == []


@pytest.mark.parametrize("field", ["numbers", "labels", "weight", "unknown.weight", "numbers_extra.weight"])
def test_dynamic_sort_requires_a_declared_namespace_and_qualified_name(
    field: str, definition: SearchDefinition
) -> None:
    with pytest.raises(InvalidSearchRequestError, match="Sort field"):
        definition.with_sorting(namespaces=("numbers", "labels")).search().sort(field)


def test_sort_configuration_and_query_branches_do_not_share_mutable_inputs(
    client: StubSearchClient,
    definition: SearchDefinition,
) -> None:
    """Declaration inputs are snapshotted and sorting never mutates a base query."""
    fields = {"label": "title.keyword"}
    default = [SortClause(field="_score", order="desc")]
    tiebreakers = [SortClause(field="doc_id", order="asc")]
    definition = definition.with_sorting(fields=fields, default=default, tiebreakers=tiebreakers)
    assert definition.sorting.default[0] is default[0]
    assert definition.sorting.tiebreakers[0] is tiebreakers[0]
    fields["label"] = "wrong"
    default[0] = SortClause(field="_score", order="asc")
    tiebreakers.clear()
    base = definition.search().using(client).index("items")
    branch = base.sort("label", "desc")
    branch.execute()
    branch.sort().execute()
    base.execute()
    assert client.calls[0]["sort"] == [
        {"title.keyword": {"order": "desc", "missing": "_last"}},
        {"doc_id": {"order": "asc"}},
    ]
    assert (
        client.calls[1]["sort"]
        == client.calls[2]["sort"]
        == [
            {"_score": {"order": "desc"}},
            {"doc_id": {"order": "asc"}},
        ]
    )
    with pytest.raises(InvalidSearchRequestError):
        base.sort("id")  # Curated aliases replace, rather than extend, public fields.


def test_sort_namespaces_and_defaults_can_be_cleared_without_mutating_definition(
    definition: SearchDefinition,
    relevance_sort: tuple[SortClause, ...],
    document_tiebreakers: tuple[SortClause, ...],
) -> None:
    """Empty configuration clears dynamic/default ordering, retaining static fields."""
    definition = definition.with_sorting(
        namespaces=("nested.numbers",), default=relevance_sort, tiebreakers=document_tiebreakers
    )
    query = definition.search().sort("nested.numbers.porosity")
    assert query._sort[0] == SortClause(field="nested.numbers.porosity", order="asc", missing="_last")
    cleared = definition.with_sorting(namespaces=(), default=(), tiebreakers=())
    assert cleared.search()._sort == ()
    assert cleared.search().sort("id")._sort == (SortClause(field="id", order="asc", missing="_last"),)
    assert definition.search()._sort == (*relevance_sort, *document_tiebreakers)
    with pytest.raises(InvalidSearchRequestError):
        cleared.search().sort("nested.numbers.porosity")
    with pytest.raises(InvalidSearchRequestError):
        definition.with_sorting(fields={}).search().sort("id")


def test_omitted_and_none_namespaces_preserve_existing_sort_policy(
    definition: SearchDefinition,
    relevance_sort: tuple[SortClause, ...],
    document_tiebreakers: tuple[SortClause, ...],
) -> None:
    definition = definition.with_sorting(
        namespaces=("numbers",), default=relevance_sort, tiebreakers=document_tiebreakers
    )

    for updated in (definition.with_sorting(), definition.with_sorting(namespaces=None)):
        assert updated == definition
        assert updated.search().sort("numbers.weight")._sort == (
            SortClause(field="numbers.weight", order="asc", missing="_last"),
            *document_tiebreakers,
        )
        assert updated.search()._sort == (*relevance_sort, *document_tiebreakers)
    assert definition.search()._sort == (*relevance_sort, *document_tiebreakers)


def test_sort_exclusions_filter_replacements_but_preserve_trusted_ordering(
    definition: SearchDefinition,
    document_tiebreakers: tuple[SortClause, ...],
) -> None:
    base = definition.with_sorting(default=(SortClause(field="id", order="desc"),), tiebreakers=document_tiebreakers)
    excluded = {"id", "numbers"}
    updated = base.with_sorting(
        fields={"id": "id", "label": "title.keyword"}, namespaces={"numbers"}, exclude=excluded
    )
    excluded.add("label")

    assert updated.sorting.fields == {"label": "title.keyword"}
    assert updated.sorting.namespaces == frozenset()
    assert updated.search()._sort == (SortClause(field="id", order="desc"), *document_tiebreakers)
    assert updated.search().sort("label")._sort == (
        SortClause(field="title.keyword", order="asc", missing="_last"),
        *document_tiebreakers,
    )
    assert base.sorting.fields == {"id": "id"}
    with pytest.raises(InvalidSearchRequestError):
        updated.search().sort("id")
    with pytest.raises(InvalidSearchRequestError):
        updated.search().sort("numbers.weight")


def test_sort_defaults_and_tiebreakers_can_be_changed_independently(
    definition: SearchDefinition,
    relevance_sort: tuple[SortClause, ...],
    document_tiebreakers: tuple[SortClause, ...],
) -> None:
    base = definition.with_sorting(default=relevance_sort, tiebreakers=document_tiebreakers)

    assert base.with_sorting(default=()).search()._sort == document_tiebreakers
    assert base.with_sorting(tiebreakers=()).search()._sort == relevance_sort
    assert base.with_sorting(exclude={"id"}).search()._sort == (*relevance_sort, *document_tiebreakers)


@pytest.mark.parametrize("field", ["", " ", None, {"id": "asc"}])
def test_sort_clause_rejects_invalid_fields(field: Any) -> None:
    with pytest.raises(InvalidSearchRequestError, match="Sort field"):
        SortClause(field=field, order="asc")


@pytest.mark.parametrize("order", ["ASC", "invalid", "", None, []])
def test_sort_clause_rejects_invalid_orders(order: Any) -> None:
    with pytest.raises(InvalidSearchRequestError, match="Sort order"):
        SortClause(field="id", order=order)


@pytest.mark.parametrize("missing", [1, [], {}])
def test_sort_clause_rejects_non_string_missing_values(missing: Any) -> None:
    with pytest.raises(TypeError, match="missing value"):
        SortClause(field="id", order="asc", missing=missing)


@pytest.mark.parametrize("name", ["field", "order", "missing"])
def test_sort_clause_is_immutable(name: str) -> None:
    clause = SortClause(field="id", order="asc")
    with pytest.raises(FrozenInstanceError):
        setattr(clause, name, "changed")


@pytest.mark.parametrize("order, reversed_order", [("asc", "desc"), ("desc", "asc")])
@pytest.mark.parametrize("missing, reversed_missing", [("_last", "_first"), ("_first", "_last"), ("0", "0")])
def test_sort_clause_reversal_preserves_field_and_round_trips(
    order: SortOrder, reversed_order: SortOrder, missing: str | None, reversed_missing: str | None
) -> None:
    clause = SortClause(field="id", order=order, missing=missing)
    reversed_clause = clause.reversed()
    assert reversed_clause == SortClause(field="id", order=reversed_order, missing=reversed_missing)
    assert reversed_clause is not clause
    assert reversed_clause.reversed() == clause
    assert (clause.order, clause.missing) == (order, missing)


@pytest.mark.parametrize("order, reversed_order", [("asc", "desc"), ("desc", "asc")])
def test_sort_clause_reversal_accounts_for_default_missing_placement(
    order: SortOrder, reversed_order: SortOrder
) -> None:
    clause = SortClause(field="price", order=order)
    reversed_clause = clause.reversed()
    assert reversed_clause == SortClause(field="price", order=reversed_order, missing="_first")
    assert reversed_clause.reversed() == SortClause(field="price", order=order, missing="_last")
    assert clause.missing is None


@pytest.mark.parametrize("field", ["_score", "_doc", "_shard_doc", "_geo_distance", "_script"])
@pytest.mark.parametrize("order, reversed_order", [("asc", "desc"), ("desc", "asc")])
def test_special_sort_reversal_does_not_add_missing_placement(
    field: str, order: SortOrder, reversed_order: SortOrder
) -> None:
    clause = SortClause(field=field, order=order)
    assert clause.reversed() == SortClause(field=field, order=reversed_order)
    assert clause.reversed().reversed() == clause


@pytest.mark.parametrize("option", ["default", "tiebreakers"])
@pytest.mark.parametrize("clause", [{"id": "asc"}, {"id": {"order": "asc"}}, {"id": "asc", "other": "desc"}])
def test_legacy_dictionary_sort_configuration_is_rejected(
    option: str, clause: Any, definition: SearchDefinition
) -> None:
    options: Any = {option: (clause,)}
    with pytest.raises(TypeError, match="must contain SortClause"):
        definition.with_sorting(**options)
