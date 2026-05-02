from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


ApiScope = Literal["runs:read", "runs:write", "reports:read", "usage:read", "admin:read"]


class ApiKeyCreate(BaseModel):
    organization_id: UUID
    name: str
    scopes: list[ApiScope] = Field(default_factory=lambda: ["runs:read", "reports:read", "usage:read"])
    expires_at: datetime | None = None


class ApiKeyRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    organization_id: UUID
    name: str
    prefix: str
    secret_preview: str
    scopes: list[ApiScope]
    status: Literal["active", "revoked"] = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime | None = None
    rotated_at: datetime | None = None


class ApiKeyRotateRead(ApiKeyRead):
    pass


class RetentionPolicyUpdate(BaseModel):
    organization_id: UUID
    asset_retention_days: int = 30
    report_retention_days: int = 90
    backup_retention_days: int = 30
    secure_delete_sla_days: int = 7
    incident_response_hours: int = 24
    dpa_status: Literal["draft_ready", "under_review", "signed"] = "draft_ready"


class RetentionPolicyRead(RetentionPolicyUpdate):
    region: Literal["EU"] = "EU"
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BillingExportCreate(BaseModel):
    organization_id: UUID
    month: str
    credits_used: float = 0
    estimated_cost_eur: float = 0
    gpu_seconds: float = 0
    input_tokens: int = 0
    output_tokens: int = 0
    storage_bytes: int = 0
    runs: int = 0
    reports: int = 0
    comparisons: int = 0
    usage_event_count: int = 0


class BillingExportRead(BillingExportCreate):
    id: UUID = Field(default_factory=uuid4)
    invoice_mode: Literal["manual_beta"] = "manual_beta"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SsoRoadmapRead(BaseModel):
    organization_id: UUID
    status: Literal["placeholder", "requirements_ready", "implementation_ready"] = "requirements_ready"
    protocol: Literal["SAML 2.0 / OIDC"] = "SAML 2.0 / OIDC"
    target_plan: Literal["Enterprise"] = "Enterprise"
    provider_examples: list[str] = Field(default_factory=lambda: ["Okta", "Microsoft Entra ID", "Google Workspace", "OneLogin"])
    requirements: list[str] = Field(default_factory=lambda: [
        "Dominio corporativo verificado",
        "Metadata XML o issuer/client id del proveedor",
        "Atributos minimos: email, nombre, organizacion y rol",
        "Ventana de QA con owner y viewer",
    ])
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EnterpriseSnapshotRead(BaseModel):
    organization_id: UUID
    plans: list[dict[str, str | int | list[str]]]
    api_keys: list[ApiKeyRead]
    retention_policy: RetentionPolicyRead
    sso_roadmap: SsoRoadmapRead
    billing_exports: list[BillingExportRead]
    procurement_checklist: list[dict[str, str]]
    sla: dict[str, str]
