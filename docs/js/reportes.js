import {
  db, storage, collection, addDoc, updateDoc, deleteDoc, getDocs, doc,
  Timestamp, GeoPoint, ref, uploadBytes, getDownloadURL,
} from "./db.js?v=30";
import {
  abrirModal, cerrarModal, pillHtml, formatFechaHora, distanciaMetros,
  calcularEstadoPermiso, accionesHtmlReporte, OPCIONES_HALLAZGOS,
  OPCIONES_SANCION, SANCION_MULTA_TEXTO, SANCION_MULTA_MIN, SANCION_MULTA_MAX, SANCION_MULTA_SUGERIDA,
  UMA_DIARIA_MXN, UMA_VIGENCIA, calcularMultaPesos, formatPesosMXN, numeroALetrasPesos, SANCION_PLAZO_PAGO,
} from "./utils.js?v=30";
import { listarHornos } from "./hornos.js?v=30";
import { listarPermisos } from "./permisos.js?v=30";
import { inicializarMapaPicker, actualizarMarcadorPicker } from "./mapa.js?v=30";
import { generarPdfInspeccion, generarPdfSancion } from "./pdf-inspeccion.js?v=30";

const reportesCol = collection(db, "reportes_quema");
const RADIO_MATCH_METROS = 150;
const MAX_FOTOS = 5;

/** Folio institucional: INSP-AAAA-MMDD-HHMMSS */
export function generarFolioInspeccion(fecha = new Date()) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  const hh = String(fecha.getHours()).padStart(2, "0");
  const mm = String(fecha.getMinutes()).padStart(2, "0");
  const ss = String(fecha.getSeconds()).padStart(2, "0");
  const rnd = String(Math.floor(Math.random() * 90) + 10);
  return `INSP-${y}-${m}${d}-${hh}${mm}${ss}${rnd}`;
}

function checklistHallazgosHtml(seleccionados = []) {
  const set = new Set(seleccionados || []);
  return `
    <div class="hallazgos-label">Hallazgos</div>
    <div class="hallazgos-checklist" role="group" aria-label="Hallazgos de la inspección">
      ${OPCIONES_HALLAZGOS.map(
        (o) => `<label class="check-row">
          <input type="checkbox" class="f-hallazgo" value="${o.id}" ${set.has(o.id) ? "checked" : ""}>
          <span>${o.label}</span>
        </label>`
      ).join("")}
    </div>
  `;
}

function checklistSancionHtml(seleccionados = [], umas = "", obs = "") {
  const set = new Set(seleccionados || []);
  const valorUmas = umas || SANCION_MULTA_SUGERIDA;
  const pesos = calcularMultaPesos(valorUmas);
  return `
    <div class="sancion-bloque">
      <div class="hallazgos-label">Datos para acta de sanción (documento aparte)</div>
      <p class="sancion-fund">${SANCION_MULTA_TEXTO}</p>
      <p class="geo-hint">Infracciones c) combustión de llantas y f) emisiones a la atmósfera. UMA diaria ${formatPesosMXN(UMA_DIARIA_MXN)} (vigente desde ${UMA_VIGENCIA}).</p>
      <div class="hallazgos-checklist" role="group" aria-label="Infracciones">
        ${OPCIONES_SANCION.map(
          (o) => `<label class="check-row">
            <input type="checkbox" class="f-sancion" value="${o.id}" ${set.has(o.id) ? "checked" : ""}>
            <span>${o.label}</span>
          </label>`
        ).join("")}
      </div>
      <div class="field-row">
        <label>Multa (UMA)
          <input type="number" id="f-sancion-umas" min="${SANCION_MULTA_MIN}" max="${SANCION_MULTA_MAX}" step="1" placeholder="${SANCION_MULTA_MIN}–${SANCION_MULTA_MAX}" value="${valorUmas}">
        </label>
      </div>
      <div class="uma-calc" id="f-uma-calc">
        <div><span>Equivalente en pesos</span><strong id="f-sancion-pesos">${formatPesosMXN(pesos)}</strong></div>
        <div><span>Cantidad con letra</span><strong id="f-sancion-letra">${numeroALetrasPesos(pesos)}</strong></div>
        <p class="geo-hint" style="margin:6px 0 0">${SANCION_PLAZO_PAGO}</p>
      </div>
      <label>Observaciones de la sanción
        <textarea id="f-sancion-obs" rows="2" placeholder="Fundamento, agravantes, plazos…">${obs || ""}</textarea>
      </label>
    </div>
  `;
}

function conectarCalculadoraUma() {
  const input = document.getElementById("f-sancion-umas");
  const pesosEl = document.getElementById("f-sancion-pesos");
  const letraEl = document.getElementById("f-sancion-letra");
  if (!input || !pesosEl || !letraEl) return;
  function actualizar() {
    const pesos = calcularMultaPesos(input.value);
    pesosEl.textContent = formatPesosMXN(pesos);
    letraEl.textContent = numeroALetrasPesos(pesos);
  }
  input.addEventListener("input", actualizar);
  actualizar();
}

function bloqueResponsableHtml(reporte) {
  const tipo = reporte?.responsable_id_tipo || "credencial_elector";
  return `
    <div class="responsable-bloque">
      <div class="hallazgos-label">Responsable de la ladrillera</div>
      <p class="geo-hint">Conforme a lo que manifieste o acredite con credencial de elector u otra identificación.</p>
      <label>Nombre del responsable
        <input type="text" id="f-responsable-nombre" placeholder="Nombre completo" value="${reporte?.responsable_nombre || ""}">
      </label>
      <label>Domicilio particular
        <input type="text" id="f-responsable-domicilio" placeholder="Calle, número, colonia, municipio" value="${reporte?.responsable_domicilio || ""}">
      </label>
      <div class="field-row">
        <label>Identificación
          <select id="f-responsable-id-tipo">
            <option value="credencial_elector" ${tipo === "credencial_elector" ? "selected" : ""}>Credencial de elector</option>
            <option value="manifestacion" ${tipo === "manifestacion" ? "selected" : ""}>Lo que manifieste</option>
            <option value="otro" ${tipo === "otro" ? "selected" : ""}>Otra identificación</option>
          </select>
        </label>
        <label>Folio / número de ID
          <input type="text" id="f-responsable-id-folio" placeholder="Clave o folio" value="${reporte?.responsable_id_folio || ""}">
        </label>
      </div>
      <label>Manifestación / observaciones de identidad
        <textarea id="f-responsable-manifestacion" rows="2" placeholder="Datos adicionales que manifieste el responsable…">${reporte?.responsable_manifestacion || ""}</textarea>
      </label>
    </div>
  `;
}

function etiquetasHallazgos(ids = []) {
  const mapa = Object.fromEntries(OPCIONES_HALLAZGOS.map((o) => [o.id, o.label]));
  return (ids || []).map((id) => mapa[id] || id);
}

function textoHallazgosParaPdf(reporte) {
  const checks = etiquetasHallazgos(reporte.hallazgos_checklist || []);
  const obs = (reporte.observaciones_adicionales || reporte.hallazgos || "").trim();
  const partes = [];
  if (checks.length) partes.push(checks.map((t) => `• ${t}`).join("\n"));
  if (obs) partes.push(`Observaciones adicionales:\n${obs}`);
  return partes.join("\n\n") || "Sin hallazgos registrados.";
}

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

function conTimeout(promesa, ms, mensaje) {
  return Promise.race([
    promesa,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(mensaje)), ms);
    }),
  ]);
}

async function comprimirImagen(file, maxAncho = 1024, calidad = 0.72) {
  try {
    let bitmap;
    if (typeof createImageBitmap === "function") {
      bitmap = await conTimeout(createImageBitmap(file), 8000, "Compresión de imagen agotó el tiempo");
    } else {
      throw new Error("createImageBitmap no disponible");
    }
    const escala = Math.min(1, maxAncho / bitmap.width);
    const w = Math.max(1, Math.round(bitmap.width * escala));
    const h = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", calidad));
    return blob || file;
  } catch (err) {
    console.warn("Compresión falló, se usa archivo original:", err?.message || err);
    return file;
  }
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
  const avisos = [];
  for (let i = 0; i < archivos.length; i += 1) {
    const file = archivos[i];
    const nombre = `foto_${Date.now()}_${i}.jpg`;
    try {
      const blob = await comprimirImagen(file, 1024, 0.7);
      try {
        const storageRef = ref(storage, `reportes_quema/${reporteId}/${nombre}`);
        await conTimeout(
          uploadBytes(storageRef, blob, { contentType: "image/jpeg" }),
          10000,
          "Storage no respondió a tiempo"
        );
        const url = await conTimeout(getDownloadURL(storageRef), 8000, "No se obtuvo URL de la foto");
        subidas.push({ url, nombre: file.name || nombre, contentType: "image/jpeg", origen: "storage" });
      } catch (errStorage) {
        // Miniatura ligera para no bloquear ni reventar el documento de Firestore.
        console.warn("Storage no disponible:", errStorage?.message || errStorage);
        const mini = await comprimirImagen(file, 640, 0.55);
        const dataUrl = await blobADataUrl(mini);
        if (typeof dataUrl === "string" && dataUrl.length < 450000) {
          subidas.push({ url: dataUrl, nombre: file.name || nombre, contentType: "image/jpeg", origen: "embebida" });
        } else {
          avisos.push(file.name || nombre);
        }
      }
    } catch (err) {
      console.warn("Foto omitida:", err?.message || err);
      avisos.push(file.name || `foto ${i + 1}`);
    }
  }
  return { fotos: subidas, avisos };
}

function payloadBaseReporte(data, verificacion) {
  return {
    origen_reporte: data.origen,
    direccion_reportada: data.direccion,
    nucleo_localidad: data.nucleo_localidad || "",
    descripcion: data.descripcion,
    hallazgos_checklist: data.hallazgos_checklist || [],
    observaciones_adicionales: data.observaciones_adicionales || "",
    hallazgos: textoHallazgosParaPdf({
      hallazgos_checklist: data.hallazgos_checklist,
      observaciones_adicionales: data.observaciones_adicionales,
    }),
    responsable_nombre: data.responsable_nombre || "",
    responsable_domicilio: data.responsable_domicilio || "",
    responsable_id_tipo: data.responsable_id_tipo || "",
    responsable_id_folio: data.responsable_id_folio || "",
    responsable_manifestacion: data.responsable_manifestacion || "",
    sancion_infracciones: data.sancion_infracciones || [],
    sancion_umas: data.sancion_umas || "",
    sancion_uma_valor: UMA_DIARIA_MXN,
    sancion_pesos: (Number(data.sancion_umas) > 0 ? calcularMultaPesos(data.sancion_umas) : 0),
    sancion_pesos_letra: (Number(data.sancion_umas) > 0 ? numeroALetrasPesos(calcularMultaPesos(data.sancion_umas)) : ""),
    sancion_observaciones: data.sancion_observaciones || "",
    atendido_por: data.atendidoPor,
    seguimiento: data.seguimiento || "",
  };
}

export async function crearReporte(data, verificacion, archivosFoto = []) {
  const folio = data.folio || generarFolioInspeccion(data.fechaHora || new Date());
  // Primero guarda el reporte (sin bloquear por fotos).
  const docRef = await addDoc(reportesCol, {
    folio,
    fecha_hora_reporte: Timestamp.fromDate(data.fechaHora),
    ubicacion_reportada: new GeoPoint(Number(data.lat), Number(data.lng)),
    horno_id_identificado: verificacion.horno ? doc(db, "hornos", verificacion.horno.id) : null,
    resultado_verificacion: verificacion.resultado,
    permiso_id_relacionado: verificacion.permiso ? doc(db, "permisos", verificacion.permiso.id) : null,
    fotos: [],
    origen_ubicacion: data.origen_ubicacion || "manual",
    ...payloadBaseReporte(data, verificacion),
  });

  let fotos = [];
  let avisos = [];
  if (archivosFoto.length) {
    try {
      const res = await subirFotosReporte(docRef.id, archivosFoto);
      fotos = res.fotos;
      avisos = res.avisos;
      if (fotos.length) await updateDoc(docRef, { fotos });
    } catch (err) {
      console.warn("No se pudieron adjuntar fotos, el reporte sí se guardó:", err?.message || err);
      avisos.push("todas");
    }
  }
  return { id: docRef.id, folio, fotos, avisos };
}

export async function actualizarReporte(id, data, archivosFoto = [], fotosExistentes = []) {
  const payload = { ...payloadBaseReporte(data) };
  if (archivosFoto.length) {
    try {
      const { fotos: nuevas } = await subirFotosReporte(id, archivosFoto);
      payload.fotos = [...fotosExistentes, ...nuevas].slice(0, MAX_FOTOS);
    } catch (err) {
      console.warn("Actualización sin nuevas fotos:", err?.message || err);
    }
  }
  return updateDoc(doc(db, "reportes_quema", id), payload);
}

export async function eliminarReporte(id) {
  return deleteDoc(doc(db, "reportes_quema", id));
}

export function renderTablaReportes(reportes, hornosById) {
  const tbody = document.querySelector("#tabla-reportes tbody");
  if (!reportes.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--text-muted);text-align:center;padding:24px">Sin reportes registrados.</td></tr>`;
    return;
  }
  tbody.innerHTML = reportes
    .map((r) => {
      const horno = hornosById[r.horno_id_identificado?.id];
      const lugar = r.nucleo_localidad || r.direccion_reportada || "—";
      return `
      <tr>
        <td style="font-family:var(--font-mono);font-weight:600">${r.folio || "—"}</td>
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
  const folioMostrar = reporte?.folio || (editando ? "—" : "Se asignará al guardar");
  return `
    <div class="form-inspeccion">
      <div class="form-inspeccion-header">
        <img src="assets/logo-imbio.jpg" alt="IMBIO" class="form-inspeccion-logo">
        <div>
          <strong>IMBIO · Control de Quema</strong>
          <span>Instituto Municipal de Biodiversidad y Protección Ambiental</span>
          <span>H. Ayuntamiento de Pabellón de Arteaga</span>
        </div>
      </div>

      <div class="folio-inspeccion-box">
        <span>Folio de inspección</span>
        <strong id="f-folio-display">${folioMostrar}</strong>
      </div>

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
            <label>Dirección aproximada del predio / horno
        <input type="text" id="f-direccion" value="${reporte?.direccion_reportada || ""}">
      </label>

      ${bloqueResponsableHtml(reporte)}

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
      ${checklistHallazgosHtml(reporte?.hallazgos_checklist || [])}
      <label>Observaciones adicionales
        <textarea id="f-observaciones" rows="2" placeholder="Detalle libre del inspector…">${reporte?.observaciones_adicionales || ""}</textarea>
      </label>
      <label>Atendido por (inspector)
        <input type="text" id="f-atendido" value="${reporte?.atendido_por || ""}">
      </label>
      <label>Seguimiento / acción tomada
        <textarea id="f-seguimiento" rows="2">${reporte?.seguimiento || ""}</textarea>
      </label>

      ${checklistSancionHtml(
        reporte?.sancion_infracciones || [],
        reporte?.sancion_umas || "",
        reporte?.sancion_observaciones || ""
      )}

      <div class="fotos-bloque">
        <div class="hallazgos-label">Fotografías de la inspección (máx. ${MAX_FOTOS})</div>
        <div class="fotos-acciones">
          <button type="button" class="btn btn-primary" id="f-btn-camara">📷 Tomar foto</button>
          <button type="button" class="btn btn-secondary" id="f-btn-galeria">🖼️ Galería</button>
        </div>
        <input type="file" id="f-fotos-camara" accept="image/*" capture="environment" hidden>
        <input type="file" id="f-fotos-galeria" accept="image/*" multiple hidden>
        <div class="fotos-preview" id="f-fotos-preview">
          ${fotosExistentes
            .map(
              (f) => `<div class="foto-thumb existente"><img src="${f.url}" alt="foto"></div>`
            )
            .join("")}
        </div>
        <p class="geo-hint" id="f-fotos-count">${fotosExistentes.length} foto(s) guardada(s)</p>
      </div>

      <div class="form-acciones-fila">
        <button class="btn btn-primary" id="f-verificar">${editando ? "💾 Guardar cambios" : "🔍 Verificar y guardar"}</button>
        ${
          editando
            ? `<button type="button" class="btn btn-secondary" id="f-pdf">📋 Acta de inspección</button>
               <button type="button" class="btn btn-secondary" id="f-pdf-sancion">⚖️ Acta de sanción</button>`
            : ""
        }
      </div>
      <div id="f-resultado" style="margin-top:6px;"></div>
    </div>
  `;
}

function conectarFotosPreview(fotosYaGuardadas = 0) {
  const preview = document.getElementById("f-fotos-preview");
  const camara = document.getElementById("f-fotos-camara");
  const galeria = document.getElementById("f-fotos-galeria");
  const contador = document.getElementById("f-fotos-count");
  const serverHtml = preview.innerHTML;
  let acumulados = [];

  function pintar() {
    preview.innerHTML = serverHtml;
    acumulados.forEach((file, idx) => {
      const div = document.createElement("div");
      div.className = "foto-thumb";
      div.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="nueva"><button type="button" class="foto-quitar" data-idx="${idx}" title="Quitar">×</button>`;
      preview.appendChild(div);
    });
    if (contador) {
      contador.textContent = `${fotosYaGuardadas + acumulados.length} de ${MAX_FOTOS} foto(s)`;
    }
    preview.querySelectorAll(".foto-quitar").forEach((btn) => {
      btn.addEventListener("click", () => {
        acumulados.splice(Number(btn.dataset.idx), 1);
        pintar();
      });
    });
  }

  function agregarArchivos(lista) {
    const cupo = Math.max(0, MAX_FOTOS - fotosYaGuardadas - acumulados.length);
    const nuevos = Array.from(lista || []).slice(0, cupo);
    if ((lista?.length || 0) > cupo) {
      window.alert(`Solo se permiten ${MAX_FOTOS} fotografías en total.`);
    }
    acumulados = acumulados.concat(nuevos);
    pintar();
  }

  document.getElementById("f-btn-camara")?.addEventListener("click", () => camara.click());
  document.getElementById("f-btn-galeria")?.addEventListener("click", () => galeria.click());
  camara?.addEventListener("change", () => {
    if (camara.files?.length) agregarArchivos(camara.files);
    camara.value = "";
  });
  galeria?.addEventListener("change", () => {
    if (galeria.files?.length) agregarArchivos(galeria.files);
    galeria.value = "";
  });

  pintar();
  return () => acumulados;
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
  const hallazgos_checklist = Array.from(document.querySelectorAll(".f-hallazgo:checked")).map(
    (el) => el.value
  );
  const sancion_infracciones = Array.from(document.querySelectorAll(".f-sancion:checked")).map(
    (el) => el.value
  );
  return {
    origen: document.getElementById("f-origen").value,
    nucleo_localidad: document.getElementById("f-nucleo").value.trim(),
    direccion: document.getElementById("f-direccion").value.trim(),
    lat: document.getElementById("f-lat").value,
    lng: document.getElementById("f-lng").value,
    descripcion: document.getElementById("f-descripcion").value.trim(),
    hallazgos_checklist,
    observaciones_adicionales: document.getElementById("f-observaciones").value.trim(),
    responsable_nombre: document.getElementById("f-responsable-nombre")?.value.trim() || "",
    responsable_domicilio: document.getElementById("f-responsable-domicilio")?.value.trim() || "",
    responsable_id_tipo: document.getElementById("f-responsable-id-tipo")?.value || "",
    responsable_id_folio: document.getElementById("f-responsable-id-folio")?.value.trim() || "",
    responsable_manifestacion: document.getElementById("f-responsable-manifestacion")?.value.trim() || "",
    sancion_infracciones,
    sancion_umas: document.getElementById("f-sancion-umas")?.value || "",
    sancion_observaciones: document.getElementById("f-sancion-obs")?.value.trim() || "",
    atendidoPor: document.getElementById("f-atendido").value.trim(),
    seguimiento: document.getElementById("f-seguimiento").value.trim(),
  };
}

export function abrirFormularioReporte(onGuardado) {
  abrirModal("🔥 Inspección / reporte de quema", formInspeccionHtml(null));
  const getOrigenUbicacion = conectarMapaYGps(false);
  const getArchivos = conectarFotosPreview(0);
  conectarCalculadoraUma();

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
      const folio = generarFolioInspeccion(fechaHora);
      const display = document.getElementById("f-folio-display");
      if (display) display.textContent = folio;

      const verificacion = await verificarReporte({ lat, lng, fechaHora });
      document.getElementById("f-resultado").innerHTML =
        `Resultado: ${pillHtml(verificacion.resultado)}`;

      const { id, fotos, avisos } = await crearReporte(
        {
          ...campos,
          folio,
          fechaHora,
          origen_ubicacion: getOrigenUbicacion(),
        },
        verificacion,
        getArchivos()
      );

      const reporteGuardado = {
        id,
        folio,
        fecha_hora_reporte: fechaHora,
        origen_reporte: campos.origen,
        nucleo_localidad: campos.nucleo_localidad,
        direccion_reportada: campos.direccion,
        ubicacion_reportada: { latitude: lat, longitude: lng },
        descripcion: campos.descripcion,
        hallazgos_checklist: campos.hallazgos_checklist,
        observaciones_adicionales: campos.observaciones_adicionales,
        hallazgos: textoHallazgosParaPdf(campos),
        sancion_infracciones: campos.sancion_infracciones,
        sancion_umas: campos.sancion_umas,
        sancion_observaciones: campos.sancion_observaciones,
        atendido_por: campos.atendidoPor,
        seguimiento: campos.seguimiento,
        resultado_verificacion: verificacion.resultado,
        fotos,
      };

      const avisoFotos = avisos?.length
        ? `<p class="geo-hint">Aviso: algunas fotos no se pudieron almacenar (${avisos.length}). El reporte sí quedó guardado.</p>`
        : "";

      document.getElementById("f-resultado").innerHTML = `
        <strong>Folio ${folio}</strong> · Resultado: ${pillHtml(verificacion.resultado)}
        ${avisoFotos}
        <div class="form-acciones-fila" style="margin-top:10px">
          <button type="button" class="btn btn-secondary" id="f-pdf-ahora">📋 Acta de inspección</button>
          <button type="button" class="btn btn-secondary" id="f-pdf-sancion-ahora">⚖️ Acta de sanción</button>
        </div>`;
      document.getElementById("f-pdf-ahora")?.addEventListener("click", () => {
        generarPdfInspeccion(reporteGuardado, verificacion.horno);
      });
      document.getElementById("f-pdf-sancion-ahora")?.addEventListener("click", () => {
        generarPdfSancion(reporteGuardado, verificacion.horno);
      });

      setTimeout(() => {
        cerrarModal();
        onGuardado && onGuardado();
      }, 1800);
    } catch (err) {
      console.error(err);
      window.alert("No se pudo guardar el reporte: " + (err.message || err));
    } finally {
      btn.disabled = false;
      btn.textContent = "🔍 Verificar y guardar";
    }
  });
}

export function abrirFormularioEditarReporte(reporte, onGuardado, horno) {
  abrirModal("✏️ Editar inspección / reporte", formInspeccionHtml(reporte));
  conectarMapaYGps(true);
  conectarCalculadoraUma();
  const fotosExistentes = Array.isArray(reporte.fotos) ? reporte.fotos : [];
  const getArchivos = conectarFotosPreview(fotosExistentes.length);

  document.getElementById("f-pdf")?.addEventListener("click", () => {
    generarPdfInspeccion(reporte, horno);
  });
  document.getElementById("f-pdf-sancion")?.addEventListener("click", () => {
    generarPdfSancion(reporte, horno);
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

export { generarPdfInspeccion, generarPdfSancion };
