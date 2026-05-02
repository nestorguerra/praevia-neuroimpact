from __future__ import annotations

from app.repositories.admin_db import admin_db_repository
from app.repositories.admin_memory import admin_repository as admin_memory_repository
from app.settings import settings


def admin_repository():
    if settings.persistence_mode == "db":
        return admin_db_repository
    return admin_memory_repository

