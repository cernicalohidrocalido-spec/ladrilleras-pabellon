import { db, collection, addDoc, getDocs, doc, Timestamp } from "./db.js?v=5";
import { abrirModal, cerrarModal, calcularEstadoPermiso, pillHtml, gaugeHtml, formatFecha } from "./utils.js?v=5";
import { listarHornos } from "./hornos.js?v=5";

const permisosCol = collection(db, "permisos");

export async function listarPermisos() {
  const snap = await getDocs(permisosCol);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function crearPermiso(data) {
  return addDoc(permisosCol, {
    horno_id: doc(db, "hornos", data.horno_id),
    folio: data.folio,
    fecha_solicitud: Timestamp.now(),
    fecha_autorizacion: Timestamp.now(),
    fecha_vigencia_inicio: Timestamp.fromDate(new Date(data.vigencia_inicio)),
    fecha_vigencia_fin: Timestamp.fromDate(new Date(data.vigencia_fin)),
    dias_autorizados: data.dias_autorizados,
    horario_autorizado: { inicio: data.horario_inicio, fin: data.horario_fin },
    combustible_autorizado: data.combustible_autorizado,
    estado: "vigente",
    autorizado_por: data.autorizado_por,
  });
}

export function renderTablaPermisos(permisos, hornosById) {
  const tbody = document.querySelector("#tabla-permisos tbody");
  tbody.innerHTML = permisos
    .map((p) => {
      const estado = calcularEstadoPermiso(p);
      const horno = hornosById[p.horno_id?.id] || {};
      return `
      <tr>
        <td style="font-family:var(--font-mono)">${p.folio || "—"}</td>
        <td>${horno.nombre_referencia || "—"}</td>
        <td>${formatFecha(p.fecha_vigencia_inicio)} – ${formatFecha(p.fecha_vigencia_fin)}</td>
        <td>${(p.dias_autorizados || []).join(", ") || "—"}</td>
        <td>${pillHtml(estado)} ${gaugeHtml(estado)}</td>
      </tr>`;
    })
    .join("");
}

const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

async function formPermisoHtml() {
  const hornos = await listarHornos();
  const opciones = hornos
    .map((h) => `<option value="${h.id}">${h.nombre_referencia}</option>`)
    .join("");
  const dias = DIAS.map(
    (d) => `<label style="flex-direction:row;align-items:center;gap:6px;">
      <input type="checkbox" value="${d}" class="f-dia"> ${d}
    </label>`
  ).join("");

  return `
    <label>Horno
      <select id="f-horno">${opciones}</select>
    </label>
    <label>Folio
      <input type="text" id="f-folio" placeholder="PA-2026-0001">
    </label>
    <div class="field-row">
      <label>Vigencia inicio
        <input type="date" id="f-inicio">
      </label>
      <label>Vigencia fin
        <input type="date" id="f-fin">
      </label>
    </div>
    <div class="field-row">
      <label>Horario inicio
        <input type="time" id="f-hora-inicio" value="06:00">
      </label>
      <label>Horario fin
        <input type="time" id="f-hora-fin" value="10:00">
      </label>
    </div>
    <label>Combustible autorizado
      <select id="f-combustible">
        <option>leña</option>
        <option>aserrín</option>
        <option>gas</option>
      </select>
    </label>
    <label>Días autorizados</label>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">${dias}</div>
    <label>Autorizado por
      <input type="text" id="f-autorizado-por" placeholder="Nombre del funcionario">
    </label>
    <button class="btn btn-primary" id="f-guardar">Guardar permiso</button>
  `;
}

export async function abrirFormularioPermiso(onGuardado) {
  abrirModal("Registrar trámite de permiso", await formPermisoHtml());
  document.getElementById("f-guardar").addEventListener("click", async () => {
    const diasSeleccionados = Array.from(document.querySelectorAll(".f-dia:checked")).map(
      (el) => el.value
    );
    const data = {
      horno_id: document.getElementById("f-horno").value,
      folio: document.getElementById("f-folio").value,
      vigencia_inicio: document.getElementById("f-inicio").value,
      vigencia_fin: document.getElementById("f-fin").value,
      horario_inicio: document.getElementById("f-hora-inicio").value,
      horario_fin: document.getElementById("f-hora-fin").value,
      combustible_autorizado: document.getElementById("f-combustible").value,
      dias_autorizados: diasSeleccionados,
      autorizado_por: document.getElementById("f-autorizado-por").value,
    };
    await crearPermiso(data);
    cerrarModal();
    onGuardado && onGuardado();
  });
}
