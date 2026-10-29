from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable
from typing import Any
from uuid import UUID

from sqlalchemy.orm.interfaces import LoaderOption

from team_hermes.query import FilterBy, OrderBy


class RepositoryInterface[Entity](ABC):
    @abstractmethod
    def create(self, item: Entity) -> Entity:
        pass

    @abstractmethod
    def create_many(self, items: list[Entity]) -> list[Entity]:
        pass

    @abstractmethod
    def bulk_insert(self, rows: list[dict[str, Any]]) -> None:
        pass

    @abstractmethod
    def get(
        self, uid: UUID, fetch_relationships: Callable[[type[Entity]], list[LoaderOption]] | None = None
    ) -> Entity:
        pass

    @abstractmethod
    def update(self, item: Entity) -> Entity:
        pass

    @abstractmethod
    def delete(self, uid: UUID) -> None:
        pass

    @abstractmethod
    def list(
        self,
        orderby: list[OrderBy] | None = None,
        filters: FilterBy | None = None,
        limit: int | None = None,
        offset: int | None = None,
        fetch_relationships: Callable[[type[Entity]], list[LoaderOption]] | None = None,
    ) -> Any:
        pass

    @abstractmethod
    def count(self, filters: FilterBy | None) -> int:
        pass
