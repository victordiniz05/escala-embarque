import { Anchor, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { COR_CELULA, COR_LEGENDA } from '../componentes/cores';
import { FolhaInferior } from '../componentes/FolhaInferior';
import { useHoje } from '../dados/hooks';
import {
  diaDaSemana,
  partes,
  primeiroDiaDoMes,
  somarMeses,
  ultimoDiaDoMes,
} from '../dominio/datas';
import { projetarEscala, type EntradaEscala } from '../dominio/escala';
import type { Categoria, DiaEscala } from '../dominio/tipos';
import { NOMES_MESES, ROTULO_CATEGORIA, capitalizar, diaMes, porExtenso } from '../formatacao';

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export function Calendario({ entrada }: { entrada: EntradaEscala }) {
  const hojeSP = useHoje();
  const [mes, setMes] = useState(() => {
    const p = partes(hojeSP);
    return { ano: p.ano, mes: p.mes };
  });
  const [selecionado, setSelecionado] = useState<DiaEscala | null>(null);

  const dias = useMemo(
    () => projetarEscala(entrada, primeiroDiaDoMes(mes.ano, mes.mes), ultimoDiaDoMes(mes.ano, mes.mes)),
    [entrada, mes],
  );
  const vazios = diaDaSemana(dias[0]!.data);
  const ehMesAtual = partes(hojeSP).ano === mes.ano && partes(hojeSP).mes === mes.mes;

  const mudar = (n: number) => setMes((m) => somarMeses(m.ano, m.mes, n));
  const irParaHoje = () => {
    const p = partes(hojeSP);
    setMes({ ano: p.ano, mes: p.mes });
  };

  // Deslizar para os lados troca de mês.
  const toqueX = useRef<number | null>(null);
  const resumo = useMemo(() => {
    const aBordo = dias.filter((d) => d.aBordo).length;
    return { aBordo, folga: dias.length - aBordo };
  }, [dias]);

  return (
    <div>
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">
          {NOMES_MESES[mes.mes - 1]} <span className="font-normal text-slate-400">{mes.ano}</span>
        </h1>
        {!ehMesAtual && (
          <button
            onClick={irParaHoje}
            className="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold active:bg-slate-300 dark:bg-slate-800"
          >
            Hoje
          </button>
        )}
      </header>

      <div className="mb-2 flex items-center justify-between">
        <BotaoSeta aoClicar={() => mudar(-1)} rotulo="Mês anterior">
          <ChevronLeft size={26} />
        </BotaoSeta>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {resumo.aBordo} embarcado · {resumo.folga} folga
        </p>
        <BotaoSeta aoClicar={() => mudar(1)} rotulo="Próximo mês">
          <ChevronRight size={26} />
        </BotaoSeta>
      </div>

      <div
        onTouchStart={(e) => (toqueX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const inicio = toqueX.current;
          const fim = e.changedTouches[0]?.clientX;
          toqueX.current = null;
          if (inicio == null || fim == null) return;
          if (fim - inicio > 60) mudar(-1);
          else if (inicio - fim > 60) mudar(1);
        }}
      >
        <div className="grid grid-cols-7 gap-1.5 pb-1 text-center text-xs font-semibold text-slate-400">
          {SEMANA.map((s, i) => (
            <div key={i}>{s}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: vazios }, (_, i) => (
            <div key={`v${i}`} />
          ))}
          {dias.map((d) => (
            <CelulaDia key={d.data} dia={d} hoje={d.data === hojeSP} aoTocar={() => setSelecionado(d)} />
          ))}
        </div>
      </div>

      <Legenda />

      <FolhaInferior
        aberta={selecionado !== null}
        aoFechar={() => setSelecionado(null)}
        titulo={selecionado ? porExtenso(selecionado.data) : ''}
      >
        {selecionado && <DetalheDia dia={selecionado} />}
      </FolhaInferior>
    </div>
  );
}

function CelulaDia({ dia, hoje, aoTocar }: { dia: DiaEscala; hoje: boolean; aoTocar: () => void }) {
  const troca = dia.marcos.length > 0;
  return (
    <button
      onClick={aoTocar}
      aria-label={`${porExtenso(dia.data)}: ${ROTULO_CATEGORIA[dia.categoria]}${troca ? `, ${dia.marcos.join(' e ')}` : ''}`}
      className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-lg font-semibold tabular-nums active:scale-95 ${
        COR_CELULA[dia.categoria]
      } ${hoje ? 'ring-[3px] ring-slate-900 ring-offset-2 ring-offset-slate-50 dark:ring-white dark:ring-offset-slate-950' : ''}`}
    >
      {partes(dia.data).dia}
      {troca && (
        <Anchor
          size={11}
          strokeWidth={3}
          className={`absolute top-1 right-1 ${dia.aBordo ? 'text-white/90' : 'text-embarcado'}`}
          aria-hidden
        />
      )}
    </button>
  );
}

function Legenda() {
  const itens: Categoria[] = ['embarcado', 'folga', 'viagem'];
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
      {itens.map((c) => (
        <span key={c} className="flex items-center gap-1.5">
          <span className={`size-4 rounded ${COR_LEGENDA[c]}`} />
          {ROTULO_CATEGORIA[c]}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <Anchor size={14} className="text-embarcado" /> Troca de turma
      </span>
    </div>
  );
}

function DetalheDia({ dia }: { dia: DiaEscala }) {
  const nomePeriodo = dia.aBordo ? 'embarque' : 'folga';
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className={`rounded-lg px-3 py-1 text-sm font-semibold ${COR_CELULA[dia.categoria]}`}>
          {ROTULO_CATEGORIA[dia.categoria]}
        </span>
        {dia.marcos.map((m) => (
          <span key={m} className="flex items-center gap-1 text-sm font-semibold text-embarcado">
            <Anchor size={14} /> {m === 'embarque' ? 'Embarque' : 'Desembarque'}
          </span>
        ))}
      </div>
      <p className="text-lg">
        Dia <strong>{dia.periodo.dia}</strong> de {dia.periodo.total} de {nomePeriodo}
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {capitalizar(nomePeriodo)}: {diaMes(dia.periodo.inicio)} → {diaMes(dia.periodo.fim)}
      </p>
      <button
        disabled
        className="h-12 w-full rounded-2xl bg-slate-100 font-semibold text-slate-400 dark:bg-slate-800"
        title="Disponível na próxima etapa"
      >
        Criar ajuste neste dia (em breve)
      </button>
    </div>
  );
}

function BotaoSeta({ children, aoClicar, rotulo }: { children: ReactNode; aoClicar: () => void; rotulo: string }) {
  return (
    <button
      onClick={aoClicar}
      aria-label={rotulo}
      className="grid size-11 place-items-center rounded-full bg-white ring-1 ring-slate-200 active:bg-slate-100 dark:bg-slate-900 dark:ring-slate-800"
    >
      {children}
    </button>
  );
}
