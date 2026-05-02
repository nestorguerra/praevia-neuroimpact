from __future__ import annotations

from app.repositories.collaboration_db import collaboration_db_repository
from app.repositories.collaboration_memory import collaboration_repository as collaboration_memory_repository
from app.settings import settings


def collaboration_repository():
    if settings.persistence_mode == "db":
        return collaboration_db_repository
    return collaboration_memory_repository
