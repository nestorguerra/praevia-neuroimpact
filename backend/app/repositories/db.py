from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Iterator
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel

from app.auth import CurrentUser
from app.settings import settings


@contextmanager
def connection() -> Iterator[Any]:
    import psycopg
    from psycopg.rows import dict_row

    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        yield conn


def jsonb(value: Any) -> Any:
    from psycopg.types.json import Jsonb

    return Jsonb(to_jsonable(value))


def to_jsonable(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, list):
        return [to_jsonable(item) for item in value]
    if isinstance(value, tuple):
        return [to_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {str(key): to_jsonable(item) for key, item in value.items()}
    return value


def assert_org_member(conn: Any, organization_id: UUID, user: CurrentUser) -> None:
    row = conn.execute(
        """
        select exists (
          select 1
          from public.memberships
          where organization_id = %s
            and user_id = %s
        ) as allowed
        """,
        (organization_id, user.id),
    ).fetchone()
    if not row or not row["allowed"]:
        raise HTTPException(status_code=403, detail="User is not a member of this organization.")


def assert_org_admin(conn: Any, organization_id: UUID, user: CurrentUser) -> None:
    row = conn.execute(
        """
        select exists (
          select 1
          from public.memberships
          where organization_id = %s
            and user_id = %s
            and role in ('owner', 'admin')
        ) as allowed
        """,
        (organization_id, user.id),
    ).fetchone()
    if not row or not row["allowed"]:
        raise HTTPException(status_code=403, detail="User is not an admin of this organization.")


def require_row(row: Any, detail: str) -> Any:
    if not row:
        raise HTTPException(status_code=404, detail=detail)
    return row

