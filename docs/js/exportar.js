import { calcularEstadoPermiso, formatFecha, formatFechaHora } from "./utils.js?v=3";

const ETIQUETA_ESTADO = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencido: "Vencido",
};

const ETIQUETA_RESULTADO = {
  con_permiso_vigente: "Con permiso",
  sin_permiso: "Sin permiso",
  fuera_de_horario: "Fuera de horario",
  no_identificado: "No identificado",
};

function descargarHoja(filas, nombreHoja, nombreArchivo) {
  const hoja = XLSX.utils.json_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
  XLSX.writeFile(libro, nombreArchivo);
}

export function exportarHornos(hornos) {
  const filas = hornos.map((h) => ({
    "Referencia": h.nombre_referencia || "",
    "Propietario": h.propietario_nombre || "",
    "Contacto": h.propietario_contacto || "",
    "Dirección": h.direccion || "",
    "Tipo de horno": h.tipo_horno || "",
    "Combustible habitual": h.combustible_habitual || "",
    "Estado": h.estado || "",
    "Latitud": h.ubicacion?.latitude ?? "",
    "Longitud": h.ubicacion?.longitude ?? "",
    "Fecha de registro": formatFecha(h.fecha_registro),
  }));
  descargarHoja(filas, "Hornos", `hornos_${Date.now()}.xlsx`);
}

export function exportarPermisos(permisos, hornosById) {
  const filas = permisos.map((p) => {
    const horno = hornosById[p.horno_id?.id] || {};
    const estado = calcularEstadoPermiso(p);
    return {
      "Folio": p.folio || "",
      "Horno": horno.nombre_referencia || "",
      "Propietario": horno.propietario_nombre || "",
      "Fecha solicitud": formatFecha(p.fecha_solicitud),
      "Vigencia inicio": formatFecha(p.fecha_vigencia_inicio),
      "Vigencia fin": formatFecha(p.fecha_vigencia_fin),
      "Días autorizados": (p.dias_autorizados || []).join(", "),
      "Horario": p.horario_autorizado ? `${p.horario_autorizado.inicio}–${p.horario_autorizado.fin}` : "",
      "Combustible autorizado": p.combustible_autorizado || "",
      "Estado": ETIQUETA_ESTADO[estado] || estado,
      "Autorizado por": p.autorizado_por || "",
    };
  });
  descargarHoja(filas, "Permisos", `permisos_${Date.now()}.xlsx`);
}

export function exportarReportes(reportes, hornosById) {
  const filas = reportes.map((r) => {
    const horno = hornosById[r.horno_id_identificado?.id];
    return {
      "Fecha y hora": formatFechaHora(r.fecha_hora_reporte),
      "Origen": r.origen_reporte || "",
      "Dirección reportada": r.direccion_reportada || "",
      "Horno identificado": horno ? horno.nombre_referencia : "No identificado",
      "Resultado": ETIQUETA_RESULTADO[r.resultado_verificacion] || r.resultado_verificacion,
      "Descripción": r.descripcion || "",
      "Atendido por": r.atendido_por || "",
      "Seguimiento": r.seguimiento || "",
    };
  });
  descargarHoja(filas, "Reportes", `reportes_quema_${Date.now()}.xlsx`);
}
