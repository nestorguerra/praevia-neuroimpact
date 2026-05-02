# Politica de retencion y borrado

## Principio

Guardar solo lo necesario para operar el analisis, entregar informes, auditar seguridad y cumplir el contrato piloto.

## Valores beta por defecto

| Categoria | Retencion por defecto | Borrado |
| --- | ---: | --- |
| Assets originales | 30 dias | borrado seguro bajo solicitud o fin de retencion |
| Derivados tecnicos | 30 dias | junto al asset original |
| Predicciones y scoring | 90 dias | segun contrato o cierre de piloto |
| Informes PDF/HTML/JSON | 90 dias | bajo solicitud o fin de retencion |
| Benchmarks/KPIs cliente | durante piloto/contrato | export y borrado al cierre |
| Logs/auditoria | minimo contractual | conservacion limitada para seguridad |
| Backups | 30 dias | rotacion automatica |

## Configuracion por organizacion

La app enterprise permite ajustar:

- retencion de assets.
- retencion de informes.
- retencion de backups.
- SLA de borrado seguro.
- region preferente.

## Borrado seguro

Una solicitud de borrado debe cubrir:

- asset original.
- derivados de preprocesamiento.
- predicciones.
- scoring.
- informes.
- comparativas.
- links compartidos.
- referencias en storage.

Se conserva audit log minimo con: quien solicito, cuando, objeto borrado, resultado y motivo contractual.

## Cierre de piloto

Offboarding:

1. exportar informes y uso si el cliente lo solicita.
2. revocar API keys.
3. borrar assets y derivados.
4. eliminar share links activos.
5. cerrar usuarios.
6. entregar evidencia de borrado.
