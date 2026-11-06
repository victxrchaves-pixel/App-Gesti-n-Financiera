import { PageHeader } from '../layout/Shell';
import { GoalPlans } from '../ui/GoalPlans';
export function Metas() {
  return (
    <>
      <PageHeader titulo="Metas" subtitulo="Lo que reservas hoy, lo que haces posible mañana." />
      <GoalPlans completo />
    </>
  );
}
