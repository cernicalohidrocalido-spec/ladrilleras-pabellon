import { db, collection, doc, addDoc, updateDoc, deleteDoc, getDocs, Timestamp } from "./db.js?v=32";
import { abrirModal, cerrarModal, calcularEstadoPermiso, pillHtml, gaugeHtml, formatFecha, accionesHtmlSimple, toDateInputValue, toMillis, fechaRegistroPermiso } from "./utils.js?v=32";
import { listarHornos } from "./hornos.js?v=32";

const permisosCol = collection(db, "permisos");

export async function listarPermisos() {
  const snap = await getDocs(permisosCol);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function ordenarPermisos(permisos, campo = "registro", direccion = "desc") {
  const dir = direccion === "asc" ? 1 : -1;
  const estadoRank = { vigente: 0, por_vencer: 1, vencido: 2 };
  return [...permisos].sort((a, b) => {
    let cmp = 0;
    if (campo === "folio") {
      cmp = String(a.folio || "").localeCompare(String(b.folio || ""), "es", { numeric: true, sensitivity: "base" });
    } else if (campo === "vigencia") {
      cmp = toMillis(a.fecha_vigencia_fin) - toMillis(b.fecha_vigencia_fin);
    } else if (campo === "estado") {
      cmp = (estadoRank[calcularEstadoPermiso(a)] ?? 9) - (estadoRank[calcularEstadoPermiso(b)] ?? 9);
    } else {
      // registro (default)
      cmp = toMillis(fechaRegistroPermiso(a)) - toMillis(fechaRegistroPermiso(b));
    }
    if (cmp === 0) {
      cmp = toMillis(fechaRegistroPermiso(a)) - toMillis(fechaRegistroPermiso(b));
    }
    return cmp * dir;
  });
}

function construirDatosPermiso(data) {
  return {
    horno_id: doc(db, "hornos", data.horno_id),
    folio: data.folio,
    nucleo_localidad: (data.nucleo_localidad || "").trim(),
    fecha_vigencia_inicio: Timestamp.fromDate(new Date(data.vigencia_inicio)),
    fecha_vigencia_fin: Timestamp.fromDate(new Date(data.vigencia_fin)),
    dias_autorizados: data.dias_autorizados,
    horario_autorizado: { inicio: data.horario_inicio, fin: data.horario_fin },
    combustible_autorizado: data.combustible_autorizado,
    autorizado_por: data.autorizado_por,
  };
}

export async function crearPermiso(data) {
  const ahora = Timestamp.now();
  return addDoc(permisosCol, {
    ...construirDatosPermiso(data),
    fecha_registro: ahora,
    fecha_solicitud: ahora,
    fecha_autorizacion: ahora,
    estado: "vigente",
  });
}

export async function actualizarPermiso(id, data) {
  return updateDoc(doc(db, "permisos", id), construirDatosPermiso(data));
}

export async function eliminarPermiso(id) {
  return deleteDoc(doc(db, "permisos", id));
}

export function renderTablaPermisos(permisos, hornosById) {
  const tbody = document.querySelector("#tabla-permisos tbody");
  if (!permisos.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--text-muted);text-align:center;padding:24px">Sin permisos registrados.</td></tr>`;
    return;
  }
  tbody.innerHTML = permisos
    .map((p) => {
      const estado = calcularEstadoPermiso(p);
      const horno = hornosById[p.horno_id?.id] || {};
      const registro = fechaRegistroPermiso(p);
      const ubicacion = p.nucleo_localidad || horno.direccion || "—";
      return `
      <tr>
        <td style="font-family:var(--font-mono)">${p.folio || "—"}</td>
        <td>${horno.nombre_referencia || "—"}</td>
        <td>
          <div class="celda-ubicacion">
            <span>${ubicacion}</span>
            ${
              horno.ubicacion
                ? `<button type="button" class="btn-ver-mapa" data-action="mapa" data-horno-id="${horno.id}" title="Ver este horno en el mapa">🗺️ Ver en el mapa</button>`
                : ""
            }
          </div>
        </td>
        <td data-sort-value="${toMillis(registro)}">${formatFecha(registro)}</td>
        <td>${formatFecha(p.fecha_vigencia_inicio)} – ${formatFecha(p.fecha_vigencia_fin)}</td>
        <td>${(p.dias_autorizados || []).join(", ") || "—"}</td>
        <td>${pillHtml(estado)} ${gaugeHtml(estado)}</td>
        <td>${accionesHtmlSimple(p.id)}</td>
      </tr>`;
    })
    .join("");
}

const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

async function formPermisoHtml(permiso) {
  const hornos = await listarHornos();
  const opciones = hornos
    .map((h) => `<option value="${h.id}" ${permiso?.horno_id?.id === h.id ? "selected" : ""}>${h.nombre_referencia}</option>`)
    .join("");
  const diasSeleccionados = permiso?.dias_autorizados || [];
  const dias = DIAS.map(
    (d) => `<label style="flex-direction:row;align-items:center;gap:6px;">
      <input type="checkbox" value="${d}" class="f-dia" ${diasSeleccionados.includes(d) ? "checked" : ""}> ${d}
    </label>`
  ).join("");
  const nucleoValor = permiso?.nucleo_localidad || "";

  return `
    <label>Horno
      <select id="f-horno">${opciones}</select>
    </label>
    <label>Folio
      <input type="text" id="f-folio" placeholder="PA-2026-0001" value="${permiso?.folio || ""}">
    </label>
    <label>Núcleo de ladrilleras o localidad
      <input type="text" id="f-nucleo" placeholder="Ej. Núcleo Las Ánimas, Ojo Zarco…" value="${nucleoValor}">
    </label>
    <div class="field-row">
      <label>Vigencia inicio
        <input type="date" id="f-inicio" value="${toDateInputValue(permiso?.fecha_vigencia_inicio)}">
      </label>
      <label>Vigencia fin
        <input type="date" id="f-fin" value="${toDateInputValue(permiso?.fecha_vigencia_fin)}">
      </label>
    </div>
    <div class="field-row">
      <label>Horario inicio
        <input type="time" id="f-hora-inicio" value="${permiso?.horario_autorizado?.inicio || "06:00"}">
      </label>
      <label>Horario fin
        <input type="time" id="f-hora-fin" value="${permiso?.horario_autorizado?.fin || "10:00"}">
      </label>
    </div>
    <label>Combustible autorizado
      <select id="f-combustible">
        ${["leña", "aserrín", "gas"].map((c) => `<option ${permiso?.combustible_autorizado === c ? "selected" : ""}>${c}</option>`).join("")}
      </select>
    </label>
    <label>Días autorizados</label>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">${dias}</div>
    <label>Autorizado por
      <input type="text" id="f-autorizado-por" placeholder="Nombre del funcionario" value="${permiso?.autorizado_por || ""}">
    </label>
    <button class="btn btn-primary" id="f-guardar">💾 ${permiso ? "Guardar cambios" : "Guardar permiso"}</button>
  `;
}

export async function abrirFormularioPermiso(onGuardado, permiso) {
  abrirModal(permiso ? "✏️ Editar permiso" : "📋 Registrar trámite de permiso", await formPermisoHtml(permiso));
  document.getElementById("f-guardar").addEventListener("click", async () => {
    const diasSeleccionados = Array.from(document.querySelectorAll(".f-dia:checked")).map(
      (el) => el.value
    );
    const data = {
      horno_id: document.getElementById("f-horno").value,
      folio: document.getElementById("f-folio").value,
      nucleo_localidad: document.getElementById("f-nucleo").value,
      vigencia_inicio: document.getElementById("f-inicio").value,
      vigencia_fin: document.getElementById("f-fin").value,
      horario_inicio: document.getElementById("f-hora-inicio").value,
      horario_fin: document.getElementById("f-hora-fin").value,
      combustible_autorizado: document.getElementById("f-combustible").value,
      dias_autorizados: diasSeleccionados,
      autorizado_por: document.getElementById("f-autorizado-por").value,
    };
    if (permiso) {
      await actualizarPermiso(permiso.id, data);
    } else {
      await crearPermiso(data);
    }
    cerrarModal();
    onGuardado && onGuardado();
  });
}
