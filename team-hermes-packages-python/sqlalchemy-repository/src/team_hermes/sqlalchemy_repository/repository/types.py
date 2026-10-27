from typing import Protocol
from uuid import UUID

from sqlalchemy.orm import Mapped


class HasID(Protocol):
    uid: Mapped[UUID]
