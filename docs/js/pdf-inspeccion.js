import { formatFechaHora } from "./utils.js?v=18";

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

/**
 * Abre una ventana imprimible del reporte de inspección (el inspector
 * puede guardar como PDF desde el diálogo de impresión del navegador).
 */
export function generarPdfInspeccion(reporte, horno) {
  const lat = reporte.ubicacion_reportada?.latitude;
  const lng = reporte.ubicacion_reportada?.longitude;
  const fotos = Array.isArray(reporte.fotos) ? reporte.fotos : [];
  const resultado = ETIQUETA_RESULTADO[reporte.resultado_verificacion] || reporte.resultado_verificacion || "—";
  const coords =
    lat != null && lng != null ? `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}` : "—";

  const fotosHtml = fotos.length
    ? `<div class="fotos">${fotos
        .map(
          (f, i) => `
      <figure>
        <img src="${esc(f.url)}" alt="Evidencia ${i + 1}">
        <figcaption>Fotografía ${i + 1}${f.nombre ? ` — ${esc(f.nombre)}` : ""}</figcaption>
      </figure>`
        )
        .join("")}</div>`
    : `<p class="muted">Sin fotografías adjuntas.</p>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte de inspección — ${esc(reporte.id?.slice(0, 8) || "IMBIO")}</title>
  <style>
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #12263a; margin: 28px; font-size: 13px; }
    h1 { font-size: 18px; margin: 0 0 4px; color: #003B7A; }
    .sub { color: #5a6b7d; margin-bottom: 18px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-bottom: 16px; }
    .item label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #5a6b7d; }
    .item strong { font-size: 13px; font-weight: 600; }
    .box { border: 1px solid #d5dde6; border-radius: 8px; padding: 12px; margin-bottom: 14px; }
    .box h2 { font-size: 12px; margin: 0 0 8px; color: #003B7A; text-transform: uppercase; letter-spacing: .04em; }
    .fotos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    figure { margin: 0; }
    img { width: 100%; max-height: 280px; object-fit: cover; border: 1px solid #d5dde6; border-radius: 6px; }
    figcaption { font-size: 11px; color: #5a6b7d; margin-top: 4px; }
    .muted { color: #5a6b7d; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #eef3f8; font-weight: 600; }
    .actions { margin-top: 18px; }
    @media print {
      .actions { display: none; }
      body { margin: 12mm; }
    }
  </style>
</head>
<body>
  <h1>Reporte de inspección de ladrillera</h1>
  <p class="sub">IMBIO · Instituto Municipal de Biodiversidad y Protección Ambiental<br>
  H. Ayuntamiento de Pabellón de Arteaga, Aguascalientes</p>

  <div class="grid">
    <div class="item"><label>Fecha y hora</label><strong>${esc(formatFechaHora(reporte.fecha_hora_reporte))}</strong></div>
    <div class="item"><label>Origen</label><strong>${esc(reporte.origen_reporte || "—")}</strong></div>
    <div class="item"><label>Núcleo / localidad</label><strong>${esc(reporte.nucleo_localidad || "—")}</strong></div>
    <div class="item"><label>Dirección</label><strong>${esc(reporte.direccion_reportada || "—")}</strong></div>
    <div class="item"><label>Coordenadas</label><strong>${esc(coords)}</strong></div>
    <div class="item"><label>Atendido por</label><strong>${esc(reporte.atendido_por || "—")}</strong></div>
    <div class="item"><label>Horno identificado</label><strong>${esc(horno?.nombre_referencia || "No identificado")}</strong></div>
    <div class="item"><label>Resultado de verificación</label><strong><span class="pill">${esc(resultado)}</span></strong></div>
  </div>

  <div class="box">
    <h2>Descripción de la inspección</h2>
    <p>${esc(reporte.descripcion || "Sin descripción.").replace(/\n/g, "<br>")}</p>
  </div>

  <div class="box">
    <h2>Hallazgos</h2>
    <p>${esc(reporte.hallazgos || "Sin hallazgos registrados.").replace(/\n/g, "<br>")}</p>
  </div>

  <div class="box">
    <h2>Seguimiento / acción tomada</h2>
    <p>${esc(reporte.seguimiento || "Sin seguimiento registrado.").replace(/\n/g, "<br>")}</p>
  </div>

  <div class="box">
    <h2>Evidencia fotográfica</h2>
    ${fotosHtml}
  </div>

  <div class="actions">
    <button onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>
  <script>window.addEventListener("load", () => setTimeout(() => window.print(), 400));</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    window.alert("Permite ventanas emergentes para generar el PDF.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
