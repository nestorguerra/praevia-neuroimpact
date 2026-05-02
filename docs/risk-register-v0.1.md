# Risk Register v0.1

## Semaforo general

Estado actual: AMARILLO.

Podemos construir prototipo y MVP privado. Para pilotos pagados o SaaS comercial, el gate principal es el permiso comercial o sustitucion del motor base.

## Riesgos

| ID | Riesgo | Nivel | Owner | Mitigacion | Gate |
| --- | --- | --- | --- | --- | --- |
| R-001 | Uso comercial del modelo base | Alto | Producto/Legal | Permiso comercial, modelo alternativo o piloto no comercial/I+D documentado | Antes de piloto pagado |
| R-002 | Claims de emocion/compra/mente | Alto | Producto/Marketing | Guia de lenguaje, guardrail LLM, revision de copy | Antes de landing final/PDF |
| R-003 | Activos con derechos no autorizados | Alto | Legal/Cliente | Terminos de cliente con warranties de derechos | Antes de upload cliente |
| R-004 | Datos sensibles o biometricos | Alto | Legal/Security | Ban inicial, DPIA trigger, no audiencia real | Antes de cualquier feature de audiencia |
| R-005 | Coste GPU descontrolado | Medio | Tech/Ops | Creditos, caps, limite de duracion, admin usage | Antes de demo externa |
| R-006 | Sobreinterpretacion cientifica | Alto | Science/Product | Confianza, benchmark, evidencia y limites en cada score | Antes de dashboard/PDF |
| R-007 | PDF no reproducible | Medio | Reporting | Snapshot HTML/PDF inmutable y versionado | Antes de informes cliente |
| R-008 | Drift API/frontend | Medio | Tech | Schemas versionados, OpenAPI, contract tests | Antes de Sprint 3 |
| R-009 | Benchmarks mezclan clientes | Alto | Data/Governance | Segregacion por cliente; pooling solo con permiso explicito | Antes de benchmarks reales |
| R-010 | Dependencia de proveedores LLM | Medio | Tech/Product | Router configurable, salida JSON, auditoria de prompts | Antes de informes premium |

## Go / No-Go

Go:

- Desarrollo local.
- Demo privada.
- I+D.
- Piloto controlado sin monetizacion directa y con terminos claros.

No-Go:

- SaaS comercial abierto apoyado en el modelo base sin permiso.
- Agencia white-label comercial sin resolver licencia y derechos.
- Analisis de empleados, estudiantes o audiencia real para emocion/engagement.
- Claims de compra, ROI o emocion real.

