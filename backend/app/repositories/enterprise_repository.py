from __future__ import annotations

from app.repositories.enterprise_db import enterprise_db_repository
from app.repositories.enterprise_memory import enterprise_repository as enterprise_memory_repository
from app.settings import settings


def enterprise_repository():
    if settings.persistence_mode == "db":
        return enterprise_db_repository
    return enterprise_memory_repository

