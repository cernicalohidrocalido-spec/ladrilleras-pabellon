import {
  db, storage, collection, addDoc, updateDoc, deleteDoc, getDocs, doc,
  Timestamp, GeoPoint, ref, uploadBytes, getDownloadURL,
} from "./db.js?v=18";
import {
  abrirModal, cerrarModal, pillHtml, formatFechaHora, distanciaMetros,
  calcularEstadoPermiso, accionesHtmlReporte,
} from "./utils.js?v=18";
import { listarHornos } from "./hornos.js?v=18";
import { listarPermisos } from "./permisos.js?v=18";
import { inicializarMapaPicker, actualizarMarcadorPicker } from "./mapa.js?v=18";
import { generarPdfInspeccion } from "./pdf-inspeccion.js?v=18";

const reportesCol = collection(db, "reportes_quema");
const RADIO_MATCH_METROS = 150;
const MAX_FOTOS = 5;

export async function listarReportes() {
  const snap = await getDocs(reportesCol);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

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

async function comprimirImagen(file, maxAncho = 1280, calidad = 0.82) {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, maxAncho / bitmap.width);
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", calidad));
  return blob || file;
}

function blobADataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function subirFotosReporte(reporteId, archivos) {
  const subidas = [];
  for (let i = 0; i < archivos.length; i += 1) {
    const file = archivos[i];
    const blob = await comprimirImagen(file);
    const nombre = `foto_${Date.now()}_${i}.jpg`;
    try {
      const storageRef = ref(storage, `reportes_quema/${reporteId}/${nombre}`);
      await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
      const url = await getDownloadURL(storageRef);
      subidas.push({ url, nombre: file.name || nombre, contentType: "image/jpeg", origen: "storage" });
    } catch (err) {
      // Si Storage aún no está habilitado en el proyecto, guarda miniatura embebida.
      console.warn("Storage no disponible, guardando foto embebida:", err?.message || err);
      const dataUrl = await blobADataUrl(blob);
      subidas.push({ url: dataUrl, nombre: file.name || nombre, contentType: "image/jpeg", origen: "embebida" });
    }
  }
  return subidas;
}

export async function crearReporte(data, verificacion, archivosFoto = []) {
  const docRef = await addDoc(reportesCol, {
    fecha_hora_reporte: Timestamp.fromDate(data.fechaHora),
    origen_reporte: data.origen,
    ubicacion_reportada: new GeoPoint(Number(data.lat), Number(data.lng)),
    direccion_reportada: data.direccion,
    nucleo_localidad: data.nucleo_localidad || "",
    descripcion: data.descripcion,
    hallazgos: data.hallazgos || "",
    horno_id_identificado: verificacion.horno ? doc(db, "hornos", verificacion.horno.id) : null,
    resultado_verificacion: verificacion.resultado,
    permiso_id_relacionado: verificacion.permiso ? doc(db, "permisos", verificacion.permiso.id) : null,
    atendido_por: data.atendidoPor,
    seguimiento: data.seguimiento || "",
    fotos: [],
    origen_ubicacion: data.origen_ubicacion || "manual",
  });

  if (archivosFoto.length) {
    const fotos = await subirFotosReporte(docRef.id, archivosFoto);
    await updateDoc(docRef, { fotos });
    return { id: docRef.id, fotos };
  }
  return { id: docRef.id, fotos: [] };
}

export async function actualizarReporte(id, data, archivosFoto = [], fotosExistentes = []) {
  const payload = {
    origen_reporte: data.origen,
    direccion_reportada: data.direccion,
    nucleo_localidad: data.nucleo_localidad || "",
    descripcion: data.descripcion,
    hallazgos: data.hallazgos || "",
    atendido_por: data.atendidoPor,
    seguimiento: data.seguimiento || "",
  };
  if (archivosFoto.length) {
    const nuevas = await subirFotosReporte(id, archivosFoto);
    payload.fotos = [...fotosExistentes, ...nuevas].slice(0, MAX_FOTOS);
  }
  return updateDoc(doc(db, "reportes_quema", id), payload);
}

export async function eliminarReporte(id) {
  return deleteDoc(doc(db, "reportes_quema", id));
}

export function renderTablaReportes(reportes, hornosById) {
  const tbody = document.querySelector("#tabla-reportes tbody");
  if (!reportes.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--text-muted);text-align:center;padding:24px">Sin reportes registrados.</td></tr>`;
    return;
  }
  tbody.innerHTML = reportes
    .map((r) => {
      const horno = hornosById[r.horno_id_identificado?.id];
      const lugar = r.nucleo_localidad || r.direccion_reportada || "—";
      return `
      <tr>
        <td>${formatFechaHora(r.fecha_hora_reporte)}</td>
        <td>${r.origen_reporte || "—"}</td>
        <td>${lugar}</td>
        <td>${horno ? horno.nombre_referencia : "No identificado"}</td>
        <td>${pillHtml(r.resultado_verificacion)}</td>
        <td>${accionesHtmlReporte(r.id)}</td>
      </tr>`;
    })
    .join("");
}

function formInspeccionHtml(reporte) {
  const editando = Boolean(reporte);
  const fotosExistentes = Array.isArray(reporte?.fotos) ? reporte.fotos : [];
  return `
    <label>Origen del reporte
      <select id="f-origen">
        ${["patrulla", "ciudadano", "airepuro", "anónimo", "inspección"].map(
          (o) => `<option ${(!editando && o === "patrulla") || reporte?.origen_reporte === o ? "selected" : ""}>${o}</option>`
        ).join("")}
      </select>
    </label>
    <label>Núcleo de ladrilleras o localidad
      <input type="text" id="f-nucleo" placeholder="Ej. Núcleo Las Ánimas, Ojo Zarco…" value="${reporte?.nucleo_localidad || ""}">
    </label>
    <label>Dirección aproximada
      <input type="text" id="f-direccion" value="${reporte?.direccion_reportada || ""}">
    </label>

    <label>Ubicación de la inspección</label>
    <div class="geo-toolbar">
      <button type="button" class="btn btn-secondary" id="f-btn-gps">📍 Usar mi ubicación</button>
      <span class="geo-hint" id="f-geo-hint">O marca el punto en el mapa</span>
    </div>
    <div class="capas-toolbar">
      <button type="button" class="capas-btn activa" id="f-btn-calles">Calles</button>
      <button type="button" class="capas-btn" id="f-btn-satelital">Satélite</button>
    </div>
    <div id="f-mapa-picker" class="picker-map picker-map-compact"></div>
    <div class="field-row">
      <label>Latitud
        <input type="text" id="f-lat" placeholder="22.1234" value="${reporte?.ubicacion_reportada?.latitude ?? ""}" ${editando ? "readonly" : ""}>
      </label>
      <label>Longitud
        <input type="text" id="f-lng" placeholder="-102.1234" value="${reporte?.ubicacion_reportada?.longitude ?? ""}" ${editando ? "readonly" : ""}>
      </label>
    </div>
    ${editando ? `<p class="section-sub">La ubicación y el resultado de verificación no cambian al editar.</p>` : ""}

    <label>Descripción de la inspección
      <textarea id="f-descripcion" rows="2">${reporte?.descripcion || ""}</textarea>
    </label>
    <label>Hallazgos
      <textarea id="f-hallazgos" rows="2" placeholder="Condiciones del horno, humo, combustible, incumplimientos…">${reporte?.hallazgos || ""}</textarea>
    </label>
    <label>Atendido por (inspector)
      <input type="text" id="f-atendido" value="${reporte?.atendido_por || ""}">
    </label>
    <label>Seguimiento / acción tomada
      <textarea id="f-seguimiento" rows="2">${reporte?.seguimiento || ""}</textarea>
    </label>

    <label>Fotografías de la inspección (máx. ${MAX_FOTOS})
      <input type="file" id="f-fotos" accept="image/*" capture="environment" multiple>
    </label>
    <div class="fotos-preview" id="f-fotos-preview">
      ${fotosExistentes
        .map(
          (f) => `<div class="foto-thumb"><img src="${f.url}" alt="foto"></div>`
        )
        .join("")}
    </div>

    <div class="form-acciones-fila">
      <button class="btn btn-primary" id="f-verificar">${editando ? "💾 Guardar cambios" : "🔍 Verificar y guardar"}</button>
      ${editando ? `<button type="button" class="btn btn-secondary" id="f-pdf">📄 Generar PDF</button>` : ""}
    </div>
    <div id="f-resultado" style="margin-top:6px;"></div>
  `;
}

function conectarFotosPreview(inputId, previewId, fotosYaGuardadas = 0) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const serverHtml = preview.innerHTML;
  input._archivosSeleccionados = [];

  input.addEventListener("change", () => {
    const cupo = Math.max(0, MAX_FOTOS - fotosYaGuardadas);
    const seleccionados = Array.from(input.files || []).slice(0, cupo);
    if ((input.files?.length || 0) > cupo) {
      window.alert(`Solo se permiten ${MAX_FOTOS} fotografías en total.`);
    }
    input._archivosSeleccionados = seleccionados;
    preview.innerHTML = serverHtml;
    seleccionados.forEach((file) => {
      const div = document.createElement("div");
      div.className = "foto-thumb";
      div.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="nueva">`;
      preview.appendChild(div);
    });
  });

  return () => input._archivosSeleccionados || [];
}

function conectarMapaYGps(editando) {
  const inputLat = document.getElementById("f-lat");
  const inputLng = document.getElementById("f-lng");
  const hint = document.getElementById("f-geo-hint");
  let origenUbicacion = "manual";

  const centroInicial =
    inputLat.value && inputLng.value
      ? [parseFloat(inputLat.value), parseFloat(inputLng.value)]
      : null;

  if (!editando) {
    inicializarMapaPicker(
      "f-mapa-picker",
      (lat, lng) => {
        inputLat.value = lat.toFixed(6);
        inputLng.value = lng.toFixed(6);
        origenUbicacion = "mapa";
        if (hint) hint.textContent = "Ubicación marcada en el mapa";
      },
      centroInicial,
      { calles: "f-btn-calles", satelital: "f-btn-satelital" }
    );

    function syncDesdeInputs() {
      const lat = parseFloat(inputLat.value);
      const lng = parseFloat(inputLng.value);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) actualizarMarcadorPicker(lat, lng);
    }
    inputLat.addEventListener("change", syncDesdeInputs);
    inputLng.addEventListener("change", syncDesdeInputs);
  } else if (centroInicial) {
    // Solo vista de referencia al editar
    inicializarMapaPicker(
      "f-mapa-picker",
      () => {},
      centroInicial,
      { calles: "f-btn-calles", satelital: "f-btn-satelital" }
    );
  }

  document.getElementById("f-btn-gps")?.addEventListener("click", () => {
    if (editando) {
      window.alert("La ubicación no se modifica al editar un reporte ya verificado.");
      return;
    }
    if (!navigator.geolocation) {
      window.alert("Este dispositivo no permite geolocalización.");
      return;
    }
    if (hint) hint.textContent = "Obteniendo ubicación…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        inputLat.value = lat.toFixed(6);
        inputLng.value = lng.toFixed(6);
        actualizarMarcadorPicker(lat, lng);
        origenUbicacion = "gps";
        if (hint) hint.textContent = "Ubicación tomada del GPS del dispositivo";
      },
      (err) => {
        window.alert("No se pudo obtener la ubicación: " + (err.message || "permiso denegado"));
        if (hint) hint.textContent = "O marca el punto en el mapa";
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });

  return () => origenUbicacion;
}

function leerCamposFormulario() {
  return {
    origen: document.getElementById("f-origen").value,
    nucleo_localidad: document.getElementById("f-nucleo").value.trim(),
    direccion: document.getElementById("f-direccion").value.trim(),
    lat: document.getElementById("f-lat").value,
    lng: document.getElementById("f-lng").value,
    descripcion: document.getElementById("f-descripcion").value.trim(),
    hallazgos: document.getElementById("f-hallazgos").value.trim(),
    atendidoPor: document.getElementById("f-atendido").value.trim(),
    seguimiento: document.getElementById("f-seguimiento").value.trim(),
  };
}

export function abrirFormularioReporte(onGuardado) {
  abrirModal("🔥 Inspección / reporte de quema", formInspeccionHtml(null));
  const getOrigenUbicacion = conectarMapaYGps(false);
  const getArchivos = conectarFotosPreview("f-fotos", "f-fotos-preview", 0);

  document.getElementById("f-verificar").addEventListener("click", async () => {
    const campos = leerCamposFormulario();
    const lat = Number(campos.lat);
    const lng = Number(campos.lng);
    if (!campos.lat || !campos.lng || Number.isNaN(lat) || Number.isNaN(lng)) {
      window.alert("Marca la ubicación en el mapa o usa el GPS antes de guardar.");
      return;
    }
    const btn = document.getElementById("f-verificar");
    btn.disabled = true;
    btn.textContent = "Guardando…";
    try {
      const fechaHora = new Date();
      const verificacion = await verificarReporte({ lat, lng, fechaHora });
      document.getElementById("f-resultado").innerHTML =
        `Resultado: ${pillHtml(verificacion.resultado)}`;

      const { id, fotos } = await crearReporte(
        {
          ...campos,
          fechaHora,
          origen_ubicacion: getOrigenUbicacion(),
        },
        verificacion,
        getArchivos()
      );

      const reporteGuardado = {
        id,
        fecha_hora_reporte: fechaHora,
        origen_reporte: campos.origen,
        nucleo_localidad: campos.nucleo_localidad,
        direccion_reportada: campos.direccion,
        ubicacion_reportada: { latitude: lat, longitude: lng },
        descripcion: campos.descripcion,
        hallazgos: campos.hallazgos,
        atendido_por: campos.atendidoPor,
        seguimiento: campos.seguimiento,
        resultado_verificacion: verificacion.resultado,
        fotos,
      };

      document.getElementById("f-resultado").innerHTML = `
        Resultado: ${pillHtml(verificacion.resultado)}
        <div class="form-acciones-fila" style="margin-top:10px">
          <button type="button" class="btn btn-secondary" id="f-pdf-ahora">📄 Generar PDF de inspección</button>
        </div>`;
      document.getElementById("f-pdf-ahora")?.addEventListener("click", () => {
        generarPdfInspeccion(reporteGuardado, verificacion.horno);
      });

      setTimeout(() => {
        cerrarModal();
        onGuardado && onGuardado();
      }, 1600);
    } catch (err) {
      console.error(err);
      window.alert("No se pudo guardar el reporte: " + (err.message || err));
      btn.disabled = false;
      btn.textContent = "🔍 Verificar y guardar";
    }
  });
}

export function abrirFormularioEditarReporte(reporte, onGuardado, horno) {
  abrirModal("✏️ Editar inspección / reporte", formInspeccionHtml(reporte));
  conectarMapaYGps(true);
  const fotosExistentes = Array.isArray(reporte.fotos) ? reporte.fotos : [];
  const getArchivos = conectarFotosPreview("f-fotos", "f-fotos-preview", fotosExistentes.length);

  document.getElementById("f-pdf")?.addEventListener("click", () => {
    generarPdfInspeccion(reporte, horno);
  });

  document.getElementById("f-verificar").addEventListener("click", async () => {
    const campos = leerCamposFormulario();
    const btn = document.getElementById("f-verificar");
    btn.disabled = true;
    try {
      await actualizarReporte(reporte.id, campos, getArchivos(), fotosExistentes);
      cerrarModal();
      onGuardado && onGuardado();
    } catch (err) {
      console.error(err);
      window.alert("No se pudo guardar: " + (err.message || err));
      btn.disabled = false;
    }
  });
}

export { generarPdfInspeccion };
