from __future__ import annotations

from uuid import UUID

from app.schemas.marketing import DemoRequestCreate, DemoRequestListRead, DemoRequestRead


class MarketingMemoryRepository:
    def __init__(self) -> None:
        self.demo_requests: dict[UUID, DemoRequestRead] = {}

    def create_demo_request(self, payload: DemoRequestCreate) -> DemoRequestRead:
        lead = DemoRequestRead(**payload.model_dump())
        self.demo_requests[lead.id] = lead
        return lead

    def list_demo_requests(self) -> DemoRequestListRead:
        return DemoRequestListRead(
            items=sorted(
                self.demo_requests.values(),
                key=lambda item: item.created_at,
                reverse=True,
            )
        )


marketing_repository = MarketingMemoryRepository()
