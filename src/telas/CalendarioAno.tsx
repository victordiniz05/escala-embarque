import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { BotaoCompartilhar } from '../componentes/BotaoCompartilhar';
import { COR_LEGENDA } from '../componentes/cores';
import { compartilharImagem } from '../exportacao/compartilharImagem';
import { desenharAno } from '../exportacao/imagem';
import { MiniMes } from '../componentes/MiniMes';
import { partes, type DiaISO } from '../dominio/datas';
import type { EntradaEscala } from '../dominio/escala';
import { CATEGORIAS, diasDoAno } from '../dominio/estatisticas';
import type { DiaRealizado } from '../dominio/historico';
import { ROTULO_CATEGORIA } from '../formatacao';

interface Props {
  ano: number;
  entrada: EntradaEscala;
  realizados: ReadonlyMap<DiaISO, DiaRealizado>;
  hoje: DiaISO;
  subtitulo: string;
  aoMudarAno: (ano: number) => void;
  aoEscolherMes: (mes: number) => void;
}

/** Os 12 meses do ano numa tela. */
export function CalendarioAno({ ano, entrada, realizados, hoje, subtitulo, aoMudarAno, aoEscolherMes }: Props) {
  const meses = useMemo(() => {
    const dias = diasDoAno(entrada, realizados, ano, hoje);
    return Array.from({ length: 12 }, (_, i) => dias.filter((d) => partes(d.data).mes === i + 1));
  }, [entrada, realizados, ano, hoje]);
  const naEscala = meses.flat().filter((d) => !d.foraDaEscala);
  const aBordo = naEscala.filter((d) => d.aBordo).length;
  const presentes = new Set(naEscala.map((d) => d.categoria));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight tabular-nums">{ano}</h1>
        <div className="flex items-center gap-2">
          <BotaoCompartilhar
            rotulo="Compartilhar imagem do ano"
            aoCompartilhar={() => compartilharImagem(desenharAno(meses, ano, subtitulo), `escala-${ano}.png`)}
          />
          <button
            onClick={() => aoMudarAno(ano - 1)}
            aria-label="Ano anterior"
            className="grid size-11 place-items-center rounded-full bg-white ring-1 ring-slate-200 active:bg-slate-100 dark:bg-slate-900 dark:ring-slate-800"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={() => aoMudarAno(ano + 1)}
            aria-label="Próximo ano"
            className="grid size-11 place-items-center rounded-full bg-white ring-1 ring-slate-200 active:bg-slate-100 dark:bg-slate-900 dark:ring-slate-800"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
      <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
        {aBordo} dias a bordo · toque num mês para abrir
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
        {meses.map((dias, i) => (
          <MiniMes key={i} dias={dias} hoje={hoje} aoTocar={() => aoEscolherMes(i + 1)} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
        {CATEGORIAS.filter((c) => c === 'embarcado' || c === 'folga' || presentes.has(c)).map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className={`size-4 rounded ${COR_LEGENDA[c]}`} />
            {ROTULO_CATEGORIA[c]}
          </span>
        ))}
      </div>
    </div>
  );
}
