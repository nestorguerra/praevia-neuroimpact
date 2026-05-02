from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.auth import require_auth
from app.repositories.marketing_memory import marketing_repository
from app.schemas.marketing import DemoRequestCreate, DemoRequestListRead, DemoRequestRead

router = APIRouter(tags=["marketing"])


@router.post("/marketing/demo-requests", response_model=DemoRequestRead)
def create_demo_request(payload: DemoRequestCreate) -> DemoRequestRead:
    if not payload.consent:
        raise HTTPException(status_code=422, detail="Consent is required for demo requests.")
    if "@" not in payload.email or "." not in payload.email.split("@")[-1]:
        raise HTTPException(status_code=422, detail="A valid corporate email is required.")
    return marketing_repository.create_demo_request(payload)


@router.get("/marketing/demo-requests", response_model=DemoRequestListRead, dependencies=[Depends(require_auth)])
def list_demo_requests() -> DemoRequestListRead:
    return marketing_repository.list_demo_requests()
