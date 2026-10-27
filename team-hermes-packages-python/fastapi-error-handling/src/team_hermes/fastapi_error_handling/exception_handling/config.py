import logging
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Any

from starlette.requests import Request
from starlette.responses import Response

from team_hermes.core import ApplicationException


@dataclass(frozen=True)
class ErrorHandlingConfig:
    logger: logging.Logger = field(default_factory=lambda: logging.getLogger("team_hermes.fastapi_error_handling"))
    status_map: Mapping[type[ApplicationException], int] = field(default_factory=dict)
    trace_id_provider: Callable[[], str | None] | None = None
    extension_provider: Callable[[Request], Mapping[str, Any]] | None = None
    exception_observer: Callable[[Exception], None] | None = None
    exception_handlers: Mapping[type[Exception], Callable[[Request, Exception, "ErrorHandlingConfig"], Response]] = (
        field(default_factory=dict)
    )
    problem_type_map: Mapping[type[Exception], str] = field(default_factory=dict)

    def problem_type_for(self, exception: Exception, default: str = "about:blank") -> str:
        for exception_type, problem_type in self.problem_type_map.items():
            if isinstance(exception, exception_type):
                return problem_type
        return default
