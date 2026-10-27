from collections.abc import Callable
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.interfaces import LoaderOption

from team_hermes.core import NotFoundException
from team_hermes.query import FilterBy, OrderBy, SortDirection
from team_hermes.sqlalchemy_core import apply_filters

from .repository_interface import RepositoryInterface
from .types import HasID


class Repository[Entity: HasID](RepositoryInterface[Entity]):
    def __init__(self, session: Session, entity: type[Entity]):
        self.entity = entity
        self.session = session

    def create(self, item: Entity) -> Entity:
        self.session.add(item)
        self.session.commit()
        return item

    def get(
        self, uid: UUID, fetch_relationships: Callable[[type[Entity]], list[LoaderOption]] | None = None
    ) -> Entity:
        query = select(self.entity).where(self.entity.uid == uid)
        if fetch_relationships:
            for query_option in fetch_relationships(self.entity):
                query = query.options(query_option)
        result = self.session.execute(query).unique()
        item = result.scalars().one_or_none()
        if not item:
            raise NotFoundException(f"No '{self.entity.__name__}' found with ID '{uid}'")
        return item

    def update(self, item: Entity) -> Entity:
        self.session.merge(item)
        self.session.commit()
        return item

    def delete(self, uid: UUID) -> None:
        query = select(self.entity).where(self.entity.uid == uid)
        item = self.session.scalars(query).one_or_none()
        if not item:
            raise NotFoundException(detail=f"No '{self.entity.__name__}' found with ID '{uid}'")
        self.session.delete(item)
        self.session.commit()

    def list(
        self,
        orderby: list[OrderBy] | None = None,
        filters: FilterBy | None = None,
        limit: int | None = None,
        offset: int | None = None,
        fetch_relationships: Callable[[type[Entity]], list[LoaderOption]] | None = None,
    ) -> Any:
        query = select(self.entity)
        if fetch_relationships:
            for query_option in fetch_relationships(self.entity):
                query = query.options(query_option)
        query = apply_filters(self.entity, query, filters)
        if orderby:
            for order_by in orderby:
                if "." in order_by.key:
                    parts = order_by.key.split(".")
                    column = getattr(self.entity, parts[0])
                    for part in parts[1:]:
                        column = getattr(column, part)
                else:
                    column = getattr(self.entity, order_by.key)
                query = query.order_by(column.asc() if order_by.direction == SortDirection.asc else column.desc())
        if limit is not None:
            query = query.limit(limit)
        if offset is not None:
            query = query.offset(offset)
        return self.session.scalars(query).unique().all()

    def count(self, filters: FilterBy | None) -> int:
        query = select(func.count()).select_from(self.entity)
        query = apply_filters(self.entity, query, filters)
        result = self.session.execute(query)
        return result.scalar() or 0
