// --- Cálculo de estado de un permiso a partir de sus fechas ---
// Devuelve 'vigente' | 'por_vencer' | 'vencido'
export function calcularEstadoPermiso(permiso, ahora = new Date()) {
  const fin = permiso.fecha_vigencia_fin?.toDate
    ? permiso.fecha_vigencia_fin.toDate()
    : new Date(permiso.fecha_vigencia_fin);

  if (permiso.estado === "revocado" || permiso.estado === "suspendido") {
    return "vencido";
  }
  if (ahora > fin) return "vencido";

  const diasRestantes = (fin - ahora) / (1000 * 60 * 60 * 24);
  if (diasRestantes <= 7) return "por_vencer";
  return "vigente";
}

export function pillHtml(estado) {
  const map = {
    vigente: ["Vigente", "pill-vigente"],
    por_vencer: ["Por vencer", "pill-vencer"],
    vencido: ["Vencido", "pill-vencido"],
    con_permiso_vigente: ["Con permiso", "pill-vigente"],
    sin_permiso: ["Sin permiso", "pill-vencido"],
    fuera_de_horario: ["Fuera de horario", "pill-vencer"],
    no_identificado: ["No identificado", "pill-vencer"],
  };
  const [label, cls] = map[estado] || [estado, "pill-vencer"];
  return `<span class="pill ${cls}">${label}</span>`;
}

// Posición (0-100%) del marcador en el gauge de temperatura
export function gaugeHtml(estado) {
  const posMap = { vigente: 10, por_vencer: 50, vencido: 90 };
  const pos = posMap[estado] ?? 50;
  return `<div class="gauge"><div class="gauge-marker" style="left:${pos}%"></div></div>`;
}

export function formatFecha(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" });
}

export function formatFechaHora(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("es-MX", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// --- Modal genérico ---
const overlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalBody = document.getElementById("modal-body");

export function abrirModal(titulo, bodyHtml) {
  modalTitle.textContent = titulo;
  modalBody.innerHTML = bodyHtml;
  overlay.classList.add("open");
}

export function cerrarModal() {
  overlay.classList.remove("open");
  modalBody.innerHTML = "";
}

document.getElementById("modal-close").addEventListener("click", cerrarModal);
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) cerrarModal();
});

export function confirmarAccion(mensaje) {
  return window.confirm(mensaje);
}

// Botonera de acciones (ver / editar / eliminar) para una fila de tabla.
export function accionesHtml(id) {
  return `
    <div class="row-actions">
      <button class="row-btn" data-action="ver" data-id="${id}" title="Ver detalle">👁️</button>
      <button class="row-btn" data-action="editar" data-id="${id}" title="Editar">✏️</button>
      <button class="row-btn row-btn-danger" data-action="eliminar" data-id="${id}" title="Eliminar">🗑️</button>
    </div>
  `;
}

export function accionesHtmlSimple(id) {
  return `
    <div class="row-actions">
      <button class="row-btn" data-action="editar" data-id="${id}" title="Editar">✏️</button>
      <button class="row-btn row-btn-danger" data-action="eliminar" data-id="${id}" title="Eliminar">🗑️</button>
    </div>
  `;
}

// Convierte un Timestamp de Firestore a "YYYY-MM-DD" para <input type="date">
export function toDateInputValue(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().slice(0, 10);
}

// Distancia aproximada en metros entre dos coordenadas (Haversine)
export function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
