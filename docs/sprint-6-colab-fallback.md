# Sprint 6 · Fallback Colab manual

Uso solo de emergencia si el worker GPU no esta disponible.

## Cuándo usarlo

- No hay GPU disponible en el proveedor.
- El Docker de TRIBE falla por dependencias externas.
- El cliente necesita una demo controlada antes de activar infraestructura GPU.

## Procedimiento

1. Subir asset corto ya normalizado desde Sprint 5.
2. Subir transcript o SRT si existe.
3. Ejecutar el notebook Colab de referencia.
4. Exportar predicciones como `bold_predictions.npz`.
5. Exportar segmentos como `segments.parquet` o `segments.csv`.
6. Guardar manualmente los outputs con storage key equivalente:

```text
predictions/org/{organization_id}/experiment/{experiment_id}/asset/{asset_id}/run/{run_id}/
```

7. Crear o actualizar `analysis_runs` como `done`.
8. Registrar logs indicando `worker_mode=colab_fallback`.

## Regla

No usar este flujo como produccion. Es una salida de emergencia para demos o investigacion.

