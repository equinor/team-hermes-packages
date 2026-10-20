from elasticsearch.dsl import Mapping
from team_hermes.elasticsearch import DateHistogramFacet, NumericHistogramFacet, SearchDefinition, SortClause
from team_hermes.elasticsearch.indexing import DynamicField

ATTRIBUTES = DynamicField("attributes")
MAPPING = Mapping()
for name in ("id", "country", "field"):
    MAPPING.field(name, "keyword")
MAPPING.field("total_depth", "float")
MAPPING.field("spud_date", "date")
ATTRIBUTES.add_to_mapping(MAPPING)

DEFINITION = (
    SearchDefinition.from_mapping(MAPPING.to_dict()["properties"])
    .with_facets(
        overrides=(
            NumericHistogramFacet(field="total_depth", interval=500),
            DateHistogramFacet(field="spud_date", calendar_interval="year"),
        ),
        exclude={"id"},
    )
    .with_sorting(
        default=(SortClause(field="id", order="asc"),),
        tiebreakers=(SortClause(field="id", order="asc"),),
    )
)

DOCUMENTS = [
    {
        "id": f"W-{i:03}",
        "country": "Norway" if i % 2 == 0 else "UK",
        "field": "Alpha" if i < 20 else "Bravo",
        "total_depth": 1000 + i * 100,
        "spud_date": f"{2000 + i // 4}-06-15",
        **ATTRIBUTES.index_values(
            numeric={"porosity": 5 + i / 2},
            categorical={"formation": "Sandstone" if i % 2 == 0 else "Shale"},
        ),
    }
    for i in range(40)
]
