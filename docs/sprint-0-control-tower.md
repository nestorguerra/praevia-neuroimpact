# Sprint 0 · Control Tower

Fecha de arranque: 2026-05-01  
Workspace: `/Users/nestorguerra/Documents/New project/praevia-neuroimpact`

## Objetivo

Dejar cerrado el marco de construccion antes de entrar en Sprint 1. Sprint 0 no busca hacer pantallas nuevas: busca evitar que el producto nazca como un Colab con una capa bonita encima.

## Resultado esperado

Al final del Sprint 0 debe existir:

- Repositorio base con estructura monorepo.
- Arquitectura v0.1.
- Alcance v1.0 Pilot-Ready.
- Mapa de entornos local, staging y produccion.
- Modelo inicial de costes y creditos.
- Gobierno de lenguaje, claims, privacidad y ciencia.
- Mapa de assets de diseno y decision de migracion.
- Estado de Ruflo documentado.

## Estado actual del gate

Estado: AMARILLO.

Motivo: tecnicamente podemos construir MVP y demos; comercialmente hay que resolver o acotar el uso del modelo base antes de vender un SaaS abierto. La via correcta para avanzar ahora es:

- I+D y demo privada.
- Pilotos controlados con contrato y lenguaje conservador.
- Cero promesas de emocion real, compra, recuerdo garantizado o lectura mental.
- Validacion legal antes de empaquetarlo como producto SaaS comercial.

## Scope v1.0 Pilot-Ready

Un usuario corporativo puede:

1. Registrarse y entrar a una organizacion.
2. Crear un workspace, proyecto y experimento.
3. Subir video, audio o texto.
4. Ejecutar un analisis individual o A/B/C.
5. Ver resultados accionables con score, confianza, benchmark y evidencia.
6. Obtener recomendaciones por timecode.
7. Generar un PDF ejecutivo/creativo.
8. Ver consumo estimado y trazabilidad basica.
9. Borrar assets e informes de forma controlada.

## No entra en v1.0

- SSO/SAML completo.
- Stripe y billing automatico.
- API publica estable.
- Integraciones con DAM, Frame.io, Drive o Adobe.
- Benchmarks multi-cliente reales.
- White-label avanzado.
- Procesamiento de biometria o datos de audiencia real.

## Principios no negociables

- Decision antes que dato.
- Confianza calibrada.
- Instrumento, no oraculo.
- Timecode primero.
- Imprimible siempre.

## Gates para pasar a Sprint 1

- Arquitectura v0.1 aprobada.
- Stack base elegido.
- Carpeta de diseno copiada al repositorio.
- Claims prohibidos definidos.
- Limites de activos y coste inicial definidos.
- Riesgo legal/cientifico documentado.
- Ruflo operativo para coordinacion multiagente.

## Decisiones abiertas

- Proveedor GPU definitivo: RunPod Serverless, Modal o Hugging Face GPU privado.
- Proveedor de almacenamiento definitivo: Cloudflare R2 o S3.
- Proveedor auth/DB definitivo: Supabase recomendado, pendiente de confirmacion de cuenta/proyecto.
- Estrategia contractual de pilotos: investigacion/consultoria controlada hasta resolver permisos comerciales del modelo.

