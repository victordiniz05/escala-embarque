import { History } from 'lucide-react';
import { useState } from 'react';
import { refazerHistorico } from '../dados/historico';
import { useHoje, useInicioHistorico } from '../dados/hooks';
import type { EntradaEscala } from '../dominio/escala';
import { curta } from '../formatacao';
import { Cartao } from './Cartao';

/** Resumo do histórico (escala realizada) e opção de refazer. */
export function CartaoHistorico({ entrada, totalGravados }: { entrada: EntradaEscala; totalGravados: number }) {
  const hojeSP = useHoje();
  const inicio = useInicioHistorico();
  const [confirmar, setConfirmar] = useState(false);
  const [refazendo, setRefazendo] = useState(false);

  async function refazer() {
    setRefazendo(true);
    await refazerHistorico(entrada, hojeSP);
    setRefazendo(false);
    setConfirmar(false);
  }

  return (
    <Cartao>
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <History size={18} aria-hidden /> Histórico
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {inicio ? `Desde ${curta(inicio)} · ${totalGravados} dias gravados.` : 'Ainda sem dias gravados.'}
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Os dias que já passaram ficam gravados como foram. Mudar a escala só vale de hoje em diante. Para corrigir
        o passado, crie um ajuste naqueles dias pelo calendário.
      </p>
      {confirmar ? (
        <div className="mt-3 space-y-2 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            O histórico será apagado e preenchido de novo pela escala e pelos ajustes atuais. Use se a configuração
            inicial estava errada.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmar(false)}
              className="h-11 flex-1 rounded-xl bg-white font-semibold ring-1 ring-slate-300 dark:bg-slate-900 dark:ring-slate-700"
            >
              Cancelar
            </button>
            <button
              onClick={refazer}
              disabled={refazendo}
              className="h-11 flex-1 rounded-xl bg-amber-600 font-semibold text-white active:bg-amber-700 disabled:opacity-50"
            >
              {refazendo ? 'Refazendo…' : 'Refazer agora'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmar(true)}
          className="mt-3 h-11 w-full rounded-xl bg-slate-100 text-sm font-semibold active:bg-slate-200 dark:bg-slate-800"
        >
          Refazer histórico pela escala atual
        </button>
      )}
    </Cartao>
  );
}
