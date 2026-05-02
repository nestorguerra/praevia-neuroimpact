# Clearance TRIBE v2 y alternativas

> Documento interno para decision de negocio y revision legal. No incluir como anexo comercial salvo que legal lo pida.

## Decision actual

TRIBE v2 se puede usar para desarrollo, validacion tecnica y demos controladas, pero no debe convertirse en una funcionalidad SaaS comercial vendida a clientes sin autorizacion comercial expresa o una alternativa tecnica con derechos comerciales claros.

No se debe vender el producto como SaaS comercial recurrente basado en TRIBE hasta cerrar una de las salidas del gate de venta.

La pagina publica del modelo debe revisarse antes de cada piloto de pago, porque sus condiciones pueden cambiar. Ultima verificacion operativa: 2026-05-02.

## Gate de venta

Antes de vender un piloto de pago o SaaS recurrente, debe existir una de estas tres salidas:

1. Autorizacion comercial del titular del modelo para el caso de uso PraevIA.
2. Sustitucion por un modelo/pipeline propio o de terceros con permiso comercial claro.
3. Piloto estructurado como servicio de I+D/consultoria, revisado por legal, sin explotar el modelo como SaaS comercial automatizado.

## Solicitud de permiso comercial

Paquete a preparar para pedir autorizacion:

- entidad legal que solicita el permiso.
- descripcion del producto: pretest neurocognitivo in silico para piezas creativas.
- clientes objetivo: empresas, marketing, contenidos y eventos.
- datos procesados: assets creativos de cliente, no datos biometricos de audiencia.
- despliegue: worker GPU privado, storage segregado y logs de auditoria.
- modelo de negocio: piloto consultivo y SaaS B2B.
- territorios: Espana/UE inicialmente.
- compromiso de no entrenar con assets de cliente sin permiso.
- controles de lenguaje y limitaciones cientificas.

## Alternativas tecnicas

Plan B si no hay permiso:

- mantener TRIBE solo como referencia de I+D interna.
- construir scoring propio basado en features audiovisuales/textuales con licencia limpia.
- entrenar o calibrar un modelo propio cuando existan datos suficientes y derechos claros.
- ofrecer al cliente un modo "BYOM" si aporta modelo/derechos propios.
- vender temporalmente consultoria editorial con benchmarks y KPIs, sin claims ligados a TRIBE.

## Decision comercial permitida

Mientras no exista clearance:

- la landing puede captar demos y pilotos.
- la demo debe usar dataset propio/demo.
- el contrato piloto debe incluir alcance, limites, no biometria y no promesas de resultado.
- los documentos publicos no deben centrar la conversacion en la licencia del modelo.

## Owner

- Responsable negocio: Nestor Guerra.
- Responsable tecnico: CTO/lead asignado.
- Responsable legal: asesor externo antes de primera venta.
