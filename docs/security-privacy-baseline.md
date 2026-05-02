# Seguridad y privacidad baseline

## Boundary v1

El producto procesa contenido creativo. No procesa respuestas de personas reales.

Permitido:

- Video, audio, guion, subtitulos y textos de campana.
- Assets de evento o comunicacion interna si el cliente declara derechos.
- Metadatos tecnicos del archivo.

No permitido en v1:

- Webcam de audiencia.
- EEG, eye tracking, fMRI real o biometria.
- Reconocimiento emocional individual.
- Analisis de empleados/estudiantes como sujetos.
- Datos clinicos o diagnosticos.

## Controles minimos

- Hosting UE para pilotos europeos.
- Cifrado en transito.
- Cifrado en reposo.
- RLS por organizacion.
- Roles owner/admin/analyst/viewer.
- URLs firmadas con expiracion.
- Audit log.
- Retencion configurable.
- Borrado de originales, derivados e informes.
- Lista de subprocessors.
- DPA preparado para pilotos.

## DPIA trigger

Activar revision DPIA si:

- Los assets contienen menores.
- Los assets contienen pacientes, salud sensible o contexto medico.
- Se procesan empleados de forma sistematica.
- Se incorpora cualquier dato de audiencia real.
- Se incorporan sensores, biometria o inferencia emocional individual.
- El cliente pide benchmark pooled entre empresas.

## Derechos sobre assets

Los terminos de cliente deben exigir que el cliente tenga derechos suficientes sobre:

- Imagen.
- Voz.
- Musica.
- Guiones.
- Actores/talent.
- Stock footage.
- Marcas.
- Material de agencias o terceros.

## No training by default

Por defecto, los assets de cliente no se usan para entrenar modelos ni benchmarks compartidos. Cualquier uso de aprendizaje o benchmark agregado requiere opt-in explicito.

