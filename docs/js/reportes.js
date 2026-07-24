import { db, collection, addDoc, getDocs, doc, Timestamp, GeoPoint } from "./db.js?v=3";
import { abrirModal, cerrarModal, pillHtml, formatFechaHora, distanciaMetros, calcularEstadoPermiso } from "./utils.js?v=3";
import { listarHornos } from "./hornos.js?v=3";
import { listarPermisos } from "./permisos.js?v=3";

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
    <button class="btn btn-primary" id="f-verificar">Verificar y guardar</button>
    <div id="f-resultado" style="margin-top:6px;"></div>
  `;
}

export function abrirFormularioReporte(onGuardado) {
  abrirModal("Registrar reporte de quema", formReporteHtml());
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
