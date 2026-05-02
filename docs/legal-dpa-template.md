# DPA template · PraevIA NeuroImpact Analyzer

> Plantilla base para revision legal. No es asesoramiento juridico.

## 1. Partes

Cliente: responsable del tratamiento.

PraevIA: encargado del tratamiento cuando procese assets, metadatos, informes, usuarios y datos operativos por cuenta del cliente.

## 2. Objeto

Prestacion de un servicio de pretest neurocognitivo in silico para analizar piezas creativas de video, audio o texto y generar resultados, recomendaciones e informes.

## 3. Categorias de datos

Datos tratados:

- assets creativos: video, audio, texto, subtitulos.
- metadatos tecnicos: formato, duracion, resolucion, FPS, idioma probable, hash, tamano.
- datos de usuario: nombre, email corporativo, rol, organizacion.
- resultados: scores, timeline, recomendaciones, informes, comparativas y benchmarks.
- datos operativos: logs, usage events, costes, auditoria y solicitudes de borrado.

Datos excluidos en v1:

- biometria de audiencia.
- grabaciones de personas evaluadas.
- webcam, EEG, eye tracking o fMRI real de clientes.
- datos personales sensibles no necesarios para el analisis creativo.

## 4. Instrucciones del cliente

PraevIA procesara datos solo para:

- validar formatos y crear derivados tecnicos.
- ejecutar analisis configurados por el cliente.
- generar dashboard, comparativas, informes y export de uso.
- prestar soporte, seguridad y auditoria.

No se usaran assets de cliente para entrenar modelos sin autorizacion expresa y separada.

## 5. Subprocesadores

Lista inicial por entorno:

- hosting frontend.
- hosting backend.
- base de datos/Auth.
- storage S3/R2.
- proveedor GPU.
- proveedor LLM.
- observabilidad.
- email transaccional si aplica.

Cada piloto debe anexar proveedor, region, finalidad y medidas basicas.

## 6. Seguridad

Controles minimos:

- organizaciones aisladas.
- roles y permisos.
- URLs firmadas.
- storage separado por entorno.
- secretos fuera del frontend.
- logs de auditoria.
- rate limiting.
- backups.
- borrado seguro.
- HTTPS.

## 7. Incidentes

PraevIA notificara incidentes relevantes al cliente segun SLA contractual y colaborara con investigacion, contencion y medidas correctivas.

## 8. Retencion y borrado

La retencion se configura por organizacion. Al terminar el piloto, el cliente puede solicitar borrado de assets originales, derivados e informes, salvo registros minimos de auditoria contractual cuando aplique.

## 9. Transferencias

Preferencia operativa: region UE. Si un proveedor implica transferencia internacional, debe quedar documentado en el anexo de subprocesadores.

## 10. Auditoria

PraevIA entregara evidencias razonables de controles, logs de borrado y configuracion de retencion a peticion del cliente durante el piloto.
