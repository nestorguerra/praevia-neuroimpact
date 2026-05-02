from __future__ import annotations

from app.repositories.inference_db import inference_db_repository
from app.repositories.inference_memory import inference_repository as inference_memory_repository
from app.settings import settings


def inference_repository():
    if settings.persistence_mode == "db":
        return inference_db_repository
    return inference_memory_repository

