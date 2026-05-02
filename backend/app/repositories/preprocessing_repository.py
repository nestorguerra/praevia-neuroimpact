from __future__ import annotations

from app.repositories.preprocessing_db import preprocessing_db_repository
from app.repositories.preprocessing_memory import preprocessing_repository as preprocessing_memory_repository
from app.settings import settings


def preprocessing_repository():
    if settings.persistence_mode == "db":
        return preprocessing_db_repository
    return preprocessing_memory_repository

