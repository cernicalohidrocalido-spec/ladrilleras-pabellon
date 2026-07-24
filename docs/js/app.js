import { listarHornos, renderTablaHornos, abrirFormularioHorno } from "./hornos.js?v=5";
import { listarPermisos, renderTablaPermisos, abrirFormularioPermiso } from "./permisos.js?v=5";
import { listarReportes, renderTablaReportes, abrirFormularioReporte } from "./reportes.js?v=5";
import { pintarHornosEnMapa } from "./mapa.js?v=5";
import { calcularEstadoPermiso, pillHtml, formatFecha } from "./utils.js?v=5";
import { exportarHornos, exportarPermisos, exportarReportes } from "./exportar.js?v=5";

// --- Navegación entre secciones ---
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`section-${btn.dataset.section}`).classList.add("active");
    if (btn.dataset.section === "mapa") cargarMapa();
  });
});

let cacheHornos = [];
let cachePermisos = [];
let cacheReportes = [];

function hornosById(hornos) {
  return Object.fromEntries(hornos.map((h) => [h.id, h]));
}

async function cargarTodo() {
  [cacheHornos, cachePermisos, cacheReportes] = await Promise.all([
    listarHornos(),
    listarPermisos(),
    listarReportes(),
  ]);

  const porId = hornosById(cacheHornos);

  renderTablaHornos(cacheHornos);
  renderTablaPermisos(cachePermisos, porId);
  renderTablaReportes(cacheReportes, porId);
  actualizarKPIs();
}

function actualizarKPIs() {
  const hoy = new Date();
  const estados = cachePermisos.map((p) => calcularEstadoPermiso(p, hoy));

  document.getElementById("kpi-hornos").textContent = cacheHornos.length;
  document.getElementById("kpi-vigentes").textContent = estados.filter((e) => e === "vigente").length;
  document.getElementById("kpi-por-vencer").textContent = estados.filter((e) => e === "por_vencer").length;

  const hace30 = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sinPermiso30d = cacheReportes.filter((r) => {
    const fecha = r.fecha_hora_reporte?.toDate ? r.fecha_hora_reporte.toDate() : new Date(r.fecha_hora_reporte);
    return r.resultado_verificacion === "sin_permiso" && fecha >= hace30;
  }).length;
  document.getElementById("kpi-sin-permiso").textContent = sinPermiso30d;

  renderAlertas();
}

function renderAlertas() {
  const hoy = new Date();
  const alertas = [];

  cachePermisos.forEach((p) => {
    const estado = calcularEstadoPermiso(p, hoy);
    const horno = cacheHornos.find((h) => h.id === p.horno_id?.id);
    if (estado === "por_vencer") {
      alertas.push({
        severidad: "media",
        texto: `El permiso ${p.folio} de "${horno?.nombre_referencia || "horno"}" vence el ${formatFecha(p.fecha_vigencia_fin)}.`,
      });
    }
  });

  cacheReportes
    .filter((r) => r.resultado_verificacion === "sin_permiso")
    .forEach((r) => {
      alertas.push({
        severidad: "alta",
        texto: `Reporte de quema sin permiso vigente en "${r.direccion_reportada || "ubicación no especificada"}".`,
      });
    });

  const lista = document.getElementById("lista-alertas");
  if (alertas.length === 0) {
    lista.innerHTML = `<p style="color:var(--text-muted);font-size:13px;">Sin alertas activas.</p>`;
    return;
  }
  lista.innerHTML = alertas
    .map(
      (a) => `<div class="alert-card severidad-${a.severidad}">
        ${a.texto}
        <div class="alert-meta">Severidad: ${a.severidad}</div>
      </div>`
    )
    .join("");
}

function cargarMapa() {
  const permisosPorHorno = {};
  cachePermisos.forEach((p) => {
    const hid = p.horno_id?.id;
    if (!hid) return;
    (permisosPorHorno[hid] ||= []).push(p);
  });
  pintarHornosEnMapa(cacheHornos, permisosPorHorno);
}

// --- Buscador ---
document.getElementById("btn-buscar").addEventListener("click", ejecutarBusqueda);
document.getElementById("input-buscar").addEventListener("keydown", (e) => {
  if (e.key === "Enter") ejecutarBusqueda();
});

function ejecutarBusqueda() {
  const q = document.getElementById("input-buscar").value.trim().toLowerCase();
  const contenedor = document.getElementById("resultados-busqueda");
  if (!q) {
    contenedor.innerHTML = "";
    return;
  }

  const coincidencias = cacheHornos.filter(
    (h) =>
      h.nombre_referencia?.toLowerCase().includes(q) ||
      h.propietario_nombre?.toLowerCase().includes(q) ||
      h.direccion?.toLowerCase().includes(q)
  );

  const permisosPorFolio = cachePermisos.filter((p) => p.folio?.toLowerCase().includes(q));

  const resultados = [];

  coincidencias.forEach((h) => {
    const permisosDelHorno = cachePermisos.filter((p) => p.horno_id?.id === h.id);
    const vigente = permisosDelHorno.sort(
      (a, b) => b.fecha_vigencia_fin.toDate() - a.fecha_vigencia_fin.toDate()
    )[0];
    const estado = vigente ? calcularEstadoPermiso(vigente) : "vencido";
    resultados.push({ horno: h, permiso: vigente, estado });
  });

  permisosPorFolio.forEach((p) => {
    const h = cacheHornos.find((h) => h.id === p.horno_id?.id);
    if (h && !resultados.find((r) => r.horno.id === h.id)) {
      resultados.push({ horno: h, permiso: p, estado: calcularEstadoPermiso(p) });
    }
  });

  contenedor.innerHTML =
    resultados.length === 0
      ? `<p style="color:var(--text-muted);font-size:13px;">Sin coincidencias.</p>`
      : resultados
          .map(
            (r) => `
      <div class="result-card">
        <div>
          <div class="r-name">${r.horno.nombre_referencia} — ${r.horno.propietario_nombre || ""}</div>
          <div class="r-meta">${r.horno.direccion || ""}</div>
          ${r.permiso ? `<div class="r-folio">Folio ${r.permiso.folio} · vigencia hasta ${formatFecha(r.permiso.fecha_vigencia_fin)}</div>` : `<div class="r-folio">Sin permiso registrado</div>`}
        </div>
        ${pillHtml(r.estado)}
      </div>`
          )
          .join("");
}

// --- Botones de alta ---
document.getElementById("btn-nuevo-horno").addEventListener("click", () => {
  abrirFormularioHorno(cargarTodo);
});
document.getElementById("btn-nuevo-permiso").addEventListener("click", () => {
  abrirFormularioPermiso(cargarTodo);
});
document.getElementById("btn-nuevo-reporte").addEventListener("click", () => {
  abrirFormularioReporte(cargarTodo);
});

// --- Exportar a Excel ---
document.getElementById("btn-exportar-hornos").addEventListener("click", () => {
  exportarHornos(cacheHornos);
});
document.getElementById("btn-exportar-permisos").addEventListener("click", () => {
  exportarPermisos(cachePermisos, hornosById(cacheHornos));
});
document.getElementById("btn-exportar-reportes").addEventListener("click", () => {
  exportarReportes(cacheReportes, hornosById(cacheHornos));
});

window.addEventListener("cq:autenticado", cargarTodo);
