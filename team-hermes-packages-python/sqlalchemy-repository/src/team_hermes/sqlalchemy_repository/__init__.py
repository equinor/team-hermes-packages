"""Generic SQLAlchemy CRUD repository."""

from .repository import Repository, RepositoryInterface
from .repository.types import HasID

__all__ = ["HasID", "Repository", "RepositoryInterface"]
