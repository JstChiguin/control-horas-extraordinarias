import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION, FIRMA, configuracionInicial, interpretarTexto, resumir, formatearMinutos } from './calculos.mjs';

const ejemplo = `| 01/10/2026 | Entrada | : 06:33 | Salida | : 16:40 |
| 02/10/2026 | Entrada | : 06:29 | Salida | : 19:30 |
| 03/10/2026 | Entrada | : 06:37 | Salida | : 14:04 |
| 05/10/2026 | Entrada | : 06:26 | Salida | : 16:36 |
| 06/10/2026 | Entrada | : 06:26 | Salida | : 17:01 |
| 07/10/2026 | Entrada | : 06:35 | Salida | : 17:48 |
| 08/10/2026 | Entrada | : 06:14 | Salida | : 16:31 |
| 09/10/2026 | Entrada | : 06:27 | Salida | : 17:36 |
| 10/10/2026 | Entrada | : 07:36 | Salida | : 15:09 |
| 13/10/2026 | Entrada | : 06:27 | Salida | : 17:30 |
| 14/10/2026 | Entrada | : 06:15 | Salida | : 17:36 |
| 15/10/2026 | Entrada | : 06:27 | Salida | : 18:08 |
| 16/10/2026 | Entrada | : 06:06 | Salida | : 16:13 |
| 17/10/2026 | Entrada | : 07:08 | Salida | : 14:38 |
| 19/10/2026 | Entrada | : 06:20 | Salida | : 18:02 |
| 20/10/2026 | Entrada | : 06:26 | Salida | : 15:06 |
| 21/10/2026 | Entrada | : 06:32 | Salida | : 17:40 |
| 22/10/2026 | Entrada | : 06:18 | Salida | : 17:41 |
| 23/10/2026 | Entrada | : 06:13 | Salida | : 15:11 |
| 24/10/2026 | Entrada | : 06:56 | Salida | : 06:56 |`;

test('calcula el listado de octubre sin inventar salida', () => {
  const { registros, errores } = interpretarTexto(ejemplo);
  assert.equal(registros.length, 20);
  assert.deepEqual(errores, []);
  const resumen = resumir(registros, configuracionInicial, '2026-10');
  assert.equal(formatearMinutos(resumen.laboral.acumulado), '23 h 43 min');
  assert.equal(formatearMinutos(resumen.especial.acumulado), '22 h 30 min');
  assert.equal(formatearMinutos(resumen.especial.disponible), '7 h 30 min');
});

test('si se corrige la salida del sábado a las 14 obtiene total esperado', () => {
  const { registros } = interpretarTexto(ejemplo.replace('24/10/2026 | Entrada | : 06:56 | Salida | : 06:56', '24/10/2026 | Entrada | : 06:56 | Salida | : 14:00'));
  assert.equal(formatearMinutos(resumir(registros, configuracionInicial, '2026-10').especial.acumulado), '29 h 34 min');
});

test('festivos personalizados y límites', () => {
  const { registros } = interpretarTexto(ejemplo);
  const configuracion = structuredClone(configuracionInicial);
  configuracion.festivos = ['2026-10-12', '2026-10-16'];
  configuracion.limiteEspecial = 40;
  const resumen = resumir(registros, configuracion, '2026-10');
  assert.equal(resumen.especial.acumulado, 22 * 60 + 30 + 607);
  assert.equal(resumen.laboral.acumulado, 1423 - 73);
});

test('firma textual exacta y versión centralizada en layout', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const estilos = readFileSync(new URL('./estilos.css', import.meta.url), 'utf8');
  const aplicacion = readFileSync(new URL('./aplicacion.js', import.meta.url), 'utf8');
  assert.equal(FIRMA, 'by Chiguin');
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  assert.match(html, /<div id="firmaAutor" class="firma-autor"[^>]*><strong>by Chiguin<\/strong><span id="version"><\/span><\/div>/);
  assert.match(estilos, /\.firma-autor\{[^}]*position:fixed;right:16px;bottom:12px;[^}]*visibility:visible/);
  assert.match(estilos, /\.firma-autor strong\{[^}]*font-size:12px/);
  assert.match(estilos, /\.firma-autor span\{[^}]*font-size:9px;text-align:center/);
  assert.match(aplicacion, /textContent = `v\$\{VERSION\}`/);
});
