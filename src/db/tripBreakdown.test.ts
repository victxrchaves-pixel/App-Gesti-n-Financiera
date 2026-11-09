import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { NetoDB } from './db';
import { guardarDesglose, guardarMeta } from './goals';
import { crearCuenta } from './repo';
import { crearCopia, restaurarCopia, validarCopia } from '../lib/backup';
import { monthKey, todayISO } from '../lib/dates';
import { resumenDesglose, validarDesglose } from '../lib/tripBreakdown';
import type { Meta } from './types';
let d: NetoDB;
let n = 0;
const meta = {
  nombre: 'Japón',
  categoriaAhorro: 'viajes',
  objetivo: 50000,
  inicial: 0,
  mensual: 10000,
  mesInicio: monthKey(todayISO()),
  automatica: true,
  activa: true,
};
const partidas = [
  { id: 'v', nombre: 'Vuelos', importe: 15000 },
  { id: 'h', nombre: 'Hoteles', importe: 10000 },
  { id: 'c', nombre: 'Comida y ocio', importe: 5000 },
];
beforeEach(async () => {
  d = new NetoDB('trip-' + ++n);
  await d.open();
});
afterEach(async () => {
  await d.delete();
});
it('reparte 300 de 500 euros y conserva 200 sin asignar', () => {
  expect(resumenDesglose(partidas, 50000)).toEqual({ asignado: 30000, sinAsignar: 20000 });
  expect(validarDesglose(partidas, 50000)).toBeNull();
  expect(validarDesglose(undefined, 50000)).toBeNull();
});
it('guardar, editar y eliminar conceptos no cambia aportaciones, transferencias ni saldos', async () => {
  const cuenta = await crearCuenta({ nombre: 'General', tipo: 'banco', ambito: 'personal', saldoInicial: 100000 }, d);
  const id = await guardarMeta({ ...meta, cuentaOrigenId: cuenta }, undefined, d);
  const antes = await crearCopia(d);
  await guardarDesglose(id, partidas, d);
  expect((await d.metas.get(id))?.desglose).toEqual(partidas);
  const despues = await crearCopia(d);
  expect(despues.datos.movimientos).toEqual(antes.datos.movimientos);
  expect(despues.datos.aportesMetas).toEqual(antes.datos.aportesMetas);
  expect(despues.datos.cuentas).toEqual(antes.datos.cuentas);
  await guardarDesglose(id, [{ ...partidas[0], nombre: 'Avión', importe: 16000 }], d);
  expect((await d.metas.get(id))?.desglose).toHaveLength(1);
  await guardarDesglose(id, [], d);
  expect((await d.metas.get(id))?.desglose).toEqual([]);
});
it('editar la meta conserva el desglose y rechaza objetivos menores al total repartido', async () => {
  const id = await guardarMeta(meta, undefined, d);
  await guardarDesglose(id, partidas, d);
  await guardarMeta({ ...meta, nombre: 'Japón en primavera' }, id, d);
  expect((await d.metas.get(id))?.desglose).toEqual(partidas);
  await expect(guardarMeta({ ...meta, objetivo: 20000 }, id, d)).rejects.toThrow('supera');
  expect((await d.metas.get(id))?.objetivo).toBe(50000);
});
it('valida contra el objetivo actual aunque se haya reducido mientras el editor estaba abierto', async () => {
  const id = await guardarMeta(meta, undefined, d);
  await guardarMeta({ ...meta, objetivo: 20000 }, id, d);
  await expect(guardarDesglose(id, partidas, d)).rejects.toThrow('supera');
  expect((await d.metas.get(id))?.desglose).toBeUndefined();
});
it('rechaza importes inválidos, nombres vacíos, duplicados, sumas excesivas y metas borradas', async () => {
  const id = await guardarMeta(meta, undefined, d);
  for (const importe of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER])
    await expect(guardarDesglose(id, [{ id: 'a', nombre: 'Vuelos', importe }], d)).rejects.toThrow();
  expect(validarDesglose([{ id: 'a', nombre: '', importe: 0 }], 50000)).toContain('nombre');
  expect(validarDesglose([...partidas, { ...partidas[0] }], 50000)).toContain('duplicados');
  expect(
    validarDesglose(
      [
        { id: 'a', nombre: 'vuelos', importe: 1 },
        { id: 'b', nombre: ' VUELOS ', importe: 1 },
      ],
      50000,
    ),
  ).toContain('diferente');
  expect(validarDesglose([{ id: 'a', nombre: 'Vuelos', importe: 50001 }], 50000)).toContain('supera');
  expect(validarDesglose({ nombre: 'Vuelos' }, 50000)).not.toBeNull();
  await expect(guardarDesglose('borrada', partidas, d)).rejects.toThrow('existe');
});
it('las copias conservan el desglose y rechazan datos corruptos antes de restaurar', async () => {
  const id = await guardarMeta(meta, undefined, d);
  await guardarDesglose(id, partidas, d);
  const copia = await crearCopia(d);
  expect(copia.version).toBe(12);
  expect(validarCopia(copia).ok).toBe(true);
  await guardarDesglose(id, [], d);
  await restaurarCopia(copia, d);
  expect(await crearCopia(d, new Date(copia.exportadaEn))).toEqual(copia);
  const rota = structuredClone(copia);
  (rota.datos.metas[0] as Meta).desglose![0].importe = -1;
  expect(validarCopia(rota).ok).toBe(false);
  expect(validarCopia({ app: 'neto', version: 5, datos: {} }).ok).toBe(true);
});
