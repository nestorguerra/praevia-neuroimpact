from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.schemas.runtime_settings import RuntimeSettingsRead, RuntimeSettingsUpdate


class RuntimeSettingsMemoryRepository:
    def __init__(self) -> None:
        self.settings: dict[tuple[UUID, str], RuntimeSettingsRead] = {}

    def get(self, organization_id: UUID, environment: str, *_args) -> RuntimeSettingsRead | None:
        return self.settings.get((organization_id, environment))

    def upsert(self, payload: RuntimeSettingsUpdate, *_args) -> RuntimeSettingsRead:
        current = self.settings.get((payload.organization_id, payload.environment))
        if current:
            next_item = current.model_copy(update={**payload.model_dump(), "updated_at": datetime.now(timezone.utc)})
        else:
            now = datetime.now(timezone.utc)
            next_item = RuntimeSettingsRead(id=uuid4(), created_at=now, updated_at=now, **payload.model_dump())
        self.settings[(payload.organization_id, payload.environment)] = next_item
        return next_item


runtime_settings_memory_repository = RuntimeSettingsMemoryRepository()
