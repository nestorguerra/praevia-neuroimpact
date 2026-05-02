from __future__ import annotations

from app.repositories.reporting_db import reporting_db_repository
from app.repositories.reporting_memory import reporting_repository as reporting_memory_repository
from app.settings import settings


def reporting_repository():
    if settings.persistence_mode == "db":
        return reporting_db_repository
    return reporting_memory_repository

