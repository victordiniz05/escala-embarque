import { ChevronDown, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { RegistroEvento } from '../../dados/db';
import { useEventos, useHoje } from '../../dados/hooks';
import type { DiaISO } from '../../dominio/datas';
import type { EntradaEscala } from '../../dominio/escala';
import { fimDoEvento, verificarEvento } from '../../dominio/eventos';
import { compacta, diaMes } from '../../formatacao';
import { Cartao } from '../Cartao';
import { FolhaInferior } from '../FolhaInferior';
import { SeloDisponibilidade } from './CartaoResultado';
import { FormEvento } from './FormEvento';
import { contagem, descreverResultado } from './textoEvento';

type Edicao = { evento?: RegistroEvento; dataSugerida?: DiaISO } | null;

/** Cartão "Meus eventos" da tela Início. */
export function ListaEventos({ entrada }: { entrada: EntradaEscala }) {
  const hojeSP = useHoje();
  const eventos = useEventos();
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [verPassados, setVerPassados] = useState(false);

  const itens = useMemo(
    () => eventos.map((e) => ({ evento: e, resultado: verificarEvento(entrada, e, hojeSP) })),
    [eventos, entrada, hojeSP],
  );
  const futuros = itens.filter((i) => fimDoEvento(i.evento) >= hojeSP);
  const passados = itens.filter((i) => fimDoEvento(i.evento) < hojeSP).reverse();

  return (
    <Cartao>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Meus eventos</p>
        <button
          onClick={() => setEdicao({})}
          className="-mr-1 flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-embarcado active:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300"
        >
          <Plus size={16} /> Adicionar
        </button>
      </div>

      {futuros.length === 0 ? (
        <p className="py-2 text-sm text-slate-500 dark:text-slate-400">
          Cadastre um compromisso (ex.: ETAPA SP em 16/05) e o app diz se você estará embarcado ou de folga.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {futuros.map(({ evento, resultado }) => (
            <li key={evento.id}>
              <button onClick={() => setEdicao({ evento })} className="flex w-full items-center gap-3 py-3 text-left">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{evento.nome}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {evento.fim ? `${diaMes(evento.inicio)} → ${diaMes(evento.fim)}` : compacta(evento.inicio)} ·{' '}
                    {contagem(resultado.diasAte)}
                  </p>
                  <p className="mt-0.5 text-sm">{descreverResultado(resultado).frase}</p>
                </div>
                <SeloDisponibilidade disponibilidade={resultado.disponibilidade} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {passados.length > 0 && (
        <div className="mt-1 border-t border-slate-100 pt-2 dark:border-slate-800">
          <button
            onClick={() => setVerPassados((v) => !v)}
            className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400"
            aria-expanded={verPassados}
          >
            <ChevronDown size={16} className={verPassados ? 'rotate-180' : ''} />
            Eventos que já passaram ({passados.length})
          </button>
          {verPassados && (
            <ul className="mt-1 opacity-70">
              {passados.map(({ evento, resultado }) => (
                <li key={evento.id}>
                  <button onClick={() => setEdicao({ evento })} className="flex w-full items-center gap-3 py-2 text-left text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {evento.nome} · {compacta(evento.inicio)}
                    </span>
                    <SeloDisponibilidade disponibilidade={resultado.disponibilidade} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <FolhaEvento entrada={entrada} edicao={edicao} aoFechar={() => setEdicao(null)} />
    </Cartao>
  );
}

/** Painel inferior com o formulário de evento (usado também pelo Calendário). */
export function FolhaEvento({
  entrada,
  edicao,
  aoFechar,
}: {
  entrada: EntradaEscala;
  edicao: Edicao;
  aoFechar: () => void;
}) {
  return (
    <FolhaInferior aberta={edicao !== null} aoFechar={aoFechar} titulo={edicao?.evento ? 'Editar evento' : 'Novo evento'}>
      {edicao && (
        <FormEvento
          key={edicao.evento?.id ?? `novo-${edicao.dataSugerida ?? ''}`}
          entrada={entrada}
          evento={edicao.evento}
          dataSugerida={edicao.dataSugerida}
          aoFechar={aoFechar}
        />
      )}
    </FolhaInferior>
  );
}
