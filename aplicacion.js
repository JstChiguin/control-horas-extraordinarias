import { VERSION, FIRMA, configuracionInicial, fechaISO, interpretarTexto, resumir, formatearMinutos } from './calculos.mjs';

const $ = identificador => document.getElementById(identificador);
const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const claveRegistros = 'chiguin_horas_registros_v1';
const claveConfiguracion = 'chiguin_horas_config_v1';
const leerAlmacenado = (clave, defecto) => {
  try { return JSON.parse(localStorage.getItem(clave)) ?? defecto; } catch { return defecto; }
};
let registros = leerAlmacenado(claveRegistros, []);
let configuraciones = leerAlmacenado(claveConfiguracion, {});
let configuracion = null;

function mesActual() {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

function guardarRegistros() {
  localStorage.setItem(claveRegistros, JSON.stringify(registros));
}

function configuracionDelMes(mes) {
  return structuredClone(configuraciones[mes] || configuracionInicial);
}

function cargarConfiguracion() {
  configuracion = configuracionDelMes($('mes').value);
  $('limiteLaboral').value = configuracion.limiteLaboral;
  $('limiteEspecial').value = configuracion.limiteEspecial;
  $('festivos').value = configuracion.festivos.map(fecha => fecha.split('-').reverse().join('/')).join('\n');
  $('horarios').replaceChildren();
  configuracion.horario.forEach((jornada, dia) => {
    const fila = document.createElement('div');
    fila.className = `horario${jornada.activo ? '' : ' inactivo'}`;
    const nombre = document.createElement('span');
    nombre.className = 'nombre-dia';
    nombre.textContent = nombresDias[dia];
    const activo = document.createElement('input');
    activo.type = 'checkbox';
    activo.checked = jornada.activo;
    activo.title = `Jornada habitual activa el ${nombresDias[dia]}`;
    activo.addEventListener('change', () => fila.classList.toggle('inactivo', !activo.checked));
    const entrada = document.createElement('input');
    entrada.type = 'time';
    entrada.value = jornada.entrada;
    entrada.title = `Entrada habitual ${nombresDias[dia]}`;
    const salida = document.createElement('input');
    salida.type = 'time';
    salida.value = jornada.salida;
    salida.title = `Salida habitual ${nombresDias[dia]}`;
    fila.append(nombre, activo, entrada, salida);
    $('horarios').append(fila);
  });
}

function guardarConfiguracion() {
  const limiteLaboral = Number($('limiteLaboral').value);
  const limiteEspecial = Number($('limiteEspecial').value);
  if (![limiteLaboral, limiteEspecial].every(numero => Number.isFinite(numero) && numero >= 0 && numero <= 744)) {
    $('mensajeConfiguracion').textContent = 'Revisa los límites ingresados.';
    return;
  }
  const lineasFestivos = $('festivos').value.split(/[\n,;]+/).map(valor => valor.trim()).filter(Boolean);
  const festivos = lineasFestivos.map(fechaISO);
  if (festivos.includes(null)) {
    $('mensajeConfiguracion').textContent = 'Hay una fecha de festivo inválida.';
    return;
  }
  const horario = [...$('horarios').children].map(fila => ({ activo: fila.children[1].checked, entrada: fila.children[2].value, salida: fila.children[3].value }));
  if (horario.some(dia => !dia.entrada || !dia.salida)) {
    $('mensajeConfiguracion').textContent = 'Completa los horarios.';
    return;
  }
  configuracion = { limiteLaboral, limiteEspecial, festivos: [...new Set(festivos)], horario };
  configuraciones[$('mes').value] = structuredClone(configuracion);
  localStorage.setItem(claveConfiguracion, JSON.stringify(configuraciones));
  $('mensajeConfiguracion').textContent = 'Configuración guardada para este mes.';
  dibujar();
}

function mostrarSaldo(tipo, datos) {
  const esLaboral = tipo === 'Laboral';
  $(esLaboral ? 'horasLaborales' : 'horasEspeciales').textContent = formatearMinutos(datos.acumulado);
  $(esLaboral ? 'topeLaboral' : 'topeEspecial').textContent = `Límite ${datos.limite / 60} h`;
  const saldo = $(esLaboral ? 'saldoLaboral' : 'saldoEspecial');
  saldo.textContent = datos.disponible >= 0 ? `${formatearMinutos(datos.disponible)} disponibles` : `${formatearMinutos(-datos.disponible)} excedidas`;
  saldo.style.color = datos.disponible < 0 ? '#b64b38' : '#277e68';
  const barra = $(esLaboral ? 'barraLaboral' : 'barraEspecial');
  barra.style.width = `${datos.limite ? Math.min(100, (datos.acumulado / datos.limite) * 100) : datos.acumulado ? 100 : 0}%`;
  barra.classList.toggle('excedido', datos.disponible < 0);
}

function dibujar() {
  const resumen = resumir(registros, configuracion, $('mes').value);
  mostrarSaldo('Laboral', resumen.laboral);
  mostrarSaldo('Especial', resumen.especial);
  const cuerpo = $('registros');
  cuerpo.replaceChildren();
  if (!resumen.detalles.length) {
    const fila = document.createElement('tr');
    const celda = document.createElement('td');
    celda.colSpan = 7;
    celda.className = 'vacio';
    celda.textContent = 'No hay marcaciones para este mes.';
    fila.append(celda);
    cuerpo.append(fila);
  }
  resumen.detalles.forEach(registro => {
    const fila = document.createElement('tr');
    const agregar = texto => { const celda = document.createElement('td'); celda.textContent = texto; fila.append(celda); return celda; };
    agregar(registro.fecha.split('-').reverse().join('/'));
    agregar(nombresDias[new Date(`${registro.fecha}T12:00:00Z`).getUTCDay()]);
    ['entrada', 'salida'].forEach(campo => {
      const celda = document.createElement('td');
      const control = document.createElement('input');
      control.type = 'time';
      control.value = registro[campo];
      control.setAttribute('aria-label', `${campo} ${registro.fecha}`);
      control.addEventListener('change', () => {
        registros = registros.map(fila => fila.fecha === registro.fecha ? { ...fila, [campo]: control.value } : fila);
        guardarRegistros();
        dibujar();
      });
      celda.append(control);
      fila.append(celda);
    });
    const tipo = agregar(registro.especial ? 'Especial' : 'Laboral');
    tipo.firstChild?.remove();
    const insignia = document.createElement('span');
    insignia.className = `tipo${registro.especial ? ' especial' : ''}`;
    insignia.textContent = registro.especial ? 'Especial' : 'Laboral';
    tipo.append(insignia);
    agregar(formatearMinutos(registro.minutos));
    const celdaAccion = document.createElement('td');
    const borrar = document.createElement('button');
    borrar.className = 'boton sutil';
    borrar.textContent = 'Quitar';
    borrar.setAttribute('aria-label', `Eliminar ${registro.fecha}`);
    borrar.addEventListener('click', () => {
      registros = registros.filter(fila => fila.fecha !== registro.fecha);
      guardarRegistros();
      dibujar();
    });
    celdaAccion.append(borrar);
    fila.append(celdaAccion);
    cuerpo.append(fila);
  });
  const advertencias = resumen.detalles.filter(fila => fila.error).map(fila => `${fila.fecha.split('-').reverse().join('/')}: ${fila.error}`);
  $('aviso').textContent = advertencias.join(' · ');
}

function procesar() {
  const resultado = interpretarTexto($('textoMarcaciones').value);
  if (!resultado.registros.length) {
    $('mensaje').textContent = 'No encontré filas con fecha y dos horas. Revisa el formato.';
    return;
  }
  const mapa = new Map(registros.map(fila => [fila.fecha, fila]));
  resultado.registros.forEach(fila => mapa.set(fila.fecha, fila));
  registros = [...mapa.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  guardarRegistros();
  const meses = [...new Set(resultado.registros.map(fila => fila.fecha.slice(0, 7)))];
  if (meses.length === 1) {
    $('mes').value = meses[0];
    cargarConfiguracion();
  }
  dibujar();
  $('mensaje').textContent = `${resultado.registros.length} marcaciones importadas${resultado.errores.length ? ` · ${resultado.errores.length} filas incompletas` : ''}.`;
}

async function descomprimirExcel(archivo) {
  const datos = new DataView(await archivo.arrayBuffer());
  const bytes = new Uint8Array(datos.buffer);
  const decodificador = new TextDecoder();
  const archivos = new Map();
  let posicion = 0;
  while (posicion + 30 <= datos.byteLength) {
    if (datos.getUint32(posicion, true) !== 0x04034b50) break;
    const metodo = datos.getUint16(posicion + 8, true);
    const banderas = datos.getUint16(posicion + 6, true);
    const tamano = datos.getUint32(posicion + 18, true);
    const nombreTamano = datos.getUint16(posicion + 26, true);
    const extraTamano = datos.getUint16(posicion + 28, true);
    if (banderas & 8) throw new Error('Este Excel usa un formato ZIP no compatible. Guárdalo como CSV.');
    const nombre = decodificador.decode(bytes.slice(posicion + 30, posicion + 30 + nombreTamano));
    const inicio = posicion + 30 + nombreTamano + extraTamano;
    const bloque = bytes.slice(inicio, inicio + tamano);
    if (nombre === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(nombre)) {
      let contenido = bloque;
      if (metodo === 8) {
        const flujo = new Blob([bloque]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        contenido = new Uint8Array(await new Response(flujo).arrayBuffer());
      } else if (metodo !== 0) throw new Error('Compresión de Excel no compatible.');
      archivos.set(nombre, decodificador.decode(contenido));
    }
    posicion = inicio + tamano;
  }
  const lector = new DOMParser();
  const compartidas = archivos.has('xl/sharedStrings.xml') ? [...lector.parseFromString(archivos.get('xl/sharedStrings.xml'), 'application/xml').getElementsByTagName('si')].map(celda => [...celda.getElementsByTagName('t')].map(nodo => nodo.textContent).join('')) : [];
  const hoja = [...archivos.keys()].filter(nombre => nombre.startsWith('xl/worksheets/')).sort()[0];
  if (!hoja) throw new Error('No se encontró una hoja de cálculo legible.');
  const documento = lector.parseFromString(archivos.get(hoja), 'application/xml');
  const filas = [...documento.getElementsByTagName('row')].map(fila => {
    const celdas = [];
    [...fila.getElementsByTagName('c')].forEach(celda => {
      const referencia = celda.getAttribute('r') || '';
      const letras = (referencia.match(/^[A-Z]+/) || ['A'])[0];
      let posicionColumna = 0;
      for (const letra of letras) posicionColumna = posicionColumna * 26 + letra.charCodeAt(0) - 64;
      const tipo = celda.getAttribute('t');
      const valor = celda.getElementsByTagName('v')[0]?.textContent || '';
      let texto = tipo === 's' ? compartidas[Number(valor)] || '' : tipo === 'inlineStr' ? celda.getElementsByTagName('t')[0]?.textContent || '' : valor;
      if (tipo !== 's' && tipo !== 'inlineStr' && /^\d+(\.\d+)?$/.test(texto)) {
        const numero = Number(texto);
        if (numero > 20000 && numero < 100000) {
          const fecha = new Date(Date.UTC(1899, 11, 30) + Math.floor(numero) * 86400000);
          texto = `${String(fecha.getUTCDate()).padStart(2, '0')}/${String(fecha.getUTCMonth() + 1).padStart(2, '0')}/${fecha.getUTCFullYear()}`;
        } else if (numero >= 0 && numero < 1) {
          const minutos = Math.round(numero * 1440);
          texto = `${String(Math.floor(minutos / 60) % 24).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
        }
      }
      celdas[posicionColumna - 1] = String(texto);
    });
    return celdas.join(' | ');
  });
  return filas.join('\n');
}

async function importarArchivo(evento) {
  const archivo = evento.target.files?.[0];
  if (!archivo) return;
  try {
    const texto = archivo.name.toLowerCase().endsWith('.xlsx') ? await descomprimirExcel(archivo) : await archivo.text();
    $('textoMarcaciones').value = texto;
    procesar();
  } catch (error) {
    $('mensaje').textContent = `No pude leer el archivo: ${error.message}`;
  }
  evento.target.value = '';
}

function exportar() {
  const lista = registros.filter(fila => fila.fecha.startsWith($('mes').value));
  const texto = ['Fecha;Entrada;Salida;Tipo;Horas extras', ...lista.map(fila => {
    const calculado = resumir([fila], configuracion, $('mes').value).detalles[0];
    return `${fila.fecha.split('-').reverse().join('/')};${fila.entrada};${fila.salida};${calculado.especial ? 'Especial' : 'Laboral'};${formatearMinutos(calculado.minutos)}`;
  })].join('\r\n');
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(new Blob(['\ufeff', texto], { type: 'text/csv;charset=utf-8' }));
  enlace.download = `horas-extraordinarias-${$('mes').value}.csv`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

$('version').textContent = `v${VERSION}`;
document.querySelector('#firmaAutor strong').textContent = FIRMA;
$('mes').value = mesActual();
cargarConfiguracion();
dibujar();
$('mes').addEventListener('change', () => { cargarConfiguracion(); dibujar(); });
$('procesar').addEventListener('click', procesar);
$('archivo').addEventListener('change', importarArchivo);
$('guardarConfiguracion').addEventListener('click', guardarConfiguracion);
$('restaurar').addEventListener('click', () => { configuraciones[$('mes').value] = structuredClone(configuracionInicial); cargarConfiguracion(); $('mensajeConfiguracion').textContent = 'Horarios iniciales cargados. Pulsa Guardar para confirmar.'; });
$('limpiar').addEventListener('click', () => {
  if (!confirm(`¿Borrar las marcaciones de ${$('mes').value}?`)) return;
  registros = registros.filter(fila => !fila.fecha.startsWith($('mes').value));
  guardarRegistros();
  $('textoMarcaciones').value = '';
  $('mensaje').textContent = 'Marcaciones borradas para este mes.';
  dibujar();
});
$('exportar').addEventListener('click', exportar);
