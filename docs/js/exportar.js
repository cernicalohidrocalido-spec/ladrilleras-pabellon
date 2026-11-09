import { calcularEstadoPermiso, formatFecha, formatFechaHora } from "./utils.js?v=30";

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
      "Núcleo / localidad": p.nucleo_localidad || "",
      "Ubicación": p.nucleo_localidad || horno.direccion || "",
      "Propietario": horno.propietario_nombre || "",
      "Fecha registro": formatFecha(p.fecha_registro || p.fecha_solicitud || p.fecha_autorizacion || p.fecha_vigencia_inicio),
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
      "Folio": r.folio || "",
      "Fecha y hora": formatFechaHora(r.fecha_hora_reporte),
      "Origen": r.origen_reporte || "",
      "Núcleo / localidad": r.nucleo_localidad || "",
      "Dirección reportada": r.direccion_reportada || "",
      "Horno identificado": horno ? horno.nombre_referencia : "No identificado",
      "Resultado": ETIQUETA_RESULTADO[r.resultado_verificacion] || r.resultado_verificacion,
      "Descripción": r.descripcion || "",
      "Hallazgos": Array.isArray(r.hallazgos_checklist) && r.hallazgos_checklist.length
        ? r.hallazgos_checklist.join(", ")
        : (r.hallazgos || ""),
      "Observaciones adicionales": r.observaciones_adicionales || "",
      "Atendido por": r.atendido_por || "",
      "Seguimiento": r.seguimiento || "",
      "Fotos": Array.isArray(r.fotos) ? r.fotos.length : 0,
    };
  });
  descargarHoja(filas, "Reportes", `reportes_quema_${Date.now()}.xlsx`);
}
