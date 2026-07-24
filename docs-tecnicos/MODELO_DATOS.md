# Modelo de datos

Base de datos: **Firestore** (NoSQL, colecciones planas con referencias).

## `hornos/{horno_id}`

Catálogo del horno, capturado al momento del trámite.

| Campo | Tipo | Notas |
|---|---|---|
| nombre_referencia | string | Ej. "Horno Familia Ramírez" |
| propietario_nombre | string | |
| propietario_contacto | string | Teléfono |
| ubicacion | geopoint | Para búsqueda por cercanía |
| direccion | string | |
| tipo_horno | string | fijo / móvil / colmena / otro |
| combustible_habitual | string | leña, aserrín, llanta, gas, otro |
| estado | string | activo / inactivo / clausurado |
| fecha_registro | timestamp | |

## `permisos/{permiso_id}`

Registro central. Se crea al tramitar; de aquí se deriva toda verificación posterior.

| Campo | Tipo | Notas |
|---|---|---|
| horno_id | reference → hornos | |
| folio | string | Único, visible al ladrillero |
| fecha_solicitud | timestamp | |
| fecha_autorizacion | timestamp | |
| fecha_vigencia_inicio | timestamp | |
| fecha_vigencia_fin | timestamp | |
| dias_autorizados | array\<string\> | ["lunes","miércoles"] |
| horario_autorizado | map | { inicio: "06:00", fin: "10:00" } |
| combustible_autorizado | string | |
| estado | string | vigente / vencido / suspendido / revocado |
| autorizado_por | string | Funcionario |
| documento_url | string | PDF escaneado (Firebase Storage) |

`estado` se recalcula en el cliente/Cloud Function comparando
`fecha_vigencia_fin` con la fecha actual — no depende de que alguien lo
actualice a mano.

## `reportes_quema/{reporte_id}`

Un registro por cada aviso de quema recibido. El núcleo del seguimiento.

| Campo | Tipo | Notas |
|---|---|---|
| fecha_hora_reporte | timestamp | |
| origen_reporte | string | ciudadano / patrulla / airepuro / anónimo |
| ubicacion_reportada | geopoint | Puede ser aproximada |
| direccion_reportada | string | |
| descripcion | string | |
| horno_id_identificado | reference → hornos, nullable | |
| resultado_verificacion | string | con_permiso_vigente / sin_permiso / fuera_de_horario / no_identificado |
| permiso_id_relacionado | reference → permisos, nullable | |
| atendido_por | string | |
| seguimiento | string | Acción tomada |

### Lógica de verificación

1. Buscar `hornos` cercanos a `ubicacion_reportada` (o por nombre/dirección).
2. Si se identifica el horno, buscar en `permisos` uno con
   `estado = vigente` cuya vigencia cubra la fecha del reporte.
3. Verificar que el día y horario del reporte coincidan con
   `dias_autorizados` / `horario_autorizado`.
4. Guardar `resultado_verificacion` con el resultado.

## `alertas/{alerta_id}`

Generadas automáticamente, no capturadas a mano.

| Campo | Tipo | Notas |
|---|---|---|
| horno_id | reference → hornos | |
| tipo | string | permiso_por_vencer / reincidencia |
| fecha_generada | timestamp | |
| severidad | string | baja / media / alta |
| atendida | boolean | |
| atendida_por | string | |

## `usuarios_sistema/{uid}`

Control de acceso al dashboard. `{uid}` corresponde al UID de Firebase Auth.

| Campo | Tipo | Notas |
|---|---|---|
| nombre | string | |
| rol | string | admin / inspector / consulta |
| activo | boolean | |

## Índices compuestos necesarios

- `permisos`: `horno_id` ASC + `estado` ASC + `fecha_vigencia_fin` DESC
- `reportes_quema`: `resultado_verificacion` ASC + `fecha_hora_reporte` DESC

(Ya declarados en `firestore.indexes.json`.)
