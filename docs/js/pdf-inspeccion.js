import {
  formatFechaHora,
  OPCIONES_HALLAZGOS,
  OPCIONES_SANCION,
  SANCION_MULTA_TEXTO,
  SANCION_MULTA_MIN,
  SANCION_MULTA_MAX,
  UMA_DIARIA_MXN,
  UMA_VIGENCIA,
  calcularMultaPesos,
  formatPesosMXN,
  numeroALetrasPesos,
  SANCION_PLAZO_PAGO,
} from "./utils.js?v=28";

const ETIQUETA_RESULTADO = {
  con_permiso_vigente: "Con permiso vigente",
  sin_permiso: "Sin permiso",
  fuera_de_horario: "Fuera de horario",
  no_identificado: "Horno no identificado",
};

const ETIQUETA_ID = {
  credencial_elector: "Credencial de elector",
  manifestacion: "Lo que manifiesta",
  otro: "Otra identificación",
};

const DIRECTOR_IMBIO = "Biól. Luis Felipe Lozano Román";
const DIRECTOR_CARGO = "Director del Instituto Municipal de Biodiversidad y Protección Ambiental (IMBIO)";

const SUSTENTO_LEGAL_SANCION = [
  "Ley de Ingresos del Municipio de Pabellón de Arteaga, Aguascalientes, para el ejercicio fiscal 2026, en lo relativo a las infracciones ambientales tipificadas en los incisos c) y f) y a la multa de 100 a 1,000 UMA.",
  "Atribuciones del Instituto Municipal de Biodiversidad y Protección Ambiental (IMBIO) para inspeccionar, verificar y sancionar conductas que afecten el medio ambiente en el municipio de Pabellón de Arteaga.",
  "Valor diario de la UMA vigente al momento de cometer la infracción (INEGI), aplicado para determinar el monto en pesos de la multa.",
];

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

/** Cadena de seguridad determinística (verificación documental). */
function cadenaSeguridad(partes) {
  const base = partes.map((p) => String(p ?? "").trim().toUpperCase()).join("|");
  let h = 2166136261;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = (h >>> 0).toString(16).toUpperCase().padStart(8, "0");
  let h2 = 5381;
  for (let i = 0; i < base.length; i++) {
    h2 = ((h2 << 5) + h2) ^ base.charCodeAt(i);
  }
  const hex2 = (h2 >>> 0).toString(16).toUpperCase().padStart(8, "0");
  return `IMBIO-${hex}-${hex2}`;
}

function estilosComunes() {
  return `
    @page { margin: 12mm 11mm; }
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #12263a; margin: 0; font-size: 12.5px; }
    .membrete {
      display: flex; align-items: center; gap: 12px;
      border-bottom: 3px solid #002A5C; padding-bottom: 10px; margin-bottom: 12px;
    }
    .membrete img {
      width: 96px; height: auto; background: #fff;
      border: 1px solid #d5dde6; border-radius: 8px; padding: 3px;
    }
    .membrete-texto { flex: 1; }
    .membrete-texto .dep {
      font-size: 10px; text-transform: uppercase; letter-spacing: .06em;
      color: #5a6b7d; margin: 0 0 2px;
    }
    .membrete-texto h1 {
      font-size: 15px; margin: 0 0 2px; color: #002A5C; line-height: 1.2;
    }
    .membrete-texto .muni { font-size: 11px; color: #334155; margin: 0; }
    .folio-box { text-align: right; min-width: 130px; }
    .folio-box .lbl { font-size: 9px; color: #5a6b7d; text-transform: uppercase; }
    .folio-box .folio {
      font-family: ui-monospace, Consolas, monospace;
      font-size: 13px; font-weight: 700; color: #002A5C;
      background: #eef3f8; border: 1px solid #c8d6e5; border-radius: 6px;
      padding: 5px 8px; margin-top: 3px; display: inline-block;
    }
    .titulo-doc {
      text-align: center; font-size: 13.5px; font-weight: 700;
      color: #002A5C; margin: 0 0 10px; text-transform: uppercase;
      letter-spacing: .04em;
    }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin-bottom: 10px; }
    .item label { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; color: #5a6b7d; }
    .item strong { font-size: 12.5px; font-weight: 600; }
    .box { border: 1px solid #d5dde6; border-radius: 7px; padding: 9px 11px; margin-bottom: 9px; }
    .box h2 { font-size: 11px; margin: 0 0 6px; color: #002A5C; text-transform: uppercase; letter-spacing: .04em; }
    .box p, .box ul { margin: 0; }
    .box ul { padding-left: 18px; }
    .fotos {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
      page-break-inside: avoid;
    }
    .fotos.tres { grid-template-columns: 1fr 1fr 1fr; }
    figure { margin: 0; break-inside: avoid; }
    img.evidencia {
      width: 100%; max-height: 150px; object-fit: cover;
      border: 1px solid #d5dde6; border-radius: 5px; background: #f8fafc;
    }
    figcaption { font-size: 10px; color: #5a6b7d; margin-top: 3px; }
    .muted { color: #5a6b7d; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #eef3f8; font-weight: 600; }
    .multa-box {
      background: #f4f7fb; border: 1px solid #c8d6e5; border-radius: 7px;
      padding: 10px 12px; margin-top: 8px;
    }
    .multa-box .monto { font-size: 15px; font-weight: 700; color: #002A5C; }
    .multa-box .letra { font-size: 12px; margin-top: 4px; }
    .multa-box .plazo { font-size: 11.5px; margin-top: 8px; font-weight: 600; }
    .firmas {
      display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
      margin: 16px 0 10px; page-break-inside: avoid;
    }
    .firmas.una { grid-template-columns: 1fr; max-width: 420px; margin-left: auto; margin-right: auto; }
    @media (max-width: 700px) {
      .firmas { grid-template-columns: 1fr; }
    }
    .firma-box {
      border: 1px solid #c8d6e5; border-radius: 8px; padding: 12px 14px 10px;
      background: #fbfdff; min-height: 110px;
    }
    .firma-box h3 {
      margin: 0 0 8px; font-size: 11px; text-transform: uppercase;
      letter-spacing: .04em; color: #002A5C;
    }
    .firma-linea {
      margin: 48px auto 6px; width: 78%;
      border-bottom: 1.5px solid #334155;
    }
    .firma-nombre {
      text-align: center; font-weight: 700; font-size: 12.5px; color: #12263a;
    }
    .firma-cargo {
      text-align: center; font-size: 11px; color: #5a6b7d; margin-top: 2px;
    }
    .cadena {
      margin-top: 10px; padding: 8px 10px;
      border: 1px dashed #8aa0b8; border-radius: 6px;
      background: #f7fafc; font-size: 10.5px;
    }
    .cadena strong {
      font-family: ui-monospace, Consolas, monospace;
      letter-spacing: .04em; color: #002A5C;
    }
    .cadena .hint { color: #5a6b7d; margin-top: 3px; font-size: 9.5px; }
    .pie {
      margin-top: 14px; padding-top: 8px; border-top: 1px solid #d5dde6;
      font-size: 9.5px; color: #5a6b7d; text-align: center;
    }
    .actions { margin-top: 14px; text-align: center; }
    .actions button {
      background: #002A5C; color: #fff; border: none; border-radius: 8px;
      padding: 10px 18px; font-size: 14px; cursor: pointer;
    }
    @media print {
      .actions { display: none; }
      .box, .fotos, .membrete, .firmas, .cadena { break-inside: avoid; }
    }
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

function bloqueResponsablePdf(reporte) {
  const nombre = (reporte.responsable_nombre || "").trim();
  const domicilio = (reporte.responsable_domicilio || "").trim();
  const tipo = reporte.responsable_id_tipo || "";
  const folioId = (reporte.responsable_id_folio || "").trim();
  const manif = (reporte.responsable_manifestacion || "").trim();
  if (!nombre && !domicilio && !folioId && !manif) {
    return `
  <div class="box">
    <h2>Responsable de la ladrillera</h2>
    <p class="muted">Sin datos del responsable registrados.</p>
  </div>`;
  }
  const tipoTxt = ETIQUETA_ID[tipo] || tipo || "—";
  return `
  <div class="box">
    <h2>Responsable de la ladrillera</h2>
    <div class="grid" style="margin-bottom:0">
      <div class="item"><label>Nombre</label><strong>${esc(nombre || "—")}</strong></div>
      <div class="item"><label>Identificación</label><strong>${esc(tipoTxt)}</strong></div>
      <div class="item" style="grid-column:1 / -1"><label>Domicilio particular</label><strong>${esc(domicilio || "—")}</strong></div>
      <div class="item"><label>Folio / número de ID</label><strong>${esc(folioId || "—")}</strong></div>
      ${
        manif
          ? `<div class="item" style="grid-column:1 / -1"><label>Manifestación</label><strong>${esc(manif)}</strong></div>`
          : ""
      }
    </div>
  </div>`;
}

function fotosCompactasHtml(fotos) {
  if (!fotos.length) return `<p class="muted">Sin fotografías adjuntas.</p>`;
  const clase = fotos.length >= 3 ? "fotos tres" : "fotos";
  return `<div class="${clase}">${fotos
    .map(
      (f, i) => `<figure>
      <img class="evidencia" src="${esc(f.url)}" alt="Evidencia ${i + 1}">
      <figcaption>Fotografía ${i + 1}${f.nombre ? ` — ${esc(f.nombre)}` : ""}</figcaption>
    </figure>`
    )
    .join("")}</div>`;
}

function firmaBoxHtml({ titulo, nombre, cargo }) {
  return `
  <div class="firma-box">
    <h3>${esc(titulo)}</h3>
    <div class="firma-linea"></div>
    <div class="firma-nombre">${esc(nombre || "—")}</div>
    ${cargo ? `<div class="firma-cargo">${esc(cargo)}</div>` : ""}
  </div>`;
}

function cadenaSeguridadHtml(cadena, folio) {
  return `
  <div class="cadena">
    <div>Cadena de seguridad: <strong>${esc(cadena)}</strong></div>
    <div class="hint">Código de integridad del documento · Folio ${esc(folio)} · IMBIO Pabellón de Arteaga. Cualquier alteración invalida esta cadena.</div>
  </div>`;
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

/** Acta / reporte de inspección (sin sanciones). */
export function generarPdfInspeccion(reporte, horno) {
  const { fotos, resultado, coords, folio, logo } = datosBase(reporte);
  const inspector = (reporte.atendido_por || "").trim() || "Inspector IMBIO";
  const fechaTxt = formatFechaHora(reporte.fecha_hora_reporte);

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
    ? `<p style="margin-top:8px"><strong>Observaciones adicionales:</strong><br>${esc(obs).replace(/\n/g, "<br>")}</p>`
    : "";

  const cadena = cadenaSeguridad([
    "INSP",
    folio,
    fechaTxt,
    inspector,
    reporte.responsable_nombre,
    reporte.nucleo_localidad,
    reporte.direccion_reportada,
    coords,
    resultado,
    (ids || []).join(","),
  ]);

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
    <div class="item"><label>Fecha y hora</label><strong>${esc(fechaTxt)}</strong></div>
    <div class="item"><label>Origen</label><strong>${esc(reporte.origen_reporte || "—")}</strong></div>
    <div class="item"><label>Núcleo / localidad</label><strong>${esc(reporte.nucleo_localidad || "—")}</strong></div>
    <div class="item"><label>Dirección del predio</label><strong>${esc(reporte.direccion_reportada || "—")}</strong></div>
    <div class="item"><label>Coordenadas</label><strong>${esc(coords)}</strong></div>
    <div class="item"><label>Inspector</label><strong>${esc(inspector)}</strong></div>
    <div class="item"><label>Horno identificado</label><strong>${esc(horno?.nombre_referencia || "No identificado")}</strong></div>
    <div class="item"><label>Resultado de verificación</label><strong><span class="pill">${esc(resultado)}</span></strong></div>
  </div>

  ${bloqueResponsablePdf(reporte)}

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
    <h2>Evidencia fotográfica</h2>
    ${fotosCompactasHtml(fotos)}
  </div>

  <section class="firmas">
    ${firmaBoxHtml({
      titulo: "Firma del inspector",
      nombre: inspector,
      cargo: "Inspector ambiental · IMBIO Pabellón de Arteaga",
    })}
    ${firmaBoxHtml({
      titulo: "Firma del responsable de la ladrillera",
      nombre: (reporte.responsable_nombre || "").trim() || "Nombre del responsable",
      cargo: "Enterado(a) de los hechos consignados en esta acta",
    })}
  </section>

  ${cadenaSeguridadHtml(cadena, folio)}

  <p class="pie">
    Acta de inspección — Control de Quema · IMBIO Pabellón de Arteaga.<br>
    Folio ${esc(folio)} · Generado ${esc(formatFechaHora(new Date()))}<br>
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
  const inspector = (reporte.atendido_por || "").trim() || "—";
  const fechaTxt = formatFechaHora(reporte.fecha_hora_reporte);

  const ids = (reporte.sancion_infracciones || []).filter((id) =>
    OPCIONES_SANCION.some((o) => o.id === id)
  );
  const mapa = Object.fromEntries(OPCIONES_SANCION.map((o) => [o.id, o.label]));
  const lista =
    ids.length > 0
      ? `<ul>${ids.map((id) => `<li>${esc(mapa[id] || id)}</li>`).join("")}</ul>`
      : `<p class="muted">No se marcaron infracciones c) ni f). Complete la sección de sanción en el formulario.</p>`;

  const umas = Number(reporte.sancion_umas);
  const valorUma = Number(reporte.sancion_uma_valor) || UMA_DIARIA_MXN;
  const pesos =
    Number(reporte.sancion_pesos) > 0
      ? Number(reporte.sancion_pesos)
      : calcularMultaPesos(umas, valorUma);
  const letra =
    (reporte.sancion_pesos_letra || "").trim() ||
    (pesos > 0 ? numeroALetrasPesos(pesos) : "");

  const umasTxt =
    Number.isFinite(umas) && umas > 0
      ? `${umas} UMA`
      : `Por determinar (${SANCION_MULTA_MIN} a ${SANCION_MULTA_MAX} UMA)`;

  const multaDetalle =
    pesos > 0
      ? `<div class="multa-box">
      <div><strong>Multa:</strong> ${esc(umasTxt)} × ${esc(formatPesosMXN(valorUma))} (UMA vigente desde ${esc(UMA_VIGENCIA)})</div>
      <div class="monto">${esc(formatPesosMXN(pesos))}</div>
      <div class="letra">(${esc(letra)})</div>
      <div class="plazo">${esc(SANCION_PLAZO_PAGO)}</div>
    </div>`
      : `<p style="margin-top:10px"><strong>Multa determinada / propuesta:</strong> ${esc(umasTxt)}</p>
         <p class="muted" style="margin-top:6px">${esc(SANCION_PLAZO_PAGO)}</p>`;

  const sustentoHtml = `<ol style="margin:0;padding-left:18px">${SUSTENTO_LEGAL_SANCION.map(
    (s) => `<li style="margin-bottom:4px">${esc(s)}</li>`
  ).join("")}</ol>
  <p style="margin-top:8px">${esc(SANCION_MULTA_TEXTO)}</p>
  <p class="muted" style="font-size:10.5px;margin-top:6px;margin-bottom:0">
    Fuente: https://imbio.info/normativa-vigente/lectura.html?doc=ley-ingresos-2026
  </p>`;

  const cadena = cadenaSeguridad([
    "SANC",
    folioSancion,
    folio,
    fechaTxt,
    inspector,
    DIRECTOR_IMBIO,
    (ids || []).join(","),
    umasTxt,
    pesos,
    reporte.responsable_nombre,
  ]);

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
    Fecha de los hechos: <strong>${esc(fechaTxt)}</strong><br>
    Horno / propietario: <strong>${esc(horno?.nombre_referencia || horno?.propietario_nombre || "No identificado")}</strong><br>
    Núcleo / localidad: <strong>${esc(reporte.nucleo_localidad || "—")}</strong><br>
    Dirección del predio: <strong>${esc(reporte.direccion_reportada || "—")}</strong><br>
    Coordenadas: <strong>${esc(coords)}</strong><br>
    Inspector: <strong>${esc(inspector)}</strong></p>
  </div>

  ${bloqueResponsablePdf(reporte)}

  <div class="box">
    <h2>Sustento legal</h2>
    ${sustentoHtml}
  </div>

  <div class="box">
    <h2>Infracciones imputadas y multa</h2>
    ${lista}
    ${multaDetalle}
    ${
      reporte.sancion_observaciones
        ? `<p style="margin-top:8px"><strong>Observaciones de la sanción:</strong><br>${esc(reporte.sancion_observaciones).replace(/\n/g, "<br>")}</p>`
        : ""
    }
  </div>

  <div class="box">
    <h2>Hechos relacionados</h2>
    <p>${esc(reporte.descripcion || "Remítase al acta de inspección correspondiente.").replace(/\n/g, "<br>")}</p>
  </div>

  <div class="box">
    <h2>Evidencia fotográfica</h2>
    ${fotosCompactasHtml(fotos)}
  </div>

  <section class="firmas">
    ${firmaBoxHtml({
      titulo: "Firma del Director del IMBIO",
      nombre: DIRECTOR_IMBIO,
      cargo: DIRECTOR_CARGO,
    })}
  </section>

  ${cadenaSeguridadHtml(cadena, folioSancion)}

  <p class="pie">
    Acta de sanción — Control de Quema · IMBIO Pabellón de Arteaga.<br>
    Folio sanción ${esc(folioSancion)} · Inspección relacionada ${esc(folio)} · Generado ${esc(formatFechaHora(new Date()))}<br>
    Documento distinto e independiente del acta de inspección.
  </p>

  <div class="actions"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>
  <script>window.addEventListener("load", () => setTimeout(() => window.print(), 600));</script>
</body>
</html>`;

  abrirVentanaPdf(html);
}
