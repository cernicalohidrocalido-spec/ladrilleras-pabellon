import {
  formatFechaHora,
  OPCIONES_HALLAZGOS,
  OPCIONES_SANCION,
  SANCION_MULTA_TEXTO,
  SANCION_MULTA_MIN,
  SANCION_MULTA_MAX,
} from "./utils.js?v=24";

const ETIQUETA_RESULTADO = {
  con_permiso_vigente: "Con permiso vigente",
  sin_permiso: "Sin permiso",
  fuera_de_horario: "Fuera de horario",
  no_identificado: "Horno no identificado",
};

function esc(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function urlLogoInstitucional() {
  try {
    return new URL("assets/logo-imbio.jpg", document.baseURI || window.location.href).href;
  } catch {
    return "assets/logo-imbio.jpg";
  }
}

function estilosComunes() {
  return `
    @page { margin: 14mm 12mm; }
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #12263a; margin: 0; font-size: 13px; }
    .membrete {
      display: flex; align-items: center; gap: 16px;
      border-bottom: 3px solid #002A5C; padding-bottom: 14px; margin-bottom: 16px;
    }
    .membrete img {
      width: 120px; height: auto; background: #fff;
      border: 1px solid #d5dde6; border-radius: 8px; padding: 4px;
    }
    .membrete-texto { flex: 1; }
    .membrete-texto .dep {
      font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
      color: #5a6b7d; margin: 0 0 4px;
    }
    .membrete-texto h1 {
      font-size: 17px; margin: 0 0 4px; color: #002A5C; line-height: 1.25;
    }
    .membrete-texto .muni { font-size: 12px; color: #334155; margin: 0; }
    .folio-box { text-align: right; min-width: 140px; }
    .folio-box .lbl { font-size: 10px; color: #5a6b7d; text-transform: uppercase; }
    .folio-box .folio {
      font-family: ui-monospace, Consolas, monospace;
      font-size: 15px; font-weight: 700; color: #002A5C;
      background: #eef3f8; border: 1px solid #c8d6e5; border-radius: 6px;
      padding: 6px 10px; margin-top: 4px; display: inline-block;
    }
    .titulo-doc {
      text-align: center; font-size: 15px; font-weight: 700;
      color: #002A5C; margin: 0 0 14px; text-transform: uppercase;
      letter-spacing: .04em;
    }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-bottom: 16px; }
    .item label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #5a6b7d; }
    .item strong { font-size: 13px; font-weight: 600; }
    .box { border: 1px solid #d5dde6; border-radius: 8px; padding: 12px; margin-bottom: 14px; }
    .box h2 { font-size: 12px; margin: 0 0 8px; color: #002A5C; text-transform: uppercase; letter-spacing: .04em; }
    .fotos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    figure { margin: 0; }
    img.evidencia { width: 100%; max-height: 280px; object-fit: cover; border: 1px solid #d5dde6; border-radius: 6px; }
    figcaption { font-size: 11px; color: #5a6b7d; margin-top: 4px; }
    .muted { color: #5a6b7d; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #eef3f8; font-weight: 600; }
    .anexo { page-break-before: always; }
    .anexo h2 {
      font-size: 14px; color: #002A5C; text-transform: uppercase;
      border-bottom: 2px solid #002A5C; padding-bottom: 6px; margin: 0 0 14px;
    }
    .anexo-fotos { display: grid; grid-template-columns: 1fr; gap: 18px; }
    .anexo-fotos figure { break-inside: avoid; }
    .anexo-fotos img {
      width: 100%; max-height: 420px; object-fit: contain;
      border: 1px solid #d5dde6; border-radius: 6px; background: #f8fafc;
    }
    .pie {
      margin-top: 22px; padding-top: 10px; border-top: 1px solid #d5dde6;
      font-size: 10px; color: #5a6b7d; text-align: center;
    }
    .actions { margin-top: 18px; text-align: center; }
    .actions button {
      background: #002A5C; color: #fff; border: none; border-radius: 8px;
      padding: 10px 18px; font-size: 14px; cursor: pointer;
    }
    @media print { .actions { display: none; } }
  `;
}

function membreteHtml(logo, folio, etiquetaFolio) {
  return `
  <header class="membrete">
    <img src="${esc(logo)}" alt="IMBIO">
    <div class="membrete-texto">
      <p class="dep">Instituto Municipal de Biodiversidad y Protección Ambiental</p>
      <h1>Control de Quema · Ladrilleras</h1>
      <p class="muni">H. Ayuntamiento de Pabellón de Arteaga, Aguascalientes</p>
    </div>
    <div class="folio-box">
      <div class="lbl">${esc(etiquetaFolio)}</div>
      <div class="folio">${esc(folio)}</div>
    </div>
  </header>`;
}

function abrirVentanaPdf(html) {
  const win = window.open("", "_blank");
  if (!win) {
    window.alert("Permite ventanas emergentes para generar el PDF.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function datosBase(reporte) {
  const lat = reporte.ubicacion_reportada?.latitude;
  const lng = reporte.ubicacion_reportada?.longitude;
  return {
    fotos: Array.isArray(reporte.fotos) ? reporte.fotos : [],
    resultado: ETIQUETA_RESULTADO[reporte.resultado_verificacion] || reporte.resultado_verificacion || "—",
    coords: lat != null && lng != null ? `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}` : "—",
    folio: reporte.folio || reporte.id?.slice(0, 8) || "SIN-FOLIO",
    logo: urlLogoInstitucional(),
  };
}

function anexoFotosHtml(fotos, folio, leyenda) {
  if (!fotos.length) return `<p class="muted">No se adjuntaron fotografías.</p>`;
  return `<div class="anexo-fotos">${fotos
    .map(
      (f, i) => `<figure>
      <img src="${esc(f.url)}" alt="Anexo ${i + 1}">
      <figcaption>Anexo ${i + 1}${f.nombre ? ` — ${esc(f.nombre)}` : ""} · ${esc(leyenda)}</figcaption>
    </figure>`
    )
    .join("")}</div>`;
}

/** Acta / reporte de inspección (sin sanciones). */
export function generarPdfInspeccion(reporte, horno) {
  const { fotos, resultado, coords, folio, logo } = datosBase(reporte);

  const ids = reporte.hallazgos_checklist || [];
  const mapa = Object.fromEntries(OPCIONES_HALLAZGOS.map((o) => [o.id, o.label]));
  const listaHallazgos = ids.length
    ? `<ul>${ids.map((id) => `<li>${esc(mapa[id] || id)}</li>`).join("")}</ul>`
    : `<p class="muted">Ningún hallazgo marcado.</p>`;
  const obs = (reporte.observaciones_adicionales || "").trim();
  const legado =
    !ids.length && !obs && reporte.hallazgos
      ? `<p>${esc(reporte.hallazgos).replace(/\n/g, "<br>")}</p>`
      : "";
  const obsHtml = obs
    ? `<p style="margin-top:10px"><strong>Observaciones adicionales:</strong><br>${esc(obs).replace(/\n/g, "<br>")}</p>`
    : "";

  const fotosResumen = fotos.length
    ? `<div class="fotos">${fotos
        .map(
          (f, i) => `<figure>
      <img class="evidencia" src="${esc(f.url)}" alt="Evidencia ${i + 1}">
      <figcaption>Fotografía ${i + 1}</figcaption>
    </figure>`
        )
        .join("")}</div>`
    : `<p class="muted">Sin fotografías adjuntas.</p>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Acta de inspección ${esc(folio)} — IMBIO</title>
  <style>${estilosComunes()}</style>
</head>
<body>
  ${membreteHtml(logo, folio, "Folio de inspección")}
  <p class="titulo-doc">Acta / reporte de inspección de ladrillera</p>

  <div class="grid">
    <div class="item"><label>Fecha y hora</label><strong>${esc(formatFechaHora(reporte.fecha_hora_reporte))}</strong></div>
    <div class="item"><label>Origen</label><strong>${esc(reporte.origen_reporte || "—")}</strong></div>
    <div class="item"><label>Núcleo / localidad</label><strong>${esc(reporte.nucleo_localidad || "—")}</strong></div>
    <div class="item"><label>Dirección</label><strong>${esc(reporte.direccion_reportada || "—")}</strong></div>
    <div class="item"><label>Coordenadas</label><strong>${esc(coords)}</strong></div>
    <div class="item"><label>Inspector</label><strong>${esc(reporte.atendido_por || "—")}</strong></div>
    <div class="item"><label>Horno identificado</label><strong>${esc(horno?.nombre_referencia || "No identificado")}</strong></div>
    <div class="item"><label>Resultado de verificación</label><strong><span class="pill">${esc(resultado)}</span></strong></div>
  </div>

  <div class="box">
    <h2>Descripción de la inspección</h2>
    <p>${esc(reporte.descripcion || "Sin descripción.").replace(/\n/g, "<br>")}</p>
  </div>

  <div class="box">
    <h2>Hallazgos</h2>
    ${listaHallazgos}${legado}${obsHtml}
  </div>

  <div class="box">
    <h2>Seguimiento / acción tomada</h2>
    <p>${esc(reporte.seguimiento || "Sin seguimiento registrado.").replace(/\n/g, "<br>")}</p>
  </div>

  <div class="box">
    <h2>Evidencia fotográfica (resumen)</h2>
    ${fotosResumen}
  </div>

  <section class="anexo">
    <h2>Anexo fotográfico — Inspección ${esc(folio)}</h2>
    ${anexoFotosHtml(fotos, folio, "Evidencia de inspección")}
  </section>

  <p class="pie">
    Acta de inspección — Control de Quema · IMBIO Pabellón de Arteaga.<br>
    Folio ${esc(folio)} · ${esc(formatFechaHora(new Date()))}<br>
    Este documento no constituye acta de sanción.
  </p>

  <div class="actions"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>
  <script>window.addEventListener("load", () => setTimeout(() => window.print(), 600));</script>
</body>
</html>`;

  abrirVentanaPdf(html);
}

/** Acta de sanción (documento distinto a la inspección). */
export function generarPdfSancion(reporte, horno) {
  const { fotos, coords, folio, logo } = datosBase(reporte);
  const folioSancion = reporte.folio_sancion || `SANC-${folio.replace(/^INSP-/, "")}`;

  const ids = (reporte.sancion_infracciones || []).filter((id) =>
    OPCIONES_SANCION.some((o) => o.id === id)
  );
  const mapa = Object.fromEntries(OPCIONES_SANCION.map((o) => [o.id, o.label]));
  const lista =
    ids.length > 0
      ? `<ul>${ids.map((id) => `<li>${esc(mapa[id] || id)}</li>`).join("")}</ul>`
      : `<p class="muted">No se marcaron infracciones c) ni f). Complete la sección de sanción en el formulario.</p>`;

  const umas = Number(reporte.sancion_umas);
  const umasTxt = Number.isFinite(umas) && umas > 0
    ? `${umas} UMA`
    : `Por determinar (${SANCION_MULTA_MIN} a ${SANCION_MULTA_MAX} UMA)`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Acta de sanción ${esc(folioSancion)} — IMBIO</title>
  <style>${estilosComunes()}</style>
</head>
<body>
  ${membreteHtml(logo, folioSancion, "Folio de sanción")}
  <p class="titulo-doc">Acta de sanción ambiental</p>

  <div class="box">
    <h2>Referencia a la inspección</h2>
    <p>Folio de inspección: <strong>${esc(folio)}</strong><br>
    Fecha de los hechos: <strong>${esc(formatFechaHora(reporte.fecha_hora_reporte))}</strong><br>
    Horno / propietario: <strong>${esc(horno?.nombre_referencia || horno?.propietario_nombre || "No identificado")}</strong><br>
    Núcleo / localidad: <strong>${esc(reporte.nucleo_localidad || "—")}</strong><br>
    Dirección: <strong>${esc(reporte.direccion_reportada || "—")}</strong><br>
    Coordenadas: <strong>${esc(coords)}</strong><br>
    Inspector: <strong>${esc(reporte.atendido_por || "—")}</strong></p>
  </div>

  <div class="box">
    <h2>Fundamento — Ley de Ingresos del Municipio (ejercicio 2026)</h2>
    <p>${esc(SANCION_MULTA_TEXTO)}</p>
    <p class="muted" style="font-size:11px;margin-bottom:0">
      Fuente: https://imbio.info/normativa-vigente/lectura.html?doc=ley-ingresos-2026
    </p>
  </div>

  <div class="box">
    <h2>Infracciones imputadas</h2>
    ${lista}
    <p style="margin-top:12px"><strong>Multa determinada / propuesta:</strong> ${esc(umasTxt)}</p>
    ${
      reporte.sancion_observaciones
        ? `<p><strong>Observaciones de la sanción:</strong><br>${esc(reporte.sancion_observaciones).replace(/\n/g, "<br>")}</p>`
        : ""
    }
  </div>

  <div class="box">
    <h2>Hechos relacionados</h2>
    <p>${esc(reporte.descripcion || "Remítase al acta de inspección correspondiente.").replace(/\n/g, "<br>")}</p>
  </div>

  <section class="anexo">
    <h2>Anexo fotográfico — Sanción ${esc(folioSancion)}</h2>
    ${anexoFotosHtml(fotos, folioSancion, "Evidencia de la sanción")}
  </section>

  <p class="pie">
    Acta de sanción — Control de Quema · IMBIO Pabellón de Arteaga.<br>
    Folio sanción ${esc(folioSancion)} · Inspección relacionada ${esc(folio)} · ${esc(formatFechaHora(new Date()))}<br>
    Documento distinto e independiente del acta de inspección.
  </p>

  <div class="actions"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>
  <script>window.addEventListener("load", () => setTimeout(() => window.print(), 600));</script>
</body>
</html>`;

  abrirVentanaPdf(html);
}
