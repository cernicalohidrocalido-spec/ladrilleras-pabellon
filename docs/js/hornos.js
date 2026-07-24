import { db, collection, addDoc, getDocs, Timestamp, GeoPoint } from "./db.js";
import { abrirModal, cerrarModal } from "./utils.js";

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
    estado: "activo",
  });
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
    </tr>`
    )
    .join("");
}

function formHornoHtml() {
  return `
    <label>Nombre de referencia
      <input type="text" id="f-nombre" placeholder="Horno Familia Ramírez">
    </label>
    <label>Propietario
      <input type="text" id="f-propietario">
    </label>
    <label>Teléfono de contacto
      <input type="text" id="f-contacto">
    </label>
    <label>Dirección
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
    <div class="field-row">
      <label>Tipo de horno
        <select id="f-tipo">
          <option>fijo</option>
          <option>móvil</option>
          <option>colmena</option>
          <option>otro</option>
        </select>
      </label>
      <label>Combustible habitual
        <select id="f-combustible">
          <option>leña</option>
          <option>aserrín</option>
          <option>llanta</option>
          <option>gas</option>
          <option>otro</option>
        </select>
      </label>
    </div>
    <button class="btn btn-primary" id="f-guardar">Guardar horno</button>
  `;
}

export function abrirFormularioHorno(onGuardado) {
  abrirModal("Registrar horno", formHornoHtml());
  document.getElementById("f-guardar").addEventListener("click", async () => {
    const data = {
      nombre_referencia: document.getElementById("f-nombre").value,
      propietario_nombre: document.getElementById("f-propietario").value,
      propietario_contacto: document.getElementById("f-contacto").value,
      direccion: document.getElementById("f-direccion").value,
      lat: document.getElementById("f-lat").value,
      lng: document.getElementById("f-lng").value,
      tipo_horno: document.getElementById("f-tipo").value,
      combustible_habitual: document.getElementById("f-combustible").value,
    };
    await crearHorno(data);
    cerrarModal();
    onGuardado && onGuardado();
  });
}
