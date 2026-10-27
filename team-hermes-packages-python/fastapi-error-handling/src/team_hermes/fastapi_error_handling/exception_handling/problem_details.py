from pydantic import BaseModel, ConfigDict, Field


class ErrorSource(BaseModel):
    pointer: str | None = Field(None, description="Location of the invalid value")


class ErrorItem(BaseModel):
    code: str | None = Field(None, description="Machine-readable error code")
    title: str | None = Field(None, description="Short summary of the error")
    detail: str | None = Field(None, description="Human-readable explanation")
    source: ErrorSource | None = Field(None, description="Object indicating the error source")


class ProblemDetailsExtensions(BaseModel):
    requestPath: str = Field(..., description="The request path that resulted in the error")
    traceId: str = Field(..., description="The trace identifier for correlating logs and traces")
    errorId: str = Field(..., description="A unique identifier for this specific error occurrence")
    model_config = ConfigDict(extra="allow")


class ProblemDetails(BaseModel):
    type: str | None = Field(default="about:blank", description="URI identifying the problem type")
    title: str | None = Field(default=None, description="Short summary of the problem")
    status: int = Field(default=500, description="HTTP status code")
    detail: str | None = Field(default=None, description="Human-readable explanation")
    instance: str | None = Field(default=None, description="URI identifying the specific occurrence")
    errors: list[ErrorItem] | None = Field(default=None, description="Array of specific error details")
    extensions: ProblemDetailsExtensions | None = Field(default=None, description="Custom extension members")
