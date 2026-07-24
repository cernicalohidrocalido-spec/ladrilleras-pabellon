import { db, collection, addDoc, getDocs, Timestamp, GeoPoint } from "./db.js?v=3";
import { abrirModal, cerrarModal } from "./utils.js?v=3";
import { inicializarMapaPicker, actualizarMarcadorPicker } from "./mapa.js?v=3";

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

    <label>Ubicación — haz clic en el mapa (o arrastra el marcador) para marcar el horno
      <div id="f-mapa-picker" class="picker-map"></div>
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

  const inputLat = document.getElementById("f-lat");
  const inputLng = document.getElementById("f-lng");

  // Mapa selector: al hacer clic o arrastrar el marcador, llena lat/lng.
  inicializarMapaPicker("f-mapa-picker", (lat, lng) => {
    inputLat.value = lat.toFixed(6);
    inputLng.value = lng.toFixed(6);
  });

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
    };
    await crearHorno(data);
    cerrarModal();
    onGuardado && onGuardado();
  });
}
