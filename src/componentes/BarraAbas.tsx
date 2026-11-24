import { CalendarDays, ChartColumn, House, Settings } from 'lucide-react';
import { NavLink } from 'react-router';

const ABAS = [
  { para: '/', rotulo: 'Início', Icone: House },
  { para: '/calendario', rotulo: 'Calendário', Icone: CalendarDays },
  { para: '/estatisticas', rotulo: 'Estatísticas', Icone: ChartColumn },
  { para: '/configuracoes', rotulo: 'Ajustes', Icone: Settings },
] as const;

export function BarraAbas() {
  return (
    <nav className="pb-seguro fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {ABAS.map(({ para, rotulo, Icone }) => (
          <li key={para}>
            <NavLink
              to={para}
              end={para === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-medium ${
                  isActive ? 'text-embarcado dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              <Icone size={24} strokeWidth={2} aria-hidden />
              {rotulo}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
