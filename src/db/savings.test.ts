import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { NetoDB } from './db';
import { completarInicio, crearCuenta, crearMovimiento, borrarCuenta, actualizarCuenta } from './repo';
import { guardarMeta, aportarMeta, gastarMeta, reasignarAhorro, borrarMeta, sincronizarMetas } from './goals';
import { patrimonio, saldosPorCuenta, saldosDirectos, dineroDisponible } from '../lib/balances';
import { dineroMeta } from '../lib/goalMoney';
import { crearCopia, restaurarCopia, validarCopia } from '../lib/backup';
import { cuenta, mov } from '../lib/testdata';
import { todayISO, monthKey } from '../lib/dates';
let d: NetoDB,
  n = 0,
  banco: string,
  categoria: string;
const base = {
  nombre: 'Japón',
  categoriaAhorro: 'viajes',
  objetivo: 100000,
  inicial: 0,
  mensual: 10000,
  mesInicio: monthKey(todayISO()),
  automatica: false,
  activa: true,
};
beforeEach(async () => {
  d = new NetoDB('savings-' + ++n);
  await d.open();
  await completarInicio({ nombre: 'Alex', autonomo: false }, d);
  banco = await crearCuenta({ nombre: 'Banco', tipo: 'banco', ambito: 'personal', saldoInicial: 100000 }, d);
  categoria = (await d.categorias.where('tipo').equals('gasto').first())!.id;
});
afterEach(async () => {
  await d.delete();
});
const general = async () => (await d.cuentas.filter((c) => !!c.ahorroGeneral && !c.eliminada).first())!;
const estado = async (id: string) =>
  dineroMeta(
    (await d.metas.get(id))!,
    await d.aportesMetas.toArray(),
    await d.cuentas.toArray(),
    await d.movimientos.toArray(),
  );
const total = async () => patrimonio(await d.cuentas.toArray(), await d.movimientos.toArray(), 'personal');
it('cinco bancos y diez metas se muestran como cinco bancos y una sola cuenta de ahorro', async () => {
  for (let i = 1; i < 5; i++)
    await crearCuenta({ nombre: `Banco ${i}`, tipo: 'banco', ambito: 'personal', saldoInicial: 100000 }, d);
  for (let i = 0; i < 10; i++) await guardarMeta({ ...base, nombre: `Meta ${i}`, cuentaOrigenId: banco }, undefined, d);
  const cuentas = await d.cuentas.toArray(),
    g = await general(),
    visibles = cuentas.filter((c) => !c.cuentaPadreId && !c.eliminada);
  expect(visibles).toHaveLength(6);
  expect(visibles.filter((c) => c.tipo === 'ahorro')).toHaveLength(1);
  expect(cuentas.filter((c) => c.cuentaPadreId === g.id)).toHaveLength(10);
  expect(await total()).toBe(500000);
  expect(await d.movimientos.count()).toBe(0);
});
it('suma el ahorro libre y las metas una sola vez y mantiene el dinero de cada meta separado', async () => {
  const g = await crearCuenta({ nombre: 'Ahorro', tipo: 'ahorro', ambito: 'personal', saldoInicial: 10000 }, d);
  const j = await guardarMeta({ ...base, cuentaOrigenId: banco }, undefined, d),
    e = await guardarMeta(
      { ...base, nombre: 'Emergencia', categoriaAhorro: 'ahorro', cuentaOrigenId: banco },
      undefined,
      d,
    );
  await aportarMeta(j, 20000, [base.mesInicio], todayISO(), 'j', d);
  await aportarMeta(e, 10000, [base.mesInicio], todayISO(), 'e', d);
  let cuentas = await d.cuentas.toArray(),
    movs = await d.movimientos.toArray();
  expect(saldosPorCuenta(cuentas, movs).get(g)).toBe(40000);
  expect(saldosDirectos(cuentas, movs).get(g)).toBe(10000);
  expect(await total()).toBe(110000);
  expect(dineroDisponible(cuentas, movs)).toEqual({ total: 110000, ahorro: 40000, disponible: 70000 });
  await gastarMeta(
    { metaId: j, importe: 15000, fecha: todayISO(), categoriaId: categoria, nota: 'Vuelos', operacionId: 'flight' },
    d,
  );
  expect((await estado(j)).disponible).toBe(5000);
  expect((await estado(e)).disponible).toBe(10000);
  await expect(
    gastarMeta(
      { metaId: j, importe: 6000, fecha: todayISO(), categoriaId: categoria, nota: '', operacionId: 'too-much' },
      d,
    ),
  ).rejects.toThrow('saldo');
  await reasignarAhorro(
    { metaId: j, destinoMetaId: e, importe: 5000, fecha: todayISO(), operacionId: 'reallocate' },
    d,
  );
  expect((await estado(j)).disponible).toBe(0);
  expect((await estado(e)).disponible).toBe(15000);
  expect(saldosPorCuenta(await d.cuentas.toArray(), await d.movimientos.toArray()).get(g)).toBe(25000);
  expect(await total()).toBe(95000);
});
it('no utiliza el dinero ya reservado a otras metas al aportar desde Ahorro', async () => {
  const j = await guardarMeta({ ...base, cuentaOrigenId: banco }, undefined, d);
  await aportarMeta(j, 20000, [base.mesInicio], todayISO(), 'j', d);
  const g = await general();
  const e = await guardarMeta({ ...base, nombre: 'Emergencia', cuentaOrigenId: g.id }, undefined, d);
  await expect(aportarMeta(e, 10000, [base.mesInicio], todayISO(), 'no-free', d)).rejects.toThrow('saldo');
  await crearMovimiento(
    {
      tipo: 'transferencia',
      importe: 10000,
      fecha: todayISO(),
      cuentaId: banco,
      cuentaDestinoId: g.id,
      nota: 'Ahorro sin asignar',
    },
    d,
  );
  await aportarMeta(e, 10000, [base.mesInicio], todayISO(), 'free', d);
  expect((await estado(j)).disponible).toBe(20000);
  expect((await estado(e)).disponible).toBe(10000);
  expect(await total()).toBe(100000);
});
it('borrar una meta deja su dinero en Ahorro sin cambiar patrimonio ni crear ingresos', async () => {
  const j = await guardarMeta({ ...base, cuentaOrigenId: banco }, undefined, d);
  await aportarMeta(j, 20000, [base.mesInicio], todayISO(), 'reserve', d);
  const bolsillo = (await d.metas.get(j))!.cuentaAhorroId!,
    g = await general();
  await borrarMeta(j, d);
  expect(await total()).toBe(100000);
  expect((await d.cuentas.get(bolsillo))?.eliminada).toBe(true);
  expect(saldosDirectos(await d.cuentas.toArray(), await d.movimientos.toArray()).get(g.id)).toBe(20000);
  expect((await d.movimientos.toArray()).every((m) => m.tipo === 'transferencia')).toBe(true);
  expect(validarCopia(await crearCopia(d)).ok).toBe(true);
});
it('eliminar Ahorro quita su dinero del total y pausa todas sus metas sin recuperar saldos borrados', async () => {
  const j = await guardarMeta({ ...base, cuentaOrigenId: banco, automatica: true }, undefined, d),
    g = await general();
  await borrarCuenta(g.id, d);
  await sincronizarMetas(undefined, d);
  expect(await total()).toBe(90000);
  expect((await d.metas.get(j))?.activa).toBe(false);
  expect((await estado(j)).disponible).toBe(0);
  const otra = await guardarMeta({ ...base, nombre: 'Nueva', cuentaOrigenId: banco }, undefined, d);
  expect((await general()).id).not.toBe(g.id);
  expect((await estado(otra)).disponible).toBe(0);
  expect(await total()).toBe(90000);
});
it('evita crear una segunda cuenta general sin alterar el saldo y permite cuentas de negocio independientes', async () => {
  const g = await crearCuenta({ nombre: 'Ahorro', tipo: 'ahorro', ambito: 'personal', saldoInicial: 10000 }, d);
  await expect(
    crearCuenta({ nombre: 'Otra', tipo: 'ahorro', ambito: 'personal', saldoInicial: 20000 }, d),
  ).rejects.toThrow('Ya tienes');
  expect((await d.cuentas.get(g))?.saldoInicial).toBe(10000);
  await crearCuenta({ nombre: 'Negocio', tipo: 'ahorro', ambito: 'negocio', saldoInicial: 30000 }, d);
  expect(await d.cuentas.count()).toBe(3);
});
it('editar el tipo de una cuenta mantiene una sola cuenta general y conserva el saldo', async () => {
  await actualizarCuenta(banco, { tipo: 'ahorro' }, d);
  expect((await d.cuentas.get(banco))?.ahorroGeneral).toBe(true);
  const otro = await crearCuenta({ nombre: 'Otro banco', tipo: 'banco', ambito: 'personal', saldoInicial: 20000 }, d);
  await expect(actualizarCuenta(otro, { tipo: 'ahorro' }, d)).rejects.toThrow('Ya tienes');
  expect((await d.cuentas.get(otro))?.tipo).toBe('banco');
  await expect(actualizarCuenta(banco, { tipo: 'banco' }, d)).rejects.toThrow('La cuenta general');
  expect(await total()).toBe(120000);
});
it('migra cuentas de metas v7 sin modificar movimientos ni aportaciones ni duplicar dinero', async () => {
  const name = 'savings-old-v7';
  const vieja = new Dexie(name);
  vieja.version(7).stores({
    cuentas: 'id, ambito, orden',
    movimientos: 'id, fecha, cuentaId, cuentaDestinoId, categoriaId, tipo, &operacionId',
    categorias: 'id, tipo, orden',
    ajustes: 'id',
    suscripciones: 'id, ambito, estado, categoria, proximaFecha',
    inversiones: 'id, tipo, activoId',
    historialCartera: 'id, fecha',
    presupuestos: 'id, mes, categoriaId, &[mes+categoriaId]',
    metas: 'id, mesInicio',
    aportesMetas: 'id, metaId, mes, grupoId, [metaId+mes]',
    pagosFijos: 'id, tipo, proximaFecha',
    pagosRegistrados: 'id, fecha, movimientoId, &[origen+recurrenteId+periodoFecha]',
  });
  const cuentas = [
    cuenta('b', 100000),
    cuenta('s', 50000, { nombre: 'Ahorro', tipo: 'ahorro' }),
    cuenta('j', 0, { nombre: 'Ahorro · Japón', tipo: 'ahorro' }),
    cuenta('e', 0, { nombre: 'Ahorro · Emergencia', tipo: 'ahorro' }),
    cuenta('deleted', 99900, { tipo: 'ahorro', eliminada: true }),
  ];
  const movs = [
    mov('transferencia', 20000, '2026-11-04', 'b', { id: 'jr', cuentaDestinoId: 'j' }),
    mov('transferencia', 10000, '2026-11-04', 'b', { id: 'er', cuentaDestinoId: 'e' }),
    mov('gasto', 5000, '2026-11-04', 'j', { id: 'flight', categoriaId: 'food' }),
    mov('transferencia', 2000, '2026-11-04', 'j', { id: 'reparto', cuentaDestinoId: 'e' }),
  ];
  const aportes = [
    { id: 'ja', metaId: 'jm', mes: base.mesInicio, importe: 20000, origen: 'transferencia', movimientoId: 'jr' },
    { id: 'ea', metaId: 'em', mes: base.mesInicio, importe: 10000, origen: 'transferencia', movimientoId: 'er' },
    { id: 'eb', metaId: 'em', mes: base.mesInicio, importe: 2000, origen: 'transferencia', movimientoId: 'reparto' },
  ];
  await vieja.table('cuentas').bulkAdd(cuentas);
  await vieja.table('movimientos').bulkAdd(movs);
  await vieja.table('metas').bulkAdd([
    { ...base, id: 'jm', cuentaOrigenId: 'b', cuentaAhorroId: 'j' },
    { ...base, id: 'em', nombre: 'Emergencia', categoriaAhorro: 'ahorro', cuentaOrigenId: 'b', cuentaAhorroId: 'e' },
  ]);
  await vieja.table('aportesMetas').bulkAdd(aportes);
  vieja.close();
  const nueva = new NetoDB(name);
  try {
    await nueva.open();
    const cs = await nueva.cuentas.toArray(),
      ms = await nueva.movimientos.toArray();
    expect(ms).toEqual([...movs].sort((a, b) => a.id.localeCompare(b.id)));
    expect(await nueva.aportesMetas.toArray()).toEqual([...aportes].sort((a, b) => a.id.localeCompare(b.id)));
    expect(cs.filter((c) => !c.cuentaPadreId && !c.eliminada)).toHaveLength(2);
    expect((await nueva.cuentas.get('j'))?.cuentaPadreId).toBe('s');
    expect(saldosPorCuenta(cs, ms).get('s')).toBe(75000);
    expect(patrimonio(cs, ms, 'personal')).toBe(145000);
    expect(dineroMeta((await nueva.metas.get('jm'))!, await nueva.aportesMetas.toArray(), cs, ms).disponible).toBe(
      13000,
    );
    nueva.close();
    await nueva.open();
    expect(await nueva.cuentas.count()).toBe(5);
  } finally {
    await nueva.delete();
  }
});
it('restaurar copias antiguas agrupa el ahorro y las nuevas copias mantienen la estructura y sus saldos', async () => {
  await d.cuentas.bulkAdd([
    cuenta('j', 10000, { tipo: 'ahorro', nombre: 'Ahorro · Japón' }),
    cuenta('e', 5000, { tipo: 'ahorro', nombre: 'Ahorro · Emergencia' }),
  ]);
  await d.metas.bulkAdd([
    { ...base, id: 'jm', cuentaOrigenId: banco, cuentaAhorroId: 'j' },
    { ...base, id: 'em', cuentaOrigenId: banco, cuentaAhorroId: 'e' },
  ]);
  const vieja = await crearCopia(d);
  vieja.version = 8;
  expect(validarCopia(vieja).ok).toBe(true);
  await restaurarCopia(vieja, d);
  expect((await d.cuentas.toArray()).filter((c) => !c.cuentaPadreId && !c.eliminada)).toHaveLength(2);
  expect(await total()).toBe(115000);
  const nueva = await crearCopia(d);
  expect(nueva.version).toBe(11);
  expect(validarCopia(nueva).ok).toBe(true);
  await restaurarCopia(nueva, d);
  expect(await crearCopia(d, new Date(nueva.exportadaEn))).toEqual(nueva);
  const rota = structuredClone(nueva);
  (rota.datos.cuentas.find((c) => (c as { id: string }).id === 'j') as { cuentaPadreId: string }).cuentaPadreId =
    'missing';
  expect(validarCopia(rota).ok).toBe(false);
});

it('el ahorro libre de cuentas antiguas agrupadas se puede reservar sin usar otras metas', async () => {
  const g = await crearCuenta({ nombre: 'Ahorro', tipo: 'ahorro', ambito: 'personal', saldoInicial: 0 }, d);
  await d.cuentas.add(cuenta('old-free', 10000, { tipo: 'ahorro', nombre: 'Ahorro anterior', cuentaPadreId: g }));
  const j = await guardarMeta({ ...base, cuentaOrigenId: banco }, undefined, d);
  await aportarMeta(j, 20000, [base.mesInicio], todayISO(), 'j', d);
  const e = await guardarMeta({ ...base, nombre: 'Otra', cuentaOrigenId: g }, undefined, d);
  await aportarMeta(e, 10000, [base.mesInicio], todayISO(), 'free-old', d);
  expect((await estado(j)).disponible).toBe(20000);
  expect((await estado(e)).disponible).toBe(10000);
  expect(await total()).toBe(110000);
  await expect(aportarMeta(e, 1, [base.mesInicio], todayISO(), 'no-free', d)).rejects.toThrow('saldo');
});
