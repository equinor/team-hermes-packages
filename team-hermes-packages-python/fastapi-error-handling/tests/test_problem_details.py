import json

import pytest
from pydantic import ValidationError

from team_hermes.fastapi_error_handling import ErrorItem, ErrorSource, ProblemDetails, ProblemDetailsExtensions


def test_default_payload_preserves_null_fields():
    assert ProblemDetails().model_dump() == {
        "type": "about:blank",
        "title": None,
        "status": 500,
        "detail": None,
        "instance": None,
        "errors": None,
        "extensions": None,
    }


def test_extensions_and_error_items_round_trip():
    extensions = ProblemDetailsExtensions.model_validate(
        {"requestPath": "/orders", "traceId": "trace", "errorId": "error", "severity": "WARNING"}
    )
    problem = ProblemDetails(
        status=422,
        errors=[ErrorItem(code="missing", source=ErrorSource(pointer="/body/name"))],
        extensions=extensions,
    )
    assert ProblemDetails.model_validate_json(problem.model_dump_json()) == problem
    assert problem.model_dump()["extensions"]["severity"] == "WARNING"
    assert problem.extensions is not None
    assert problem.extensions.requestPath == "/orders"


def test_correlation_fields_are_required():
    with pytest.raises(ValidationError):
        ProblemDetailsExtensions.model_validate({})


def test_problem_response_omits_absent_fields():
    response = ProblemDetails().to_response(headers={"Retry-After": "30"})
    assert response.status_code == 500
    assert response.headers["content-type"] == "application/problem+json"
    assert response.headers["retry-after"] == "30"
    assert json.loads(bytes(response.body)) == {"type": "about:blank", "status": 500}


def test_problem_response_preserves_error_pointers_and_metadata():
    problem = ProblemDetails(
        status=400,
        instance="/problems/order-1",
        errors=[ErrorItem(code="positive_total_required", detail="Total must be positive", pointer="#/total")],
        extensions=ProblemDetailsExtensions(
            requestPath="/orders", traceId="trace", errorId="error", context={"optional": None}
        ),
    )
    body = json.loads(bytes(problem.to_response().body))
    assert body["errors"] == [
        {"code": "positive_total_required", "detail": "Total must be positive", "pointer": "#/total"}
    ]
    assert body["instance"] == "/problems/order-1"
    assert body["extensions"]["context"] == {"optional": None}
    assert body["extensions"]["traceId"] == "trace"
    assert "traceId" not in body


@pytest.mark.parametrize("as_model", [False, True])
def test_extension_collisions_cannot_supply_problem_fields(as_model):
    extensions = {
        "requestPath": "/orders",
        "traceId": "trace",
        "errorId": "error",
        "type": "private:type",
        "title": "Private title",
        "status": 200,
        "detail": "Private detail",
        "instance": "private:instance",
        "errors": [{"detail": "Private error"}],
        "extensions": {"private": True},
        "code": "safe_code",
    }
    problem = ProblemDetails(
        status=400,
        extensions=ProblemDetailsExtensions.model_validate(extensions) if as_model else extensions,
    )
    body = json.loads(bytes(problem.to_response().body))
    assert body == {
        "type": "about:blank",
        "status": 400,
        "extensions": extensions,
    }
    assert extensions["status"] == 200


def test_nested_metadata_schema_and_round_trip():
    body = {
        "type": "urn:order:invalid",
        "status": 400,
        "extensions": {"requestPath": "/orders", "traceId": "trace", "errorId": "error", "ruleCode": "order_limit"},
    }
    problem = ProblemDetails.model_validate(body)
    assert json.loads(bytes(problem.to_response().body)) == body
    for mode in ("validation", "serialization"):
        schema = ProblemDetails.model_json_schema(mode=mode)
        assert {"extensions", "errors"} <= schema["properties"].keys()
        assert not {"requestPath", "traceId", "errorId"} & schema["properties"].keys()
        metadata_schema = schema["$defs"]["ProblemDetailsExtensions"]
        assert {"requestPath", "traceId", "errorId"} <= metadata_schema["properties"].keys()
        assert metadata_schema["additionalProperties"] is True
