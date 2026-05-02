from __future__ import annotations

from app.repositories.benchmarks_db import benchmarks_db_repository
from app.repositories.benchmarks_memory import benchmarks_repository as benchmarks_memory_repository
from app.settings import settings


def benchmarks_repository():
    if settings.persistence_mode == "db":
        return benchmarks_db_repository
    return benchmarks_memory_repository

