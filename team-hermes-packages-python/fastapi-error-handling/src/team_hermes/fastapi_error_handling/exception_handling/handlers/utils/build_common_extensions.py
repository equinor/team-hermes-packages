import uuid
from collections.abc import Mapping
from typing import Any

from starlette.requests import Request

from ...config import ErrorHandlingConfig
from ...problem_details import ProblemDetailsExtensions


def build_common_extensions(
    request: Request,
    custom_extensions: Mapping[str, Any] | None = None,
    config: ErrorHandlingConfig | None = None,
) -> ProblemDetailsExtensions:
    """Build common extension fields for all Problem Details responses."""
    config = config or ErrorHandlingConfig()
    error_id = str(uuid.uuid4())
    trace_id = config.trace_id_provider() if config.trace_id_provider else None
    if not trace_id:
        trace_id = request.headers.get("X-Trace-Id", request.headers.get("traceparent", ""))
    extensions: dict[str, Any] = {
        "requestPath": str(request.url.path),
        "traceId": trace_id,
        "errorId": error_id,
    }
    if config.extension_provider:
        extensions.update(config.extension_provider(request))
    if custom_extensions:
        extensions.update(custom_extensions)
    return ProblemDetailsExtensions(**extensions)
