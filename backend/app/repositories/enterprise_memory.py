from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.schemas.enterprise import (
    ApiKeyCreate,
    ApiKeyRead,
    BillingExportCreate,
    BillingExportRead,
    EnterpriseSnapshotRead,
    RetentionPolicyRead,
    RetentionPolicyUpdate,
    SsoRoadmapRead,
)


def _secret_preview(seed: str) -> tuple[str, str]:
    prefix = f"nia_beta_{seed.replace('-', '')[:7]}"
    return prefix, f"{prefix}...{seed.replace('-', '')[-4:]}"


def _plans() -> list[dict[str, str | int | list[str]]]:
    return [
        {
            "tier": "starter",
            "name": "Starter",
            "price_label": "Beta manual desde 1.500 EUR/mes",
            "included_credits": 120,
            "monthly_assets": "Hasta 20 piezas/mes",
            "features": ["Analisis individual", "PDF ejecutivo", "Export de uso"],
        },
        {
            "tier": "professional",
            "name": "Professional",
            "price_label": "Beta manual 5.000-10.000 EUR/mes",
            "included_credits": 420,
            "monthly_assets": "Hasta 80 piezas/mes",
            "features": ["A/B/C", "Benchmarks privados", "KPIs externos", "Workflow creativo"],
        },
        {
            "tier": "enterprise",
            "name": "Enterprise",
            "price_label": "Contrato anual bajo alcance",
            "included_credits": 1200,
            "monthly_assets": "Volumen pactado",
            "features": ["API keys", "SSO/SAML bajo contrato", "DPA", "Retencion configurable"],
        },
    ]


def _procurement_checklist() -> list[dict[str, str]]:
    return [
        {"label": "DPA basico", "status": "ready", "evidence": "Plantilla lista para revision legal"},
        {"label": "Politica de retencion", "status": "ready", "evidence": "Configurable por organizacion"},
        {"label": "Incident response", "status": "ready", "evidence": "Playbook y primera respuesta 24h beta"},
        {"label": "SSO/SAML", "status": "contractual", "evidence": "Requisitos preparados para Enterprise"},
        {"label": "Facturacion manual", "status": "ready", "evidence": "Export mensual de uso, sin pasarela de pago"},
    ]


def _sla() -> dict[str, str]:
    return {
        "name": "SLA piloto v1.5",
        "uptime_target": "Best effort beta, objetivo 99,0%",
        "support_window": "L-V 09:00-18:00 Europe/Madrid",
        "first_response": "24h laborables; 4h si bloquea demo/piloto",
        "onboarding": "Kickoff, organizacion, usuarios, demo dataset y primer benchmark",
        "offboarding": "Export, revocacion de API keys, borrado seguro y cierre de acceso",
    }


class EnterpriseMemoryRepository:
    def __init__(self) -> None:
        self.api_keys: dict[UUID, ApiKeyRead] = {}
        self.retention: dict[UUID, RetentionPolicyRead] = {}
        self.exports: dict[UUID, BillingExportRead] = {}
        self.sso: dict[UUID, SsoRoadmapRead] = {}

    def create_api_key(self, payload: ApiKeyCreate, *_args) -> ApiKeyRead:
        raw = ApiKeyRead(
            organization_id=payload.organization_id,
            name=payload.name,
            prefix="pending",
            secret_preview="pending",
            scopes=payload.scopes,
            expires_at=payload.expires_at or datetime.now(timezone.utc) + timedelta(days=90),
        )
        prefix, preview = _secret_preview(str(raw.id))
        key = raw.model_copy(update={"prefix": prefix, "secret_preview": preview})
        self.api_keys[key.id] = key
        return key

    def rotate_api_key(self, key_id: UUID, *_args) -> ApiKeyRead | None:
        key = self.api_keys.get(key_id)
        if not key:
            return None
        prefix, preview = _secret_preview(f"{key.id}{datetime.now(timezone.utc).timestamp()}")
        rotated = key.model_copy(update={
            "prefix": prefix,
            "secret_preview": preview,
            "rotated_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=90),
        })
        self.api_keys[key_id] = rotated
        return rotated

    def revoke_api_key(self, key_id: UUID, *_args) -> ApiKeyRead | None:
        key = self.api_keys.get(key_id)
        if not key:
            return None
        revoked = key.model_copy(update={"status": "revoked"})
        self.api_keys[key_id] = revoked
        return revoked

    def upsert_retention(self, payload: RetentionPolicyUpdate, *_args) -> RetentionPolicyRead:
        policy = RetentionPolicyRead(**payload.model_dump())
        self.retention[payload.organization_id] = policy
        return policy

    def create_billing_export(self, payload: BillingExportCreate, *_args) -> BillingExportRead:
        export = BillingExportRead(**payload.model_dump())
        self.exports[export.id] = export
        return export

    def snapshot(self, organization_id: UUID, *_args) -> EnterpriseSnapshotRead:
        retention = self.retention.get(organization_id) or RetentionPolicyRead(organization_id=organization_id)
        self.retention[organization_id] = retention
        sso = self.sso.get(organization_id) or SsoRoadmapRead(organization_id=organization_id)
        self.sso[organization_id] = sso
        return EnterpriseSnapshotRead(
            organization_id=organization_id,
            plans=_plans(),
            api_keys=[key for key in self.api_keys.values() if key.organization_id == organization_id],
            retention_policy=retention,
            sso_roadmap=sso,
            billing_exports=[item for item in self.exports.values() if item.organization_id == organization_id],
            procurement_checklist=_procurement_checklist(),
            sla=_sla(),
        )


enterprise_repository = EnterpriseMemoryRepository()
