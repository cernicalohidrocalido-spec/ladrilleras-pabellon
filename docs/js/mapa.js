import { calcularEstadoPermiso } from "./utils.js";

let mapaInstancia = null;

const COLOR_ESTADO = {
  vigente: "#0B7A34",
  por_vencer: "#C77E12",
  vencido: "#B23A2A",
};

// Crea las capas base (calles / satélite) y su control de capas.
// Reutilizable por cualquier mapa Leaflet del dashboard.
export function agregarCapasBase(mapa) {
  const calles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  });

  const satelital = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics" }
  );

  calles.addTo(mapa);

  L.control
    .layers(
      { "Calles": calles, "Satélite": satelital },
      {},
      { position: "topright", collapsed: false }
    )
    .addTo(mapa);

  return mapa;
}

export function inicializarMapa() {
  if (mapaInstancia) return mapaInstancia;
  mapaInstancia = L.map("mapa", { zoomControl: true }).setView([22.1500, -102.1300], 12);
  agregarCapasBase(mapaInstancia);
  return mapaInstancia;
}

export function pintarHornosEnMapa(hornos, permisosPorHorno) {
  const mapa = inicializarMapa();

  // Limpia marcadores previos
  mapa.eachLayer((layer) => {
    if (layer instanceof L.CircleMarker) mapa.removeLayer(layer);
  });

  hornos.forEach((h) => {
    if (!h.ubicacion) return;
    const permisos = permisosPorHorno[h.id] || [];
    const vigente = permisos.find((p) => calcularEstadoPermiso(p) !== "vencido");
    const estado = vigente ? calcularEstadoPermiso(vigente) : "vencido";

    L.circleMarker([h.ubicacion.latitude, h.ubicacion.longitude], {
      radius: 8,
      color: COLOR_ESTADO[estado],
      fillColor: COLOR_ESTADO[estado],
      fillOpacity: 0.8,
      weight: 2,
    })
      .addTo(mapa)
      .bindPopup(
        `<strong>${h.nombre_referencia || "Horno"}</strong><br>${h.direccion || ""}<br>Estado: ${estado.replace("_", " ")}`
      );
  });
}

// --- Mapa selector de ubicación (para el formulario de alta de horno) ---
let mapaPickerInstancia = null;
let marcadorPicker = null;

export function inicializarMapaPicker(contenedorId, onUbicacionElegida, centroInicial) {
  // Si ya existe una instancia previa (modal reabierto), la destruye primero.
  if (mapaPickerInstancia) {
    mapaPickerInstancia.remove();
    mapaPickerInstancia = null;
    marcadorPicker = null;
  }

  const centro = centroInicial || [22.1500, -102.1300];
  mapaPickerInstancia = L.map(contenedorId, { zoomControl: true }).setView(centro, 13);
  agregarCapasBase(mapaPickerInstancia);

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
