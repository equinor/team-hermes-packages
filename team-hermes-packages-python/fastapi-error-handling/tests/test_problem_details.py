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


def test_correlation_fields_are_required():
    with pytest.raises(ValidationError):
        ProblemDetailsExtensions.model_validate({})
