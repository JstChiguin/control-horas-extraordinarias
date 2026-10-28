export const VERSION = '1.0.0';
export const FIRMA = 'by Chiguin';

export const configuracionInicial = {
  limiteLaboral: 0,
  limiteEspecial: 0,
  horario: [
    { activo: false, entrada: '00:00', salida: '00:00' },
    { activo: true, entrada: '08:00', salida: '16:00' },
    { activo: true, entrada: '08:00', salida: '16:00' },
    { activo: true, entrada: '08:00', salida: '16:00' },
    { activo: true, entrada: '08:00', salida: '16:00' },
    { activo: true, entrada: '08:00', salida: '15:00' },
    { activo: false, entrada: '00:00', salida: '00:00' }
  ],
  festivos: []
};

export function minutosDeHora(valor) {
  if (!/^\d{1,2}:\d{2}$/.test(String(valor || '').trim())) return null;
  const [hora, minuto] = valor.trim().split(':').map(Number);
  return hora < 24 && minuto < 60 ? hora * 60 + minuto : null;
}

export function formatearMinutos(cantidad) {
  const signo = cantidad < 0 ? '−' : '';
  const absoluto = Math.abs(Math.round(cantidad));
  return `${signo}${Math.floor(absoluto / 60)} h ${String(absoluto % 60).padStart(2, '0')} min`;
}

export function fechaISO(valor) {
  const texto = String(valor || '').trim();
  let anio, mes, dia;
  let coincidencia = texto.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (coincidencia) [, dia, mes, anio] = coincidencia;
  else {
    coincidencia = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!coincidencia) return null;
    [, anio, mes, dia] = coincidencia;
  }
  const fecha = new Date(Date.UTC(+anio, +mes - 1, +dia));
  if (fecha.getUTCFullYear() !== +anio || fecha.getUTCMonth() !== +mes - 1 || fecha.getUTCDate() !== +dia) return null;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function extraerFila(linea) {
  const fecha = linea.match(/(?:\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b)/);
  if (!fecha) return null;
  const resto = linea.slice(fecha.index + fecha[0].length);
  const horas = [...resto.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)].map(coincidencia => `${coincidencia[1].padStart(2, '0')}:${coincidencia[2]}`);
  if (horas.length < 2) return { fecha: fechaISO(fecha[0]), error: 'Falta hora de entrada o salida' };
  return { fecha: fechaISO(fecha[0]), entrada: horas[0], salida: horas[1] };
}

export function interpretarTexto(texto) {
  const registros = [];
  const errores = [];
  const vistos = new Map();
  String(texto).split(/\r?\n/).forEach((linea, indice) => {
    const fila = extraerFila(linea);
    if (!fila) return;
    if (!fila.fecha || fila.error) {
      errores.push(`Línea ${indice + 1}: ${fila.error || 'fecha inválida'}`);
      return;
    }
    if (vistos.has(fila.fecha)) {
      registros[vistos.get(fila.fecha)] = fila;
    } else {
      vistos.set(fila.fecha, registros.length);
      registros.push(fila);
    }
  });
  return { registros: registros.sort((a, b) => a.fecha.localeCompare(b.fecha)), errores };
}

export function calcularRegistro(registro, configuracion) {
  const fecha = fechaISO(registro.fecha);
  const entrada = minutosDeHora(registro.entrada);
  const salida = minutosDeHora(registro.salida);
  if (!fecha || entrada === null || salida === null) return { ...registro, error: 'Registro incompleto o inválido', minutos: 0 };
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  const especial = dia === 0 || dia === 6 || configuracion.festivos.includes(fecha);
  const jornada = configuracion.horario[dia];
  if (salida < entrada) return { ...registro, error: 'Salida anterior a entrada; revisar marcación', minutos: 0, especial };
  const minutos = especial ? salida - entrada : jornada?.activo ? Math.max(0, salida - minutosDeHora(jornada.salida)) : 0;
  return { ...registro, especial, minutos, error: salida === entrada ? 'Entrada y salida iguales; verificar' : null };
}

export function resumir(registros, configuracion, mes) {
  const detalles = registros.filter(fila => fila.fecha.startsWith(mes)).map(fila => calcularRegistro(fila, configuracion));
  const laboral = detalles.filter(fila => !fila.especial).reduce((suma, fila) => suma + fila.minutos, 0);
  const especial = detalles.filter(fila => fila.especial).reduce((suma, fila) => suma + fila.minutos, 0);
  return {
    laboral: { acumulado: laboral, limite: Number(configuracion.limiteLaboral) * 60, disponible: Number(configuracion.limiteLaboral) * 60 - laboral },
    especial: { acumulado: especial, limite: Number(configuracion.limiteEspecial) * 60, disponible: Number(configuracion.limiteEspecial) * 60 - especial },
    detalles
  };
}
