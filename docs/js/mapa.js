import { calcularEstadoPermiso } from "./utils.js";

let mapaInstancia = null;

const COLOR_ESTADO = {
  vigente: "#7C9070",
  por_vencer: "#D9A441",
  vencido: "#C4501F",
};

export function inicializarMapa() {
  if (mapaInstancia) return mapaInstancia;
  mapaInstancia = L.map("mapa", { zoomControl: true }).setView([22.1500, -102.1300], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(mapaInstancia);

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
