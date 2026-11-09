import { PageHeader } from '../layout/Shell';

const TEXTOS: Record<string, { titulo: string; texto: string }> = {
  metas: { titulo: 'Metas', texto: 'Ahorra para un viaje o un colchón de emergencia y mira cuánto te falta.' },
  impuestos: {
    titulo: 'Impuestos',
    texto: 'IVA e IRPF del trimestre explicados paso a paso, con avisos antes de cada plazo.',
  },
};

export function Proximamente({ seccion }: { seccion: string }) {
  const t = TEXTOS[seccion];
  return (
    <>
      <PageHeader titulo={t.titulo} />
      <div className="card placeholder-card">
        <h2 className="card-title">Muy pronto</h2>
        <p>{t.texto}</p>
      </div>
    </>
  );
}
