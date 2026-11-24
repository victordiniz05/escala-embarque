import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { RegistroAjuste } from '../../dados/db';
import type { DiaISO } from '../../dominio/datas';
import type { EntradaEscala } from '../../dominio/escala';
import { diaMes } from '../../formatacao';
import { Cartao } from '../Cartao';
import { FolhaInferior } from '../FolhaInferior';
import { FormAjuste } from './FormAjuste';
import { INFO_AJUSTE } from './infoAjuste';

export type EdicaoAjuste = { ajuste?: RegistroAjuste; dataSugerida?: DiaISO } | null;

/** Lista de ajustes de escala (tela de configurações). */
export function ListaAjustes({ entrada, ajustes }: { entrada: EntradaEscala; ajustes: RegistroAjuste[] }) {
  const [edicao, setEdicao] = useState<EdicaoAjuste>(null);
  const ordenados = [...ajustes].sort((a, b) => (a.inicio < b.inicio ? 1 : -1));

  return (
    <Cartao>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-semibold">Ajustes de escala</h2>
        <button
          onClick={() => setEdicao({})}
          className="-mr-1 flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1.5 text-sm font-semibold text-ajuste active:bg-violet-100 dark:bg-violet-950/50 dark:text-violet-300"
        >
          <Plus size={16} /> Novo
        </button>
      </div>
      {ordenados.length === 0 ? (
        <p className="py-1 text-sm text-slate-500 dark:text-slate-400">
          Dobra, troca, curso, férias… Também dá para criar tocando no dia, no calendário.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {ordenados.map((a) => {
            const { rotulo, Icone } = INFO_AJUSTE[a.tipo];
            const detalhe = [a.colega && `com ${a.colega}`, a.observacao].filter(Boolean).join(' · ');
            return (
              <li key={a.id}>
                <button onClick={() => setEdicao({ ajuste: a })} className="flex w-full items-center gap-3 py-3 text-left">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-100 text-ajuste dark:bg-violet-950 dark:text-violet-300">
                    <Icone size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {rotulo} · {a.inicio === a.fim ? diaMes(a.inicio) : `${diaMes(a.inicio)} → ${diaMes(a.fim)}`}
                    </span>
                    {detalhe && <span className="block truncate text-sm text-slate-500 dark:text-slate-400">{detalhe}</span>}
                  </span>
                  {a.aposAjuste === 'reancorar' && (
                    <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-ajuste dark:bg-violet-950 dark:text-violet-300">
                      re-ancorado
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <FolhaAjuste entrada={entrada} edicao={edicao} aoFechar={() => setEdicao(null)} />
    </Cartao>
  );
}

export function FolhaAjuste({
  entrada,
  edicao,
  aoFechar,
}: {
  entrada: EntradaEscala;
  edicao: EdicaoAjuste;
  aoFechar: () => void;
}) {
  return (
    <FolhaInferior
      aberta={edicao !== null}
      aoFechar={aoFechar}
      titulo={edicao?.ajuste ? 'Editar ajuste' : 'Novo ajuste de escala'}
    >
      {edicao && (
        <FormAjuste
          key={edicao.ajuste?.id ?? `novo-${edicao.dataSugerida ?? ''}`}
          entrada={entrada}
          ajuste={edicao.ajuste}
          dataSugerida={edicao.dataSugerida}
          aoFechar={aoFechar}
        />
      )}
    </FolhaInferior>
  );
}
