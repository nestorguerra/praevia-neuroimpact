# Production runbooks v0.1

Fecha: 2026-05-01

## Principios

- Primero proteger datos del cliente.
- Segundo contener gasto.
- Tercero recuperar servicio.
- Cuarto documentar incidente.

## Worker GPU caido

Sintomas:

- runs quedan en `queued` o `running`.
- no se generan `prediction_artifacts`.
- admin muestra GPU seconds a cero y runs sin completar.

Acciones:

1. Pausar nuevos runs del workspace afectado.
2. Revisar logs del proveedor GPU.
3. Confirmar que `HF_TOKEN`, cache del modelo y storage output estan disponibles.
4. Reiniciar worker.
5. Relanzar solo runs idempotentes.
6. Registrar `error_event` y `audit_log`.

Rollback:

- Activar `TRIBE_WORKER_MODE=mock` solo para demos internas.
- Para cliente real, comunicar retraso y no fabricar resultados.

## Exceso de gasto GPU/LLM

Sintomas:

- `MONTHLY_COST_CAP_EUR` superado.
- `MONTHLY_GPU_CAP_SECONDS` superado.
- aumento anomalo de `usage_events`.

Acciones:

1. Bloquear nuevos runs de la organizacion.
2. Mantener acceso a informes ya generados.
3. Exportar `admin snapshot`.
4. Revisar assets mas caros por `analysis_run_id`.
5. Ajustar limites de organizacion.
6. Reabrir solo tras confirmar margen.

Regla inicial:

- Staging: `MONTHLY_COST_CAP_EUR=250`, `MONTHLY_GPU_CAP_SECONDS=3600`.
- Produccion piloto: `MONTHLY_COST_CAP_EUR=1200`, `MONTHLY_GPU_CAP_SECONDS=14400`.

## Borrado solicitado por cliente

Sintomas:

- cliente pide eliminar asset, informe o proyecto.

Acciones:

1. Ejecutar borrado desde `/app/admin`.
2. Verificar que desaparecen asset, derivados, runs, scoring, reports y comparativas.
3. Confirmar storage keys eliminadas en S3/R2.
4. Guardar `secure_deletion_request`.
5. Exportar manifiesto de borrado.
6. Enviar confirmacion operativa al cliente.

Importante:

- El borrado local del MVP elimina estado y storage keys simuladas.
- En produccion debe ejecutar delete real sobre bucket y conservar manifiesto.

## PDF regression falla

Sintomas:

- `node scripts/pdf-regression.mjs` falla.
- PDF no empieza por `%PDF-1.4`.
- layout A4 corrupto.

Acciones:

1. No publicar release.
2. Revisar `reporting/render-report.mjs`.
3. Abrir HTML generado en `/tmp/praevia-neuroimpact-qa/sprint12-pdf-regression.html`.
4. Comparar con `reporting/sample-report.json`.
5. Corregir CSS print-first.
6. Relanzar gate.

## Visual regression falla

Sintomas:

- overflow horizontal en desktop o mobile.
- screenshots criticos no se generan.

Acciones:

1. Revisar `/tmp/praevia-neuroimpact-qa/sprint12-visual-manifest.json`.
2. Abrir screenshot afectado.
3. Corregir layout responsive.
4. Relanzar `node scripts/visual-regression.mjs`.

## API no ready

Sintomas:

- `/health` falla.
- `/ready` falla.
- CORS no devuelve origen esperado.

Acciones:

1. Revisar variables de entorno.
2. Confirmar `ALLOWED_HOSTS`.
3. Confirmar `CORS_ALLOWED_ORIGINS`.
4. Confirmar `FORCE_HTTPS`.
5. Revisar logs backend.
6. Si hay deploy nuevo, rollback a imagen anterior.

## Incidente de seguridad

Acciones:

1. Revocar tokens sospechosos.
2. Rotar `JWT_SECRET` si aplica.
3. Revocar claves S3/R2 si hay riesgo de storage.
4. Revisar `audit_logs` por organizacion.
5. Congelar borrados automaticos hasta terminar investigacion.
6. Documentar alcance.

## Checklist post-incidente

- `error_event` creado.
- `audit_log` creado.
- cliente afectado identificado.
- datos afectados identificados.
- coste estimado del incidente calculado.
- accion correctiva asignada.
