import { useState } from 'react';
import { config } from '../config/neto.config';
import { PageHeader } from '../layout/Shell';
import { useAjustes, useFacturas, useGastosNegocio } from '../db/hooks';
import { longDate, todayISO } from '../lib/dates';
import { moverTrimestre, nombreTrimestre, perfilNegocio, type Trimestre } from '../lib/facturas';
import {
  exentoDel130,
  finTrimestre,
  inicioTrimestre,
  mesesDeCuota,
  modelo130,
  modelo303,
  porcentajeConRetencion,
} from '../lib/impuestos';
import { formatMoney } from '../lib/money';
import { diasHasta, plazoDe, siguientePlazo } from '../lib/plazos';
import { Icon } from '../ui/Icon';

/** «20 de abril de 2026», sin día de la semana, para el calendario. */
const fechaCorta = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

function Fila({ texto, valor, nota, signo }: { texto: string; valor: number; nota?: string; signo?: '−' | '=' }) {
  return (
    <div className={`tax-row${signo === '=' ? ' is-subtotal' : ''}`}>
      <dt>
        {signo === '−' && <span className="tax-sign">−</span>}
        <span>
          {texto}
          {nota && <small>{nota}</small>}
        </span>
      </dt>
      <dd>{formatMoney(valor)}</dd>
    </div>
  );
}

export function Impuestos() {
  const ajustes = useAjustes();
  const facturas = useFacturas();
  const gastos = useGastosNegocio();
  const perfil = perfilNegocio(ajustes?.negocio);
  const hoy = todayISO();
  const [q, setQ] = useState<Trimestre>(() => {
    const p = siguientePlazo(hoy);
    return { anio: p.anio, t: p.trimestre };
  });

  const iva = modelo303(facturas, gastos, q, perfil);
  const irpf = modelo130(facturas, gastos, q, perfil);
  const plazo = plazoDe(q.anio, q.t);
  const abierto = hoy <= finTrimestre(q);
  const futuro = hoy < inicioTrimestre(q);
  const faltan = diasHasta(hoy, plazo.fin);
  const exento = exentoDel130(facturas, q.anio);
  const pctRetenido = porcentajeConRetencion(facturas, q.anio - 1);
  const apartar = Math.max(0, iva.resultado) + (exento ? 0 : irpf.resultado);
  const meses = mesesDeCuota(q, perfil.fechaAlta);

  return (
    <>
      <PageHeader titulo="Impuestos" subtitulo="El IVA y el pago de IRPF de cada trimestre, paso a paso." />

      <div className="finance-notice tax-disclaimer" role="note">
        <Icon name="aviso" size={18} />
        <span>
          <strong>{config.autonomo.notaImpuestos}</strong> Neto calcula con lo que has registrado en Facturas y Gastos.
        </span>
      </div>

      <div className="toolbar">
        <div className="month-nav">
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setQ(moverTrimestre(q, -1))}
            aria-label="Trimestre anterior"
          >
            <Icon name="izquierda" size={18} />
          </button>
          <span className="label">{nombreTrimestre(q).replace(/^./, (c) => c.toUpperCase())}</span>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setQ(moverTrimestre(q, 1))}
            aria-label="Trimestre siguiente"
          >
            <Icon name="derecha" size={18} />
          </button>
        </div>
      </div>

      <div className="stack">
        <section className="card hero-dark tax-hero">
          <div className="tax-hero-main">
            <span className="eyebrow">{futuro ? 'Todavía no ha empezado' : 'Para Hacienda este trimestre'}</span>
            <strong className="big-number">{formatMoney(apartar)}</strong>
            <small>
              {apartar === 0
                ? 'Con lo registrado, este trimestre no tienes que pagar nada.'
                : `${formatMoney(Math.max(0, iva.resultado))} de IVA${exento ? '' : ` y ${formatMoney(irpf.resultado)} de IRPF`}. Apártalo para no tocarlo.`}
            </small>
            {abierto && !futuro && (
              <span className="tax-open">
                <Icon name="calendario" size={15} />
                El trimestre sigue abierto hasta el {longDate(finTrimestre(q))}: las cifras pueden cambiar.
              </span>
            )}
          </div>
          <div className="tax-hero-deadline">
            <span className="eyebrow">Plazo</span>
            <b>Hasta el {longDate(plazo.fin, true)}</b>
            <small>
              Del {longDate(plazo.inicio)} al {longDate(plazo.fin)}
              {plazo.movido ? ' (el último día era festivo o fin de semana).' : '.'}
            </small>
            <small>Con cargo en cuenta, hasta el {longDate(plazo.domiciliacion)}.</small>
            {faltan >= 0 && faltan <= 60 && (
              <span className={`gain-chip ${faltan <= config.autonomo.avisoDiasAntes ? 'is-down' : 'is-up'}`}>
                {faltan === 0 ? 'Termina hoy' : faltan === 1 ? 'Queda 1 día' : `Quedan ${faltan} días`}
              </span>
            )}
            {faltan < 0 && <span className="gain-chip">Plazo terminado</span>}
          </div>
        </section>

        <div className="grid grid-2 tax-models">
          <section className="card" aria-labelledby="m303">
            <div className="card-header">
              <div>
                <h2 className="card-title" id="m303">
                  IVA · modelo 303
                </h2>
                <p className="muted tax-lead">
                  {perfil.regimenIVA === 'caja'
                    ? 'Criterio de caja: el IVA de lo que has cobrado en el trimestre.'
                    : 'El IVA de lo que has facturado en el trimestre.'}
                </p>
              </div>
            </div>
            <dl className="tax-steps">
              {iva.devengado.length === 0 ? (
                <Fila texto="IVA de tus facturas" valor={0} />
              ) : (
                iva.devengado.map((d) => (
                  <Fila
                    key={d.tipo}
                    texto={`IVA de tus facturas al ${d.tipo} %`}
                    nota={`Sobre ${formatMoney(d.base)}`}
                    valor={d.cuota}
                  />
                ))
              )}
              <Fila texto="IVA de tus gastos que puedes deducir" valor={iva.ivaDeducible} signo="−" />
              {iva.compensadoAnterior > 0 && (
                <Fila texto="A tu favor de trimestres anteriores" valor={iva.compensadoAnterior} signo="−" />
              )}
            </dl>
            <div className={`tax-result ${iva.resultado > 0 ? 'is-pay' : 'is-favor'}`}>
              <span>{iva.resultado > 0 ? 'A pagar' : iva.resultado < 0 ? 'A tu favor' : 'Sin nada que pagar'}</span>
              <strong>{formatMoney(Math.abs(iva.resultado))}</strong>
            </div>
            {iva.resultado < 0 && (
              <p className="muted tax-foot">
                {q.t === 4
                  ? 'En el 4.º trimestre puedes pedir que te lo devuelvan o compensarlo el año siguiente.'
                  : 'Se compensa en los próximos trimestres: Neto ya lo descuenta.'}
              </p>
            )}
          </section>

          <section className="card" aria-labelledby="m130">
            <div className="card-header">
              <div>
                <h2 className="card-title" id="m130">
                  IRPF · modelo 130
                </h2>
                <p className="muted tax-lead">
                  El {config.autonomo.irpf.pagoFraccionado} % de tu beneficio desde el 1 de enero, menos lo que ya has
                  adelantado.
                </p>
              </div>
            </div>
            {exento && (
              <div className="finance-notice tax-exempt">
                En {q.anio - 1}, el {pctRetenido?.toLocaleString('es-ES')} % de tus ingresos llevó retención:
                probablemente no tienes que presentar el 130. Confírmalo con tu gestor.
              </div>
            )}
            <dl className="tax-steps">
              <Fila texto="Ingresos del año" nota="Lo facturado, sin IVA" valor={irpf.ingresos} />
              <Fila texto="Gastos de tus facturas y tickets" valor={irpf.gastosFacturas} signo="−" />
              <Fila
                texto="Cuota de autónomos"
                nota={
                  perfil.cuotaMensual === 0
                    ? 'Indícala en Ajustes › Tu negocio'
                    : `${meses} ${meses === 1 ? 'mes' : 'meses'} × ${formatMoney(perfil.cuotaMensual)}`
                }
                valor={irpf.cuotaAutonomos}
                signo="−"
              />
              {perfil.regimenIRPF === 'simplificada' && (
                <Fila
                  texto="Gastos de difícil justificación"
                  nota={`${config.autonomo.dificilJustificacion.porcentaje} % del beneficio, máximo ${formatMoney(config.autonomo.dificilJustificacion.maximoAnual)} al año`}
                  valor={irpf.dificilJustificacion}
                  signo="−"
                />
              )}
              <Fila texto="Beneficio del año" valor={irpf.rendimiento} signo="=" />
              <Fila texto={`${config.autonomo.irpf.pagoFraccionado} % del beneficio`} valor={irpf.cuotaBruta} />
              <Fila texto="Retenciones de tus clientes" valor={irpf.retenciones} signo="−" />
              {q.t > 1 && <Fila texto="Pagado en trimestres anteriores" valor={irpf.pagosAnteriores} signo="−" />}
            </dl>
            <div className={`tax-result ${irpf.resultado > 0 && !exento ? 'is-pay' : 'is-favor'}`}>
              <span>{exento ? 'Probablemente exento' : irpf.resultado > 0 ? 'A pagar' : 'Sin nada que pagar'}</span>
              <strong>{formatMoney(exento ? 0 : irpf.resultado)}</strong>
            </div>
            {!exento && irpf.resultado === 0 && irpf.cuotaBruta > 0 && (
              <p className="muted tax-foot">
                Las retenciones de tus clientes y lo que ya pagaste cubren el {config.autonomo.irpf.pagoFraccionado} %:
                este trimestre no hay que adelantar más.
              </p>
            )}
            {perfil.nuevoAutonomo && (
              <p className="muted tax-foot">
                La reducción del 20 % de nuevo autónomo no se aplica aquí: se aplica en la declaración de la renta.
              </p>
            )}
          </section>
        </div>

        <section className="card" aria-labelledby="calendario">
          <div className="card-header">
            <h2 className="card-title" id="calendario">
              Calendario de {q.anio}
            </h2>
          </div>
          <ul className="tax-calendar">
            {[1, 2, 3, 4].map((t) => {
              const tq = { anio: q.anio, t };
              const p = plazoDe(q.anio, t);
              const empezado = hoy >= inicioTrimestre(tq);
              const a = empezado
                ? Math.max(0, modelo303(facturas, gastos, tq, perfil).resultado) +
                  (exento ? 0 : modelo130(facturas, gastos, tq, perfil).resultado)
                : null;
              const pasado = hoy > p.fin;
              return (
                <li key={t} className={t === q.t ? 'is-current' : undefined}>
                  <button type="button" onClick={() => setQ(tq)}>
                    <span className="tax-calendar-q">{t}.º trimestre</span>
                    <span className="tax-calendar-date">
                      {pasado ? 'Terminó el ' : 'Hasta el '}
                      {fechaCorta(p.fin)}
                    </span>
                    <span className="tax-calendar-amount">{a === null ? '—' : formatMoney(a)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="muted tax-foot">
            Si el último día cae en fin de semana o festivo nacional, el plazo pasa al siguiente día hábil. Los festivos
            de tu comunidad no se tienen en cuenta.
          </p>
        </section>
      </div>
    </>
  );
}
