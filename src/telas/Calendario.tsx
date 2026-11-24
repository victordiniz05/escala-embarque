import { Anchor, CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { COR_CELULA, COR_LEGENDA } from '../componentes/cores';
import { SeloDisponibilidade } from '../componentes/eventos/CartaoResultado';
import { FolhaEvento } from '../componentes/eventos/ListaEventos';
import { FolhaInferior } from '../componentes/FolhaInferior';
import type { RegistroEvento } from '../dados/db';
import { useEventos, useHoje } from '../dados/hooks';
import {
  type DiaISO,
  diaDaSemana,
  partes,
  primeiroDiaDoMes,
  somarMeses,
  ultimoDiaDoMes,
} from '../dominio/datas';
import { projetarEscala, type EntradaEscala } from '../dominio/escala';
import { fimDoEvento, verificarEvento } from '../dominio/eventos';
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
  const [edicao, setEdicao] = useState<{ evento?: RegistroEvento; dataSugerida?: DiaISO } | null>(null);
  const eventos = useEventos();
  const eventosDoDia = (d: DiaISO) => eventos.filter((e) => e.inicio <= d && d <= fimDoEvento(e));

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
            <CelulaDia
              key={d.data}
              dia={d}
              hoje={d.data === hojeSP}
              temEvento={eventosDoDia(d.data).length > 0}
              aoTocar={() => setSelecionado(d)}
            />
          ))}
        </div>
      </div>

      <Legenda />

      <FolhaInferior
        aberta={selecionado !== null}
        aoFechar={() => setSelecionado(null)}
        titulo={selecionado ? porExtenso(selecionado.data) : ''}
      >
        {selecionado && (
          <DetalheDia
            dia={selecionado}
            eventos={eventosDoDia(selecionado.data)}
            entrada={entrada}
            hoje={hojeSP}
            aoAbrirEvento={(evento) => {
              setSelecionado(null);
              setEdicao({ evento });
            }}
            aoNovoEvento={() => {
              setSelecionado(null);
              setEdicao({ dataSugerida: selecionado.data });
            }}
          />
        )}
      </FolhaInferior>

      <FolhaEvento entrada={entrada} edicao={edicao} aoFechar={() => setEdicao(null)} />
    </div>
  );
}

function CelulaDia({
  dia,
  hoje,
  temEvento,
  aoTocar,
}: {
  dia: DiaEscala;
  hoje: boolean;
  temEvento: boolean;
  aoTocar: () => void;
}) {
  const troca = dia.marcos.length > 0;
  return (
    <button
      onClick={aoTocar}
      aria-label={`${porExtenso(dia.data)}: ${ROTULO_CATEGORIA[dia.categoria]}${troca ? `, ${dia.marcos.join(' e ')}` : ''}${temEvento ? ', tem evento' : ''}`}
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
      {temEvento && (
        <span
          className={`absolute bottom-1.5 size-1.5 rounded-full ${dia.aBordo ? 'bg-white' : 'bg-rose-500'}`}
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
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-rose-500" /> Evento
      </span>
    </div>
  );
}

interface PropsDetalhe {
  dia: DiaEscala;
  eventos: RegistroEvento[];
  entrada: EntradaEscala;
  hoje: DiaISO;
  aoAbrirEvento: (e: RegistroEvento) => void;
  aoNovoEvento: () => void;
}

function DetalheDia({ dia, eventos, entrada, hoje, aoAbrirEvento, aoNovoEvento }: PropsDetalhe) {
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
      {eventos.length > 0 && (
        <ul className="space-y-1.5">
          {eventos.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => aoAbrirEvento(e)}
                className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-left dark:bg-slate-800"
              >
                <span className="size-2 shrink-0 rounded-full bg-rose-500" />
                <span className="min-w-0 flex-1 truncate font-medium">{e.nome}</span>
                <SeloDisponibilidade disponibilidade={verificarEvento(entrada, e, hoje).disponibilidade} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        onClick={aoNovoEvento}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-50 font-semibold text-embarcado active:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300"
      >
        <CalendarPlus size={20} /> Adicionar evento neste dia
      </button>
      <button
        disabled
        className="h-12 w-full rounded-2xl bg-slate-100 font-semibold text-slate-400 dark:bg-slate-800"
        title="Disponível na próxima etapa"
      >
        Criar ajuste de escala (em breve)
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
