import { db, collection, doc, addDoc, updateDoc, deleteDoc, getDocs, Timestamp, GeoPoint } from "./db.js?v=11";
import { abrirModal, cerrarModal, accionesHtml, formatFecha, pillHtml } from "./utils.js?v=11";
import { inicializarMapaPicker, actualizarMarcadorPicker } from "./mapa.js?v=11";

const hornosCol = collection(db, "hornos");

export async function listarHornos() {
  const snap = await getDocs(hornosCol);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function crearHorno(data) {
  return addDoc(hornosCol, {
    ...data,
    ubicacion: new GeoPoint(Number(data.lat), Number(data.lng)),
    fecha_registro: Timestamp.now(),
    estado: data.estado || "activo",
  });
}

export async function actualizarHorno(id, data) {
  return updateDoc(doc(db, "hornos", id), {
    ...data,
    ubicacion: new GeoPoint(Number(data.lat), Number(data.lng)),
  });
}

export async function eliminarHorno(id) {
  return deleteDoc(doc(db, "hornos", id));
}

export function renderTablaHornos(hornos) {
  const tbody = document.querySelector("#tabla-hornos tbody");
  tbody.innerHTML = hornos
    .map(
      (h) => `
    <tr>
      <td>${h.nombre_referencia || "—"}</td>
      <td>${h.propietario_nombre || "—"}</td>
      <td>${h.direccion || "—"}</td>
      <td>${h.combustible_habitual || "—"}</td>
      <td>${h.estado || "—"}</td>
      <td>${accionesHtml(h.id)}</td>
    </tr>`
    )
    .join("");
}

function formHornoHtml(horno) {
  return `
    <label>Nombre de referencia
      <input type="text" id="f-nombre" placeholder="Horno Familia Ramírez" value="${horno?.nombre_referencia || ""}">
    </label>
    <label>Propietario
      <input type="text" id="f-propietario" value="${horno?.propietario_nombre || ""}">
    </label>
    <label>Teléfono de contacto
      <input type="text" id="f-contacto" value="${horno?.propietario_contacto || ""}">
    </label>
    <label>Dirección
      <input type="text" id="f-direccion" value="${horno?.direccion || ""}">
    </label>

    <label>Ubicación — haz clic en el mapa (o arrastra el marcador) para marcar el horno</label>
    <div class="capas-toolbar">
      <button type="button" class="capas-btn activa" id="f-btn-calles">Calles</button>
      <button type="button" class="capas-btn" id="f-btn-satelital">Satélite</button>
    </div>
    <div id="f-mapa-picker" class="picker-map"></div>

    <div class="field-row">
      <label>Latitud
        <input type="text" id="f-lat" placeholder="22.1234" value="${horno?.ubicacion?.latitude ?? ""}">
      </label>
      <label>Longitud
        <input type="text" id="f-lng" placeholder="-102.1234" value="${horno?.ubicacion?.longitude ?? ""}">
      </label>
    </div>
    <div class="field-row">
      <label>Tipo de horno
        <select id="f-tipo">
          ${["fijo", "móvil", "colmena", "otro"].map((t) => `<option ${horno?.tipo_horno === t ? "selected" : ""}>${t}</option>`).join("")}
        </select>
      </label>
      <label>Combustible habitual
        <select id="f-combustible">
          ${["leña", "aserrín", "llanta", "gas", "otro"].map((c) => `<option ${horno?.combustible_habitual === c ? "selected" : ""}>${c}</option>`).join("")}
        </select>
      </label>
    </div>
    <label>Estado del horno
      <select id="f-estado">
        ${["activo", "inactivo", "clausurado"].map((e) => `<option ${horno?.estado === e ? "selected" : ""}>${e}</option>`).join("")}
      </select>
    </label>
    <button class="btn btn-primary" id="f-guardar">💾 ${horno ? "Guardar cambios" : "Guardar horno"}</button>
  `;
}

export function abrirFormularioHorno(onGuardado, horno) {
  abrirModal(horno ? "✏️ Editar horno" : "🧱 Registrar horno", formHornoHtml(horno));

  const inputLat = document.getElementById("f-lat");
  const inputLng = document.getElementById("f-lng");

  const centroInicial =
    horno?.ubicacion ? [horno.ubicacion.latitude, horno.ubicacion.longitude] : null;

  // Mapa selector: al hacer clic o arrastrar el marcador, llena lat/lng.
  inicializarMapaPicker(
    "f-mapa-picker",
    (lat, lng) => {
      inputLat.value = lat.toFixed(6);
      inputLng.value = lng.toFixed(6);
    },
    centroInicial,
    { calles: "f-btn-calles", satelital: "f-btn-satelital" }
  );

  // Si el usuario escribe las coordenadas a mano, mueve el marcador también.
  function sincronizarDesdeInputs() {
    const lat = parseFloat(inputLat.value);
    const lng = parseFloat(inputLng.value);
    if (!isNaN(lat) && !isNaN(lng)) {
      actualizarMarcadorPicker(lat, lng);
    }
  }
  inputLat.addEventListener("change", sincronizarDesdeInputs);
  inputLng.addEventListener("change", sincronizarDesdeInputs);

  document.getElementById("f-guardar").addEventListener("click", async () => {
    if (!inputLat.value || !inputLng.value) {
      alert("Marca la ubicación del horno en el mapa antes de guardar.");
      return;
    }
    const data = {
      nombre_referencia: document.getElementById("f-nombre").value,
      propietario_nombre: document.getElementById("f-propietario").value,
      propietario_contacto: document.getElementById("f-contacto").value,
      direccion: document.getElementById("f-direccion").value,
      lat: inputLat.value,
      lng: inputLng.value,
      tipo_horno: document.getElementById("f-tipo").value,
      combustible_habitual: document.getElementById("f-combustible").value,
      estado: document.getElementById("f-estado").value,
    };
    if (horno) {
      await actualizarHorno(horno.id, data);
    } else {
      await crearHorno(data);
    }
    cerrarModal();
    onGuardado && onGuardado();
  });
}

// Vista de solo lectura con todos los datos del horno + su historial
// de permisos y reportes de quema relacionados.
export function abrirDetalleHorno(horno, permisosDelHorno, reportesDelHorno) {
  const permisosHtml = permisosDelHorno.length
    ? permisosDelHorno
        .map(
          (p) => `
      <div class="detalle-item">
        <strong>${p.folio || "Sin folio"}</strong>
        <span>${formatFecha(p.fecha_vigencia_inicio)} – ${formatFecha(p.fecha_vigencia_fin)}</span>
      </div>`
        )
        .join("")
    : `<p class="section-sub">Sin permisos registrados.</p>`;

  const reportesHtml = reportesDelHorno.length
    ? reportesDelHorno
        .map(
          (r) => `
      <div class="detalle-item">
        <span>${formatFecha(r.fecha_hora_reporte)} — ${r.origen_reporte || ""}</span>
        ${pillHtml(r.resultado_verificacion)}
      </div>`
        )
        .join("")
    : `<p class="section-sub">Sin reportes registrados.</p>`;

  abrirModal(
    "🧱 Ficha del horno",
    `
    <div class="detalle-grid">
      <div><span class="detalle-label">Referencia</span><strong>${horno.nombre_referencia || "—"}</strong></div>
      <div><span class="detalle-label">Estado</span><strong>${horno.estado || "—"}</strong></div>
      <div><span class="detalle-label">Propietario</span><strong>${horno.propietario_nombre || "—"}</strong></div>
      <div><span class="detalle-label">Contacto</span><strong>${horno.propietario_contacto || "—"}</strong></div>
      <div><span class="detalle-label">Dirección</span><strong>${horno.direccion || "—"}</strong></div>
      <div><span class="detalle-label">Tipo de horno</span><strong>${horno.tipo_horno || "—"}</strong></div>
      <div><span class="detalle-label">Combustible habitual</span><strong>${horno.combustible_habitual || "—"}</strong></div>
      <div><span class="detalle-label">Registrado</span><strong>${formatFecha(horno.fecha_registro)}</strong></div>
      <div><span class="detalle-label">Coordenadas</span><strong>${horno.ubicacion ? `${horno.ubicacion.latitude.toFixed(5)}, ${horno.ubicacion.longitude.toFixed(5)}` : "—"}</strong></div>
    </div>

    <h3 class="detalle-subtitulo">📋 Permisos</h3>
    ${permisosHtml}

    <h3 class="detalle-subtitulo">🔥 Reportes de quema</h3>
    ${reportesHtml}
  `
  );
}
