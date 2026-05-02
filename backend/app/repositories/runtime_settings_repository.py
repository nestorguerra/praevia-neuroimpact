from __future__ import annotations

from app.repositories.runtime_settings_db import runtime_settings_db_repository
from app.repositories.runtime_settings_memory import runtime_settings_memory_repository
from app.settings import settings


def runtime_settings_repository():
    if settings.persistence_mode == "db":
        return runtime_settings_db_repository
    return runtime_settings_memory_repository

