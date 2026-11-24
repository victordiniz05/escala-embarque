import { diaDaSemana, partes, type DiaISO } from '../dominio/datas';
import type { DiaEscala } from '../dominio/tipos';
import { NOMES_MESES } from '../formatacao';
import { COR_CELULA } from './cores';

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

interface Props {
  dias: DiaEscala[];
  /** Dias com contorno (ex.: dias que mudam na prévia de ajuste). */
  destacar?: ReadonlySet<DiaISO>;
  hoje?: DiaISO;
  /** Ao tocar no mês (visão anual). */
  aoTocar?: () => void;
}

/** Mês compacto: prévia de ajuste e visão anual. */
export function MiniMes({ dias, destacar, hoje, aoTocar }: Props) {
  if (dias.length === 0) return null;
  const { ano, mes } = partes(dias[0]!.data);
  const vazios = diaDaSemana(dias[0]!.data);
  const aBordo = dias.filter((d) => d.aBordo).length;
  const conteudo = (
    <>
      <p className="mb-1 flex items-baseline justify-between text-sm font-semibold">
        <span>
          {NOMES_MESES[mes - 1]}
          {!aoTocar && ` ${ano}`}
        </span>
        {aoTocar && <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{aBordo} a bordo</span>}
      </p>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-slate-400" aria-hidden>
        {SEMANA.map((s, i) => (
          <div key={i}>{s}</div>
        ))}
      </div>
      <div className="mt-0.5 grid grid-cols-7 gap-0.5">
        {Array.from({ length: vazios }, (_, i) => (
          <div key={`v${i}`} />
        ))}
        {dias.map((d) => (
          <div
            key={d.data}
            className={`flex aspect-square items-center justify-center rounded-[4px] text-[10px] font-semibold tabular-nums ${COR_CELULA[d.categoria]} ${
              destacar?.has(d.data) ? 'ring-2 ring-ajuste ring-offset-1 ring-offset-white dark:ring-violet-400 dark:ring-offset-slate-900' : ''
            } ${d.data === hoje ? 'outline-2 outline-offset-1 outline-slate-900 dark:outline-white' : ''}`}
          >
            {partes(d.data).dia}
          </div>
        ))}
      </div>
    </>
  );
  if (!aoTocar) return <div>{conteudo}</div>;
  return (
    <button
      onClick={aoTocar}
      aria-label={`Abrir ${NOMES_MESES[mes - 1]} de ${ano}: ${aBordo} dias a bordo`}
      className="w-full self-start rounded-xl p-1.5 text-left active:bg-slate-100 dark:active:bg-slate-800"
    >
      {conteudo}
    </button>
  );
}
