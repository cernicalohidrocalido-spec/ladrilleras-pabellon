# ladrilleras-pabellon — Control de Quema de Hornos

Dashboard municipal para el registro de permisos de quema de hornos ladrilleros
y la verificación rápida de su vigencia ante reportes de quema.

Desarrollado para el **Instituto Municipal de Biodiversidad y Protección
Ambiental (IMBIO)**, H. Ayuntamiento de Pabellón de Arteaga.

## Qué resuelve

Hoy el ladrillero tramita su permiso, pero no hay forma rápida de saber:
- quién tiene permiso vigente ahora mismo
- si un reporte de quema (llamada, patrulla ecológica, alerta de calidad
  del aire) corresponde a un horno con permiso o no

Este sistema captura los datos **al momento del trámite** y ofrece un
dashboard para **buscar y verificar** cuando llega un reporte, sin
necesidad de una app para el ladrillero.

## Estructura del proyecto

```
control-quema-hornos/
├── firestore.rules          # Reglas de seguridad de Firestore
├── firestore.indexes.json   # Índices compuestos necesarios
├── firebase.json            # Configuración de Firebase Hosting
├── docs/
│   └── MODELO_DATOS.md      # Modelo de datos completo documentado
└── public/                  # Dashboard (sitio estático, sin build step)
    ├── index.html
    ├── css/styles.css
    └── js/
        ├── config.js         # Config de Firebase (rellenar con tus claves)
        ├── db.js             # Helpers de acceso a Firestore
        ├── hornos.js         # Alta y listado de hornos
        ├── permisos.js       # Alta y listado de permisos
        ├── reportes.js       # Registro y verificación de reportes de quema
        ├── mapa.js           # Mapa en vivo (Leaflet)
        ├── utils.js          # Utilidades compartidas
        └── app.js            # Navegación entre secciones
```

## Stack

- **Firebase / Firestore** — base de datos y hosting (mismo stack que AirePuro)
- **HTML/CSS/JS vanilla** — sin build step, fácil de mantener y desplegar
- **Leaflet** + OpenStreetMap — mapa en vivo de hornos
- Tipografías: **Rubik** (UI, consistente con la identidad de IMBIO) y
  **Space Grotesk** (títulos/KPIs), **JetBrains Mono** (folios y datos)

## Puesta en marcha

1. Crea un proyecto de Firebase (o usa uno existente) y habilita **Firestore**.
2. Copia tu configuración web de Firebase en `public/js/config.js`.
3. Despliega las reglas:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```
4. Sirve `public/` localmente para probar:
   ```bash
   npx serve public
   ```
5. Despliega a Firebase Hosting (o GitHub Pages, cambiando solo las rutas
   relativas si migras):
   ```bash
   firebase deploy --only hosting
   ```

## Roles

Definidos en la colección `usuarios_sistema` y validados en
`firestore.rules`:

- **admin** — alta/baja de usuarios, todo lo demás
- **inspector** — registra hornos, permisos y reportes de quema
- **consulta** — solo lectura (para Ecología municipal, Cabildo, etc.)

## Próximos pasos sugeridos

- [ ] Conectar alertas de AirePuro como origen automático de `reportes_quema`
- [ ] Exportables PDF/Excel de cumplimiento por periodo
- [ ] Historial de sanciones ligado a `reportes_quema`
