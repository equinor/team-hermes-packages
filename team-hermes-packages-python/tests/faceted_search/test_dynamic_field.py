"""Index and search share one immutable dynamic field contract."""

from copy import deepcopy
from typing import ClassVar

import pytest
from elasticsearch.dsl import Document, Index, Keyword, Mapping

from team_hermes.elasticsearch.indexing import DynamicField


@pytest.fixture
def field() -> DynamicField:
    """Provide the measurements storage contract for one test."""
    return DynamicField("measurements")


def test_registers_both_namespaces_and_one_catalog(field: DynamicField) -> None:
    mapping = Mapping()
    mapping.field("author", Keyword())
    existing = [{"other": {"path_match": "other.*", "mapping": {"type": "keyword"}}}]
    mapping.meta("dynamic_templates", existing)
    field.add_to_mapping(mapping)
    body = mapping.to_dict()
    assert body["properties"] == {
        "author": {"type": "keyword"},
        "numeric_measurements": {"type": "object", "dynamic": True, "subobjects": False},
        "categorical_measurements": {"type": "object", "dynamic": True, "subobjects": False},
        "measurements_fields": {"type": "keyword", "meta": {"facet_type": "dynamic", "family": "measurements"}},
    }
    assert body["dynamic_templates"] == [
        *existing,
        {"measurements_numeric": {"path_match": "numeric_measurements.*", "mapping": {"type": "float"}}},
        {"measurements_categorical": {"path_match": "categorical_measurements.*", "mapping": {"type": "keyword"}}},
    ]


@pytest.mark.parametrize("collision", ["property", "template_name", "template_path"])
def test_mapping_conflicts_fail_before_mutation(collision: str, field: DynamicField) -> None:
    mapping = Mapping()
    if collision == "property":
        mapping.field(field.numeric_path, Keyword())
    else:
        name = "measurements_numeric" if collision == "template_name" else "other"
        mapping.meta(
            "dynamic_templates", [{name: {"path_match": "numeric_measurements.*", "mapping": {"type": "keyword"}}}]
        )
    before = deepcopy(mapping.to_dict())
    with pytest.raises(ValueError, match="already contains"):
        field.add_to_mapping(mapping)
    assert mapping.to_dict() == before


def test_encoding_preserves_equal_names_and_zero_and_copies_values(field: DynamicField) -> None:
    numeric = {"same": 0.0, "pore.size": 0.2}
    categorical = {"same": "good", "empty": "", "pore.shape": "round"}
    document = field.index_values(numeric=numeric, categorical=categorical)
    assert document[field.discovery_field] == [
        "categorical_measurements.empty",
        "categorical_measurements.pore.shape",
        "categorical_measurements.same",
        "numeric_measurements.pore.size",
        "numeric_measurements.same",
    ]
    numeric["same"] = 9.0
    categorical["same"] = "changed"
    assert document[field.numeric_path]["same"] == 0.0
    assert document[field.categorical_path]["same"] == "good"
    assert document[field.numeric_path]["pore.size"] == 0.2
    assert document[field.categorical_path]["pore.shape"] == "round"


def test_empty_values_write_an_empty_catalog(field: DynamicField) -> None:
    expected = {"measurements_fields": []}
    actual = field.index_values(numeric={}, categorical={})
    assert actual == expected


@pytest.mark.parametrize("name", ["", "a.b", "A", "a b", "1bad"])
def test_invalid_family_names_are_rejected(name: str) -> None:
    with pytest.raises(ValueError):
        DynamicField(name)


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
def test_nonfinite_numbers_cannot_enter_the_catalog(value: float, field: DynamicField) -> None:
    with pytest.raises(ValueError, match="finite"):
        field.index_values(numeric={"bad": value}, categorical={})


def test_document_declaration_registers_storage_without_a_placeholder_field(field: DynamicField) -> None:
    class SampleDocument(Document):
        measurements: ClassVar[DynamicField] = DynamicField("measurements")
        author = Keyword()

    mapping = SampleDocument._doc_type.mapping.to_dict()
    assert SampleDocument.measurements == field
    assert set(mapping["properties"]) == {"author", *field.owned_fields}
    assert len(mapping["dynamic_templates"]) == 2
    assert SampleDocument().to_dict() == {}


def test_inherited_declarations_preserve_templates_without_mutating_parent(field: DynamicField) -> None:
    class ParentDocument(Document):
        measurements: ClassVar[DynamicField] = DynamicField("measurements")

    original = deepcopy(ParentDocument._doc_type.mapping.to_dict())

    class ChildDocument(ParentDocument):
        attributes: ClassVar[DynamicField] = DynamicField("attributes")

    class GrandchildDocument(ChildDocument):
        author = Keyword()

    index = Index("samples")
    index.document(GrandchildDocument)
    first = index.to_dict()
    assert index.to_dict() == first
    assert GrandchildDocument.measurements is ParentDocument.measurements
    assert set(first["mappings"]["properties"]) == {
        "author",
        *field.owned_fields,
        *ChildDocument.attributes.owned_fields,
    }
    assert len(first["mappings"]["dynamic_templates"]) == 4
    assert ParentDocument._doc_type.mapping.to_dict() == original


def test_document_declaration_rejects_static_storage_collision() -> None:
    with pytest.raises((RuntimeError, ValueError)) as error:

        class _(Document):
            measurements: ClassVar[DynamicField] = DynamicField("measurements")
            numeric_measurements = Keyword()

    cause = error.value.__cause__ or error.value
    assert isinstance(cause, ValueError)
    assert "already contains" in str(cause)


def test_document_declaration_requires_matching_attribute_name() -> None:
    with pytest.raises((RuntimeError, ValueError)) as error:

        class _(Document):
            attributes: ClassVar[DynamicField] = DynamicField("measurements")

    cause = error.value.__cause__ or error.value
    assert isinstance(cause, ValueError)
    assert "must be declared as" in str(cause)


def test_declaration_requires_an_elasticsearch_document() -> None:
    with pytest.raises((RuntimeError, TypeError)) as error:

        class _:
            measurements: ClassVar[DynamicField] = DynamicField("measurements")

    assert isinstance(error.value.__cause__ or error.value, TypeError)
