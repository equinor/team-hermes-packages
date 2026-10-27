from collections.abc import Callable, Coroutine
from typing import Any, ClassVar, Self

from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from pydantic import ValidationError
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import Response

from team_hermes.core import ApplicationException

from .handlers import (
    ErrorHandlingConfig,
    application_exception_handler,
    fallback_exception_handler,
    request_validation_exception_handler,
    validation_exception_handler,
)


class ExceptionHandlingRoute(APIRoute):
    config: ClassVar[ErrorHandlingConfig] = ErrorHandlingConfig()

    @classmethod
    def with_config(cls, config: ErrorHandlingConfig) -> type[Self]:
        return type(f"Configured{cls.__name__}", (cls,), {"config": config})

    def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        original_route_handler = super().get_route_handler()

        async def custom_route_handler(request: Request) -> Response:
            try:
                return await original_route_handler(request)
            except ApplicationException as exception:
                return application_exception_handler(request, exception, self.config)
            except ValidationError as exception:
                return validation_exception_handler(request, exception, self.config)
            except RequestValidationError as exception:
                return request_validation_exception_handler(request, exception, self.config)
            except HTTPException:
                raise
            except Exception as exception:
                for exception_type, handler in self.config.exception_handlers.items():
                    if isinstance(exception, exception_type):
                        return handler(request, exception, self.config)
                return fallback_exception_handler(request, exception, self.config)

        return custom_route_handler
