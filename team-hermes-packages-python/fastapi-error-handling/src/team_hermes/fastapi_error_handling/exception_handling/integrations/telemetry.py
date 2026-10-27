from opentelemetry import trace

from team_hermes.core import ApplicationException


def get_trace_id() -> str | None:
    span = trace.get_current_span()
    trace_id = span.get_span_context().trace_id
    return format(trace_id, "032x") if trace_id else None


def record_exception(exception: Exception) -> None:
    span = trace.get_current_span()
    if not span.is_recording():
        return
    if isinstance(exception, ApplicationException):
        span.set_attribute("Exception type", exception.type)
        span.set_attribute("Exception title", exception.title or "")
        span.set_attribute("Exception detail", exception.detail or "")
        span.set_attribute("Exception severity", exception.severity.name)
    else:
        span.record_exception(exception)
