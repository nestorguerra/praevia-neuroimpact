from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.repositories.db import connection
from app.settings import settings

router = APIRouter(tags=["auth"])


class LocalLoginRequest(BaseModel):
    email: EmailStr
    password: str


def _initials(name_or_email: str) -> str:
    clean = name_or_email.split("@", 1)[0].replace(".", " ").replace("_", " ").replace("-", " ")
    parts = [part for part in clean.strip().split() if part]
    return "".join(part[0].upper() for part in parts[:2]) or "PV"


def _jwt_secret() -> str:
    secret = settings.supabase_jwt_secret or settings.jwt_secret
    if not secret or secret == "change-me-local-only":
        raise HTTPException(status_code=503, detail="JWT secret no configurado.")
    return secret


def _plan_label(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    if normalized in {"professional", "enterprise"}:
        return normalized.capitalize()
    return "Piloto corporativo"


def _status_label(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    if normalized in {"active", "activo"}:
        return "Activo"
    if normalized in {"demo"}:
        return "Demo"
    return "Piloto"


def _create_token(row: dict[str, Any]) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "sub": str(row["user_id"]),
        "email": row["email"],
        "role": "authenticated",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=12)).timestamp()),
    }
    return jwt.encode(claims, _jwt_secret(), algorithm="HS256")


@router.post("/auth/local/login")
def local_login(payload: LocalLoginRequest) -> dict[str, Any]:
    if settings.auth_mode != "local":
        raise HTTPException(status_code=404, detail="Login beta no disponible.")
    if not settings.demo_login_email or not settings.demo_login_password:
        raise HTTPException(status_code=503, detail="Login beta no configurado.")

    email = payload.email.strip().lower()
    if email != settings.demo_login_email.strip().lower() or payload.password != settings.demo_login_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas.")

    with connection() as conn:
        row = conn.execute(
            """
            select
              p.id as user_id,
              p.email,
              coalesce(p.full_name, p.email) as full_name,
              o.id as organization_id,
              o.name as organization_name,
              o.slug as organization_slug,
              o.credits,
              o.plan,
              o.status,
              m.id as membership_id,
              m.role
            from public.profiles p
            join public.memberships m on m.user_id = p.id
            join public.organizations o on o.id = m.organization_id
            where lower(p.email) = %s
            order by case m.role when 'owner' then 1 when 'admin' then 2 when 'analyst' then 3 else 4 end
            limit 1
            """,
            (email,),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Usuario beta no encontrado en la base de datos.")

    token = _create_token(row)
    user_name = row["full_name"] or row["email"]
    return {
        "user": {
            "id": str(row["user_id"]),
            "name": user_name,
            "email": row["email"],
            "initials": _initials(user_name),
        },
        "organization": {
            "id": str(row["organization_id"]),
            "name": row["organization_name"],
            "slug": row["organization_slug"],
            "credits": int(row["credits"] or 0),
            "plan": _plan_label(row["plan"]),
            "status": _status_label(row["status"]),
        },
        "membership": {
            "id": str(row["membership_id"]),
            "userId": str(row["user_id"]),
            "organizationId": str(row["organization_id"]),
            "role": row["role"],
        },
        "provider": "supabase",
        "accessToken": token,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
