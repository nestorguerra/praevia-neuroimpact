# Enterprise beta · DPA, retencion, SLA y soporte

## DPA basico

Estado: plantilla lista para revision legal.

Puntos minimos:

- PraevIA actua como encargado cuando procesa assets del cliente.
- El cliente conserva titularidad sobre assets, informes, benchmarks y KPIs.
- No se usan assets del cliente para entrenar modelos sin autorizacion expresa.
- Subprocesadores y hosting se documentan por entorno y contrato.
- Borrado seguro disponible bajo solicitud.
- Incidentes comunicados segun SLA piloto.

## Politica de retencion

Valores beta por defecto:

- Assets originales: 30 dias.
- Informes: 90 dias.
- Backups: 30 dias.
- Borrado seguro: objetivo 7 dias.
- Region: EU.

La organizacion puede ajustar retencion desde `/app/enterprise`. En produccion real esto debe persistir server-side y aplicarse a storage, derivados, informes, logs y backups.

## Incident response

Flujo:

1. Registrar incidente con hora, organizacion afectada, severidad y alcance.
2. Contener acceso o job afectado.
3. Comunicar estado inicial al cliente.
4. Resolver o mitigar.
5. Preparar RCA breve con causa, impacto y accion correctiva.

SLA beta:

- Primera respuesta normal: 24h laborables.
- Bloqueo de demo/piloto: 4h laborables.
- Comunicacion de incidente relevante: 24h desde confirmacion.

## Soporte, onboarding y offboarding

Onboarding:

- Kickoff de caso de uso.
- Crear organizacion y usuarios.
- Revisar retencion y permisos.
- Cargar dataset demo o primer benchmark.
- Acordar criterio de exito del piloto.

Offboarding:

- Exportar informes, benchmarks y uso.
- Revocar API keys.
- Borrar assets y derivados.
- Cerrar usuarios.
- Entregar cierre de piloto y propuesta de renovacion.

## Checklist procurement

- DPA basico.
- Politica de retencion.
- Incident response.
- Aislamiento por organizacion.
- API keys y revocacion.
- SSO/SAML bajo contrato Enterprise.
- Hosting/region UE.
- Seguridad de informes y trazabilidad.
- Lenguaje cientifico responsable.
