/** Checklist fijo de hallazgos para inspección de ladrilleras. */
export const OPCIONES_HALLAZGOS = [
  { id: "quema_activa", label: "Quema activa al momento de la inspección" },
  { id: "humo_visible", label: "Emisión visible de humo / partículas" },
  { id: "combustible_no_autorizado", label: "Uso de combustible no autorizado (llanta, plástico, etc.)" },
  { id: "sin_permiso", label: "Sin permiso de quema vigente" },
  { id: "fuera_horario", label: "Quema fuera de días u horario autorizado" },
  { id: "horno_deteriorado", label: "Horno en mal estado o con riesgo de seguridad" },
  { id: "residuos_combustible", label: "Residuos de combustión / basura en el predio" },
  { id: "afectacion_vecinos", label: "Afectación reportada a vecinos / vía pública" },
  { id: "cumple_condiciones", label: "Cumple las condiciones del permiso" },
];

/**
 * Infracciones aplicables a control de quema / ladrilleras
 * (Ley de Ingresos del Municipio de Pabellón de Arteaga, ejercicio 2026).
 * Fuente: https://imbio.info/normativa-vigente/lectura.html?doc=ley-ingresos-2026
 */
export const OPCIONES_SANCION = [
  {
    id: "c",
    label: "c) Realice combustión de llantas;",
  },
  {
    id: "f",
    label: "f) Emita ostensiblemente contaminantes a la atmósfera, tales como humos, polvos, gases, vapores u olores;",
  },
];

/** Rango legal de multa para estas infracciones. */
export const SANCION_MULTA_MIN = 100;
export const SANCION_MULTA_MAX = 1000;
/** Monto sugerido por defecto al levantar acta de sanción (dentro del rango legal). */
export const SANCION_MULTA_SUGERIDA = 500;

/** Valor diario UMA 2026 (INEGI, vigente desde 1 feb 2026). */
export const UMA_DIARIA_MXN = 117.31;
export const UMA_VIGENCIA = "1 de febrero de 2026";

export const SANCION_MULTA_TEXTO =
  "Se sancionará con multa de 100 a 1,000 UMA (Unidad de Medida y Actualización), a su valor vigente al momento de cometer la infracción, a quien incurra en las conductas señaladas, conforme a la Ley de Ingresos del Municipio de Pabellón de Arteaga, ejercicio fiscal 2026.";

export const SANCION_PLAZO_PAGO =
  "El infractor cuenta con 5 (cinco) días hábiles para realizar el pago de la multa en la Tesorería Municipal del H. Ayuntamiento de Pabellón de Arteaga, Aguascalientes.";

export function calcularMultaPesos(umas, valorUma = UMA_DIARIA_MXN) {
  const n = Number(umas);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * Number(valorUma) * 100) / 100;
}

export function formatPesosMXN(monto) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(monto) || 0);
}

/** Convierte un monto en pesos a letra (español México). */
export function numeroALetrasPesos(monto) {
  const total = Math.round((Number(monto) || 0) * 100);
  const enteros = Math.floor(total / 100);
  const centavos = total % 100;
  const letras = _numeroALetras(enteros).toUpperCase();
  const cent = String(centavos).padStart(2, "0");
  return `${letras} PESOS ${cent}/100 M.N.`;
}

function _numeroALetras(n) {
  if (n === 0) return "cero";
  const u = ["", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
  const d = ["", "diez", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
  const c = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
  const especiales = {
    10: "diez", 11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince",
    16: "dieciséis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve",
    20: "veinte", 21: "veintiún", 22: "veintidós", 23: "veintitrés", 24: "veinticuatro",
    25: "veinticinco", 26: "veintiséis", 27: "veintisiete", 28: "veintiocho", 29: "veintinueve",
  };

  function hasta999(num) {
    if (num === 0) return "";
    if (num === 100) return "cien";
    if (especiales[num]) return especiales[num];
    const cen = Math.floor(num / 100);
    const resto = num % 100;
    let out = cen ? c[cen] : "";
    if (resto === 0) return out.trim();
    if (especiales[resto]) return `${out} ${especiales[resto]}`.trim();
    const dec = Math.floor(resto / 10);
    const uni = resto % 10;
    if (dec === 0) return `${out} ${u[uni]}`.trim();
    if (dec === 1) return `${out} ${especiales[resto] || d[dec]}`.trim();
    if (dec === 2 && uni > 0) return `${out} veinti${u[uni]}`.trim().replace("veintiun", "veintiún");
    return `${out} ${d[dec]}${uni ? ` y ${u[uni]}` : ""}`.trim();
  }

  if (n < 1000) {
    const t = hasta999(n);
    return n === 1 ? "un" : t;
  }
  if (n < 1000000) {
    const miles = Math.floor(n / 1000);
    const resto = n % 1000;
    const pref = miles === 1 ? "mil" : `${hasta999(miles)} mil`;
    return resto ? `${pref} ${hasta999(resto)}` : pref;
  }
  const millones = Math.floor(n / 1000000);
  const resto = n % 1000000;
  const pref = millones === 1 ? "un millón" : `${hasta999(millones)} millones`;
  if (!resto) return pref;
  if (resto < 1000) return `${pref} ${hasta999(resto)}`;
  return `${pref} ${_numeroALetras(resto)}`;
}

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

/** Convierte Timestamp / Date / string a milisegundos (0 si no hay fecha). */
export function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.toDate === "function") return ts.toDate().getTime();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/** Fecha de registro del permiso: registro ? solicitud ? autorización ? inicio de vigencia. */
export function fechaRegistroPermiso(permiso) {
  return permiso?.fecha_registro || permiso?.fecha_solicitud || permiso?.fecha_autorizacion || permiso?.fecha_vigencia_inicio || null;
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
      <button class="row-btn" data-action="ver" data-id="${id}" title="Ver detalle">???</button>
      <button class="row-btn" data-action="editar" data-id="${id}" title="Editar">??</button>
      <button class="row-btn row-btn-danger" data-action="eliminar" data-id="${id}" title="Eliminar">???</button>
    </div>
  `;
}

export function accionesHtmlSimple(id) {
  return `
    <div class="row-actions">
      <button class="row-btn" data-action="editar" data-id="${id}" title="Editar">??</button>
      <button class="row-btn row-btn-danger" data-action="eliminar" data-id="${id}" title="Eliminar">???</button>
    </div>
  `;
}

export function accionesHtmlReporte(id) {
  return `
    <div class="row-actions">
      <button class="row-btn" data-action="pdf" data-id="${id}" title="Acta de inspección (PDF)">??</button>
      <button class="row-btn" data-action="pdf-sancion" data-id="${id}" title="Acta de sanción (PDF)">??</button>
      <button class="row-btn" data-action="editar" data-id="${id}" title="Editar">??</button>
      <button class="row-btn row-btn-danger" data-action="eliminar" data-id="${id}" title="Eliminar">???</button>
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
