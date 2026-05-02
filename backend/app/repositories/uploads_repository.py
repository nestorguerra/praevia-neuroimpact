from __future__ import annotations

from app.repositories.uploads_db import uploads_db_repository
from app.repositories.uploads_memory import uploads_memory_repository
from app.settings import settings


def uploads_repository():
    if settings.persistence_mode == "db":
        return uploads_db_repository
    return uploads_memory_repository

