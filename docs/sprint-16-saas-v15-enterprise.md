# Sprint 16 · SaaS comercial v1.5 y enterprise basico

## Objetivo

Dejar NeuroImpact Analyzer preparado para operar 3-5 pilotos en paralelo sin mezclar datos, con costes controlados, informes trazables, seguridad defendible y propuesta de renovacion SaaS.

La pasarela de pago queda fuera del alcance beta. La facturacion se resuelve con export mensual de uso y renovacion manual.

## Entregables implementados

- Pantalla privada `/app/enterprise`.
- Planes SaaS Starter, Professional y Enterprise definidos.
- Export mensual de uso en JSON, CSV y PDF.
- API keys basicas por organizacion, con scopes, rotacion y revocacion.
- SSO/SAML como roadmap Enterprise bajo contrato.
- Politica de retencion configurable por organizacion.
- DPA basico, checklist procurement, SLA piloto y playbook soporte documentados.
- Backend preparado con endpoints enterprise.
- SQL base para Postgres real.
- Gate automatizado `enterprise:gate` integrado en `production-gate`.

## Decisiones

### Sin pasarela de pago

No se integra Stripe ni checkout automatico. En beta esto evita friccion, reduce superficie legal y permite vender pilotos consultivos con factura manual.

### API keys beta

Las API keys permiten preparar integraciones para runs, informes y uso. En produccion real deben guardarse solo como hash, nunca como secreto completo.

### SSO

El SSO queda preparado como paquete Enterprise contractual. No se activa por defecto para no aumentar complejidad en pilotos iniciales.

## Rutas frontend

- `/app/enterprise`: SaaS v1.5, planes, API keys, export mensual, SSO, retencion, procurement y SLA.
- `/app/admin`: coste, creditos, audit log y borrado seguro.

## Endpoints backend

- `GET /v1/enterprise/{organization_id}/snapshot`
- `POST /v1/enterprise/api-keys`
- `POST /v1/enterprise/api-keys/{key_id}/rotate`
- `POST /v1/enterprise/api-keys/{key_id}/revoke`
- `PUT /v1/enterprise/retention-policy`
- `POST /v1/enterprise/billing-exports`

## SQL

- `infra/sql/0011_enterprise_saas_v15.sql`

Tablas:

- `organization_api_keys`
- `organization_retention_policies`
- `organization_sso_configs`
- `monthly_usage_exports`

## Criterio de aceptacion

Un owner puede abrir `/app/enterprise`, revisar planes beta, generar un export mensual, crear/rotar/revocar una API key, ajustar retencion, ver el estado de SSO Enterprise, consultar SLA y validar el checklist procurement.

## Gate

```bash
cd frontend
npm run enterprise:gate
```

El gate verifica:

- Acceso a `/app/enterprise`.
- Generacion de export mensual.
- Descarga de PDF de pack enterprise.
- Creacion y rotacion/revocacion de API key.
- Presencia de checklist procurement y SSO placeholder.

## Pendiente para produccion real

- Aplicar SQL en Supabase/Postgres con RLS.
- Hash real de API keys en backend.
- Billing manual conectado a CRM/facturacion.
- DPA revisado por legal.
- SSO real cuando haya cliente Enterprise firmado.
- Runbook de incidentes conectado a herramienta de soporte.
