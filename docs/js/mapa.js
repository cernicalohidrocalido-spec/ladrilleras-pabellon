import { calcularEstadoPermiso, formatFecha } from "./utils.js?v=30";

// Coordenadas reales de la cabecera municipal de Pabellón de Arteaga, Ags.
export const CENTRO_PABELLON = [22.1492, -102.2765];

let mapaInstancia = null;
let capasMapaPrincipal = null;
let capaMarcadores = null;
let marcadoresPorHorno = new Map();
let cacheMapa = { hornos: [], permisosPorHorno: {}, callbacks: {}, filtros: null };

const COLOR_ESTADO = {
  vigente: "#0B7A34",
  por_vencer: "#C77E12",
  vencido: "#B23A2A",
};

const ETIQUETA_ESTADO = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencido: "Vencido / sin permiso",
};

// Crea (sin añadir aún) las dos capas base. No usa ningún control flotante
// de Leaflet — el toggle se maneja con botones normales de HTML, fuera del
// mapa, para que nunca puedan interferir con el clic o el arrastre del mapa.
export function crearCapasBase() {
  const calles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  });

  const satelital = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics",
      maxNativeZoom: 18,
      maxZoom: 19,
    }
  );

  return { calles, satelital };
}

// Conecta un par de botones HTML (fuera del mapa) para alternar entre capas.
export function conectarBotonesCapas(botonCallesId, botonSatelitalId, mapa, capas) {
  const btnCalles = document.getElementById(botonCallesId);
  const btnSatelital = document.getElementById(botonSatelitalId);
  if (!btnCalles || !btnSatelital) return;

  function activar(tipo) {
    btnCalles.classList.toggle("activa", tipo === "calles");
    btnSatelital.classList.toggle("activa", tipo === "satelital");

    if (tipo === "satelital") {
      if (mapa.hasLayer(capas.calles)) mapa.removeLayer(capas.calles);
      if (!mapa.hasLayer(capas.satelital)) mapa.addLayer(capas.satelital);
    } else {
      if (mapa.hasLayer(capas.satelital)) mapa.removeLayer(capas.satelital);
      if (!mapa.hasLayer(capas.calles)) mapa.addLayer(capas.calles);
    }
  }

  btnCalles.addEventListener("click", () => activar("calles"));
  btnSatelital.addEventListener("click", () => activar("satelital"));
}

export function inicializarMapa() {
  if (mapaInstancia) return mapaInstancia;
  mapaInstancia = L.map("mapa", { zoomControl: true }).setView(CENTRO_PABELLON, 14);
  capasMapaPrincipal = crearCapasBase();
  capasMapaPrincipal.calles.addTo(mapaInstancia);
  conectarBotonesCapas("btn-capa-calles", "btn-capa-satelital", mapaInstancia, capasMapaPrincipal);
  capaMarcadores = L.layerGroup().addTo(mapaInstancia);
  return mapaInstancia;
}

function estadoHorno(permisos) {
  if (!permisos.length) return { estado: "vencido", permiso: null };
  const ordenados = [...permisos].sort((a, b) => {
    const rank = { vigente: 0, por_vencer: 1, vencido: 2 };
    return (rank[calcularEstadoPermiso(a)] ?? 9) - (rank[calcularEstadoPermiso(b)] ?? 9);
  });
  const permiso = ordenados[0];
  return { estado: calcularEstadoPermiso(permiso), permiso };
}

function tooltipHtml(horno, estado, permiso) {
  const dias = (permiso?.dias_autorizados || []).join(", ") || "—";
  const horario = permiso?.horario_autorizado
    ? `${permiso.horario_autorizado.inicio || "—"} – ${permiso.horario_autorizado.fin || "—"}`
    : "—";
  return `
    <div class="mapa-tooltip">
      <strong>${horno.nombre_referencia || "Horno"}</strong>
      <div><span>Propietario</span>${horno.propietario_nombre || "—"}</div>
      <div><span>Dirección</span>${horno.direccion || "—"}</div>
      <div><span>Combustible</span>${horno.combustible_habitual || permiso?.combustible_autorizado || "—"}</div>
      <div><span>Estado</span>${ETIQUETA_ESTADO[estado] || estado}</div>
      <div><span>Folio</span>${permiso?.folio || "Sin permiso"}</div>
      <div><span>Vigencia</span>${permiso ? `${formatFecha(permiso.fecha_vigencia_inicio)} – ${formatFecha(permiso.fecha_vigencia_fin)}` : "—"}</div>
      <div><span>Días</span>${dias}</div>
      <div><span>Horario</span>${horario}</div>
    </div>
  `;
}

function leerFiltrosActivos() {
  const chips = document.querySelectorAll("#mapa-filtros-estado .filtro-chip.active");
  if (!chips.length) return new Set(["vigente", "por_vencer", "vencido"]);
  return new Set(Array.from(chips).map((c) => c.dataset.estado));
}

export function pintarHornosEnMapa(hornos, permisosPorHorno, callbacks = {}) {
  const mapa = inicializarMapa();
  cacheMapa = {
    hornos,
    permisosPorHorno,
    callbacks,
    filtros: cacheMapa.filtros || leerFiltrosActivos(),
  };

  if (capaMarcadores) capaMarcadores.clearLayers();
  else capaMarcadores = L.layerGroup().addTo(mapa);
  marcadoresPorHorno.clear();

  const filtros = cacheMapa.filtros;
  let visibles = 0;

  hornos.forEach((h) => {
    if (!h.ubicacion) return;
    const permisos = permisosPorHorno[h.id] || [];
    const { estado, permiso } = estadoHorno(permisos);
    if (!filtros.has(estado)) return;
    visibles += 1;

    const popupEl = document.createElement("div");
    popupEl.className = "mapa-popup";
    popupEl.innerHTML = `
      <strong>${h.nombre_referencia || "Horno"}</strong>
      <div class="mapa-popup-meta">${h.propietario_nombre || ""}</div>
      <div class="mapa-popup-meta">${h.direccion || ""}</div>
      <div class="mapa-popup-meta">Estado: ${ETIQUETA_ESTADO[estado] || estado}</div>
      <div class="mapa-popup-meta">Folio: ${permiso?.folio || "Sin permiso"}</div>
      <div class="mapa-popup-acciones">
        <button type="button" class="mapa-popup-btn" data-accion="ver">👁️ Ficha completa</button>
        <button type="button" class="mapa-popup-btn" data-accion="editar">✏️ Editar</button>
      </div>
    `;
    popupEl.querySelector('[data-accion="ver"]').addEventListener("click", () => {
      mapa.closePopup();
      callbacks.onVer && callbacks.onVer(h);
    });
    popupEl.querySelector('[data-accion="editar"]').addEventListener("click", () => {
      mapa.closePopup();
      callbacks.onEditar && callbacks.onEditar(h);
    });

    const marker = L.circleMarker([h.ubicacion.latitude, h.ubicacion.longitude], {
      radius: 9,
      color: COLOR_ESTADO[estado],
      fillColor: COLOR_ESTADO[estado],
      fillOpacity: 0.85,
      weight: 2,
    });

    marker.bindTooltip(tooltipHtml(h, estado, permiso), {
      direction: "top",
      offset: [0, -10],
      sticky: true,
      opacity: 1,
      className: "mapa-tooltip-wrap",
    });
    marker.bindPopup(popupEl);
    marker.on("mouseover", function () {
      this.setStyle({ radius: 12, weight: 3 });
    });
    marker.on("mouseout", function () {
      this.setStyle({ radius: 9, weight: 2 });
    });

    capaMarcadores.addLayer(marker);
    marcadoresPorHorno.set(h.id, marker);
  });

  const contador = document.getElementById("mapa-filtro-count");
  if (contador) {
    contador.textContent = `${visibles} de ${hornos.filter((h) => h.ubicacion).length} hornos visibles`;
  }
}

/** Asegura que el filtro del estado del horno esté activo y centra el mapa en él. */
export function enfocarHornoEnMapa(hornoId) {
  const mapa = inicializarMapa();
  const horno = cacheMapa.hornos.find((h) => h.id === hornoId);
  if (!horno?.ubicacion) return false;

  const permisos = cacheMapa.permisosPorHorno[hornoId] || [];
  const { estado } = estadoHorno(permisos);
  const filtros = cacheMapa.filtros || leerFiltrosActivos();
  if (!filtros.has(estado)) {
    const chip = document.querySelector(`#mapa-filtros-estado .filtro-chip[data-estado="${estado}"]`);
    if (chip) chip.classList.add("active");
    aplicarFiltrosMapa([...filtros, estado]);
  }

  const latlng = [horno.ubicacion.latitude, horno.ubicacion.longitude];
  requestAnimationFrame(() => {
    mapa.invalidateSize();
    mapa.flyTo(latlng, 17, { duration: 0.7 });
    const marker = marcadoresPorHorno.get(hornoId);
    if (marker) {
      setTimeout(() => marker.openPopup(), 750);
    }
  });
  return true;
}

export function aplicarFiltrosMapa(estadosActivos) {
  cacheMapa.filtros = new Set(estadosActivos);
  if (!cacheMapa.hornos.length) return;
  pintarHornosEnMapa(cacheMapa.hornos, cacheMapa.permisosPorHorno, cacheMapa.callbacks);
}

export function conectarFiltrosMapa() {
  const grupo = document.getElementById("mapa-filtros-estado");
  if (!grupo || grupo.dataset.bound === "1") return;
  grupo.dataset.bound = "1";

  grupo.addEventListener("click", (e) => {
    const chip = e.target.closest(".filtro-chip");
    if (!chip) return;
    chip.classList.toggle("active");
    const activos = Array.from(grupo.querySelectorAll(".filtro-chip.active")).map((c) => c.dataset.estado);
    // Evita dejar el mapa vacío: si quitan todos, reactivar el clicoteado.
    if (!activos.length) {
      chip.classList.add("active");
      return;
    }
    aplicarFiltrosMapa(activos);
  });
}

// --- Mapa selector de ubicación (para el formulario de alta de horno) ---
let mapaPickerInstancia = null;
let marcadorPicker = null;

export function inicializarMapaPicker(contenedorId, onUbicacionElegida, centroInicial, botonesCapasIds) {
  // Si ya existe una instancia previa (modal reabierto), la destruye primero.
  if (mapaPickerInstancia) {
    mapaPickerInstancia.remove();
    mapaPickerInstancia = null;
    marcadorPicker = null;
  }

  const centro = centroInicial || CENTRO_PABELLON;
  mapaPickerInstancia = L.map(contenedorId, { zoomControl: true }).setView(centro, 15);

  const capas = crearCapasBase();
  capas.calles.addTo(mapaPickerInstancia);
  if (botonesCapasIds) {
    conectarBotonesCapas(botonesCapasIds.calles, botonesCapasIds.satelital, mapaPickerInstancia, capas);
  }

  function colocarMarcador(lat, lng) {
    if (marcadorPicker) {
      marcadorPicker.setLatLng([lat, lng]);
    } else {
      marcadorPicker = L.marker([lat, lng], { draggable: true }).addTo(mapaPickerInstancia);
      marcadorPicker.on("dragend", () => {
        const pos = marcadorPicker.getLatLng();
        onUbicacionElegida(pos.lat, pos.lng);
      });
    }
    onUbicacionElegida(lat, lng);
  }

  mapaPickerInstancia.on("click", (e) => {
    colocarMarcador(e.latlng.lat, e.latlng.lng);
  });

  // Si ya había coordenadas (ej. editando), coloca el marcador de una vez.
  if (centroInicial) {
    colocarMarcador(centroInicial[0], centroInicial[1]);
  }

  // Leaflet necesita recalcular el tamaño si el contenedor estaba oculto al crearse.
  setTimeout(() => mapaPickerInstancia.invalidateSize(), 150);

  return mapaPickerInstancia;
}

export function actualizarMarcadorPicker(lat, lng) {
  if (!mapaPickerInstancia) return;
  if (marcadorPicker) {
    marcadorPicker.setLatLng([lat, lng]);
  } else {
    marcadorPicker = L.marker([lat, lng], { draggable: true }).addTo(mapaPickerInstancia);
  }
  mapaPickerInstancia.setView([lat, lng], mapaPickerInstancia.getZoom());
}
