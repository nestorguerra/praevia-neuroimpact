from __future__ import annotations

from app.repositories.comparison_db import comparison_db_repository
from app.repositories.comparison_memory import comparison_repository as comparison_memory_repository
from app.settings import settings


def comparison_repository():
    if settings.persistence_mode == "db":
        return comparison_db_repository
    return comparison_memory_repository

