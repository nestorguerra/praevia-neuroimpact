from __future__ import annotations

from app.repositories.scoring_db import scoring_db_repository
from app.repositories.scoring_memory import scoring_repository as scoring_memory_repository
from app.settings import settings


def scoring_repository():
    if settings.persistence_mode == "db":
        return scoring_db_repository
    return scoring_memory_repository

