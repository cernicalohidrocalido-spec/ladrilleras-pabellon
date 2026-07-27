import { db, collection, addDoc, updateDoc, deleteDoc, getDocs, doc, Timestamp, GeoPoint } from "./db.js?v=10";
import { abrirModal, cerrarModal, pillHtml, formatFechaHora, distanciaMetros, calcularEstadoPermiso, accionesHtmlSimple } from "./utils.js?v=10";
import { listarHornos } from "./hornos.js?v=10";
import { listarPermisos } from "./permisos.js?v=10";

const reportesCol = collection(db, "reportes_quema");

// Radio de tolerancia para considerar que un reporte corresponde a un horno
const RADIO_MATCH_METROS = 150;

export async function listarReportes() {
  const snap = await getDocs(reportesCol);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Núcleo del sistema: dado un reporte, identifica el horno más cercano
// y verifica si tiene permiso vigente para el momento del reporte.
export async function verificarReporte({ lat, lng, fechaHora }) {
  const hornos = await listarHornos();
  const permisos = await listarPermisos();

  let hornoMasCercano = null;
  let distanciaMinima = Infinity;

  for (const h of hornos) {
    if (!h.ubicacion) continue;
    const d = distanciaMetros(lat, lng, h.ubicacion.latitude, h.ubicacion.longitude);
    if (d < distanciaMinima) {
      distanciaMinima = d;
      hornoMasCercano = h;
    }
  }

  if (!hornoMasCercano || distanciaMinima > RADIO_MATCH_METROS) {
    return { resultado: "no_identificado", horno: null, permiso: null };
  }

  const permisoVigente = permisos.find((p) => {
    if (p.horno_id?.id !== hornoMasCercano.id) return false;
    const estado = calcularEstadoPermiso(p, fechaHora);
    return estado !== "vencido";
  });

  if (!permisoVigente) {
    return { resultado: "sin_permiso", horno: hornoMasCercano, permiso: null };
  }

  const diaSemana = fechaHora
    .toLocaleDateString("es-MX", { weekday: "long" })
    .toLowerCase();
  const horaActual = fechaHora.toTimeString().slice(0, 5);
  const dentroDeDia = (permisoVigente.dias_autorizados || []).includes(diaSemana);
  const horario = permisoVigente.horario_autorizado || {};
  const dentroDeHorario =
    !horario.inicio || (horaActual >= horario.inicio && horaActual <= horario.fin);

  if (!dentroDeDia || !dentroDeHorario) {
    return { resultado: "fuera_de_horario", horno: hornoMasCercano, permiso: permisoVigente };
  }

  return { resultado: "con_permiso_vigente", horno: hornoMasCercano, permiso: permisoVigente };
}

export async function crearReporte(data, verificacion) {
  return addDoc(reportesCol, {
    fecha_hora_reporte: Timestamp.fromDate(data.fechaHora),
    origen_reporte: data.origen,
    ubicacion_reportada: new GeoPoint(Number(data.lat), Number(data.lng)),
    direccion_reportada: data.direccion,
    descripcion: data.descripcion,
    horno_id_identificado: verificacion.horno ? doc(db, "hornos", verificacion.horno.id) : null,
    resultado_verificacion: verificacion.resultado,
    permiso_id_relacionado: verificacion.permiso ? doc(db, "permisos", verificacion.permiso.id) : null,
    atendido_por: data.atendidoPor,
    seguimiento: data.seguimiento || "",
  });
}

// Edición: solo toca los campos editables (no vuelve a correr la
// verificación geográfica, que corresponde al momento en que se recibió).
export async function actualizarReporte(id, data) {
  return updateDoc(doc(db, "reportes_quema", id), {
    origen_reporte: data.origen,
    direccion_reportada: data.direccion,
    descripcion: data.descripcion,
    atendido_por: data.atendidoPor,
    seguimiento: data.seguimiento || "",
  });
}

export async function eliminarReporte(id) {
  return deleteDoc(doc(db, "reportes_quema", id));
}

export function renderTablaReportes(reportes, hornosById) {
  const tbody = document.querySelector("#tabla-reportes tbody");
  tbody.innerHTML = reportes
    .map((r) => {
      const horno = hornosById[r.horno_id_identificado?.id];
      return `
      <tr>
        <td>${formatFechaHora(r.fecha_hora_reporte)}</td>
        <td>${r.origen_reporte || "—"}</td>
        <td>${r.direccion_reportada || "—"}</td>
        <td>${horno ? horno.nombre_referencia : "No identificado"}</td>
        <td>${pillHtml(r.resultado_verificacion)}</td>
        <td>${accionesHtmlSimple(r.id)}</td>
      </tr>`;
    })
    .join("");
}

function formReporteHtml() {
  return `
    <label>Origen del reporte
      <select id="f-origen">
        <option>ciudadano</option>
        <option>patrulla</option>
        <option>airepuro</option>
        <option>anónimo</option>
      </select>
    </label>
    <label>Dirección aproximada
      <input type="text" id="f-direccion">
    </label>
    <div class="field-row">
      <label>Latitud
        <input type="text" id="f-lat" placeholder="22.1234">
      </label>
      <label>Longitud
        <input type="text" id="f-lng" placeholder="-102.1234">
      </label>
    </div>
    <label>Descripción
      <textarea id="f-descripcion" rows="2"></textarea>
    </label>
    <label>Atendido por
      <input type="text" id="f-atendido">
    </label>
    <button class="btn btn-primary" id="f-verificar">🔍 Verificar y guardar</button>
    <div id="f-resultado" style="margin-top:6px;"></div>
  `;
}

function formEditarReporteHtml(reporte) {
  return `
    <p class="section-sub">La ubicación, fecha y resultado de verificación no cambian al editar — corresponden al momento del reporte original.</p>
    <label>Origen del reporte
      <select id="f-origen">
        ${["ciudadano", "patrulla", "airepuro", "anónimo"].map((o) => `<option ${reporte.origen_reporte === o ? "selected" : ""}>${o}</option>`).join("")}
      </select>
    </label>
    <label>Dirección aproximada
      <input type="text" id="f-direccion" value="${reporte.direccion_reportada || ""}">
    </label>
    <label>Descripción
      <textarea id="f-descripcion" rows="2">${reporte.descripcion || ""}</textarea>
    </label>
    <label>Atendido por
      <input type="text" id="f-atendido" value="${reporte.atendido_por || ""}">
    </label>
    <label>Seguimiento / acción tomada
      <textarea id="f-seguimiento" rows="2">${reporte.seguimiento || ""}</textarea>
    </label>
    <button class="btn btn-primary" id="f-guardar">💾 Guardar cambios</button>
  `;
}

export function abrirFormularioReporte(onGuardado) {
  abrirModal("🔥 Registrar reporte de quema", formReporteHtml());
  document.getElementById("f-verificar").addEventListener("click", async () => {
    const lat = document.getElementById("f-lat").value;
    const lng = document.getElementById("f-lng").value;
    const fechaHora = new Date();

    const verificacion = await verificarReporte({ lat: Number(lat), lng: Number(lng), fechaHora });

    document.getElementById("f-resultado").innerHTML =
      `Resultado: ${pillHtml(verificacion.resultado)}`;

    const data = {
      origen: document.getElementById("f-origen").value,
      direccion: document.getElementById("f-direccion").value,
      lat, lng,
      descripcion: document.getElementById("f-descripcion").value,
      atendidoPor: document.getElementById("f-atendido").value,
      fechaHora,
    };
    await crearReporte(data, verificacion);
    setTimeout(() => {
      cerrarModal();
      onGuardado && onGuardado();
    }, 900);
  });
}

export function abrirFormularioEditarReporte(reporte, onGuardado) {
  abrirModal("✏️ Editar reporte de quema", formEditarReporteHtml(reporte));
  document.getElementById("f-guardar").addEventListener("click", async () => {
    const data = {
      origen: document.getElementById("f-origen").value,
      direccion: document.getElementById("f-direccion").value,
      descripcion: document.getElementById("f-descripcion").value,
      atendidoPor: document.getElementById("f-atendido").value,
      seguimiento: document.getElementById("f-seguimiento").value,
    };
    await actualizarReporte(reporte.id, data);
    cerrarModal();
    onGuardado && onGuardado();
  });
}
