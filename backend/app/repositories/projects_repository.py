from __future__ import annotations

from app.repositories.memory import repository as memory_repository
from app.repositories.projects_db import db_repository
from app.settings import settings


def project_repository():
    if settings.persistence_mode == "db":
        return db_repository
    return memory_repository
