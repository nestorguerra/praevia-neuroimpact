# Protocolo de validacion cientifica v0.1

## Objetivo

Evitar que los scores parezcan exactitud cientifica cuando en realidad son indicadores comparativos de apoyo a decision creativa.

## Unidad de validacion

El producto valida piezas, no personas.

Cada run debe guardar:

- Asset version.
- Modelo y version.
- Pipeline version.
- Prompt version si aplica.
- Benchmark version.
- Fecha.
- Parametros de scoring.
- Output crudo o referencia a output crudo.
- Informe generado.

## Test set inicial

Antes de Sprint 8:

- 3 videos cortos.
- 3 audios.
- 3 textos/guiones.
- 3 SRT.
- 3 casos A/B/C simulados.

Cada asset debe tener:

- Resultado esperado tecnico.
- Duracion.
- Metadatos.
- Output determinista de worker fake.
- Output real cuando TRIBE este operativo.

## Confianza

La confianza no es verdad absoluta. Debe combinar:

- Calidad del input.
- Duracion suficiente.
- Modalidades disponibles.
- Comparabilidad A/B/C.
- Estabilidad temporal.
- Cobertura de benchmark.

## Benchmarks

Fase demo:

- Benchmarks sinteticos o internos marcados como demo.

Fase piloto:

- Benchmark privado por cliente.
- No mezclar clientes salvo permiso explicito.

## Comparacion con KPIs reales

Cuando haya pilotos:

- Registrar VTR, retencion, CTR, scroll depth, brand lift, encuesta, feedback evento o KPI equivalente.
- No prometer causalidad.
- Usar los KPIs para calibrar que indicadores ayudan mejor a decidir.

## Failure modes que deben mostrarse

- Input demasiado corto.
- Audio ausente o pobre.
- Transcript de baja calidad.
- Duraciones A/B/C no comparables.
- Benchmark insuficiente.
- Confianza baja.
- Modelo no disponible.

