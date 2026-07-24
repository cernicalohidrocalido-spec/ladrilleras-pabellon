import { calcularEstadoPermiso } from "./utils.js?v=6";

// Coordenadas reales de la cabecera municipal de Pabellón de Arteaga, Ags.
export const CENTRO_PABELLON = [22.1492, -102.2765];

let mapaInstancia = null;
let capasMapaPrincipal = null;

const COLOR_ESTADO = {
  vigente: "#0B7A34",
  por_vencer: "#C77E12",
  vencido: "#B23A2A",
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
