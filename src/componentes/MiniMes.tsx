import { diaDaSemana, partes, type DiaISO } from '../dominio/datas';
import type { DiaEscala } from '../dominio/tipos';
import { NOMES_MESES } from '../formatacao';
import { COR_CELULA } from './cores';

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Mês compacto (prévia de ajuste), com dias destacados. */
export function MiniMes({ dias, destacar }: { dias: DiaEscala[]; destacar: ReadonlySet<DiaISO> }) {
  if (dias.length === 0) return null;
  const { ano, mes } = partes(dias[0]!.data);
  const vazios = diaDaSemana(dias[0]!.data);
  return (
    <div>
      <p className="mb-1 text-sm font-semibold">
        {NOMES_MESES[mes - 1]} {ano}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400">
        {SEMANA.map((s, i) => (
          <div key={i}>{s}</div>
        ))}
      </div>
      <div className="mt-0.5 grid grid-cols-7 gap-1">
        {Array.from({ length: vazios }, (_, i) => (
          <div key={`v${i}`} />
        ))}
        {dias.map((d) => (
          <div
            key={d.data}
            className={`flex aspect-square items-center justify-center rounded-md text-xs font-semibold tabular-nums ${COR_CELULA[d.categoria]} ${
              destacar.has(d.data) ? 'ring-2 ring-ajuste ring-offset-1 ring-offset-white dark:ring-violet-400 dark:ring-offset-slate-900' : ''
            }`}
          >
            {partes(d.data).dia}
          </div>
        ))}
      </div>
    </div>
  );
}
