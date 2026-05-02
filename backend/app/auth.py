from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.settings import settings

security = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    email: str | None
    auth_role: str
    provider: str


def _local_user() -> CurrentUser:
    return CurrentUser(
        id=UUID("00000000-0000-4000-8000-000000000001"),
        email="local@praevia.dev",
        auth_role="owner",
        provider="local",
    )


def _jwt_secret() -> str:
    secret = settings.supabase_jwt_secret or settings.jwt_secret
    if not secret or secret == "change-me-local-only":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase JWT secret is not configured for authenticated API access.",
        )
    return secret


def require_auth(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> CurrentUser:
    if settings.auth_mode == "local" and settings.app_env == "local":
        return _local_user()

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token.")

    try:
        claims = jwt.decode(
            credentials.credentials,
            _jwt_secret(),
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token.") from exc

    subject = claims.get("sub")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token without subject.")

    try:
        user_id = UUID(subject)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject.") from exc

    return CurrentUser(
        id=user_id,
        email=claims.get("email"),
        auth_role=claims.get("role", "authenticated"),
        provider="supabase",
    )
