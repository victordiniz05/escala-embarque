import { Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { excluirEvento, salvarEvento, type RegistroEvento } from '../../dados/db';
import { useHoje } from '../../dados/hooks';
import { diaISO, ehDiaISO, type DiaISO } from '../../dominio/datas';
import type { EntradaEscala } from '../../dominio/escala';
import { LIMITES } from '../../dominio/backup';
import { verificarEvento } from '../../dominio/eventos';
import { CartaoResultado } from './CartaoResultado';
import { contagem } from './textoEvento';

interface Props {
  entrada: EntradaEscala;
  /** Evento existente (editar) ou data sugerida (novo). */
  evento?: RegistroEvento;
  dataSugerida?: DiaISO;
  aoFechar: () => void;
}

const CAMPO =
  'h-12 w-full rounded-xl bg-white px-4 text-base ring-1 ring-slate-300 dark:bg-slate-950 dark:ring-slate-700';

export function FormEvento({ entrada, evento, dataSugerida, aoFechar }: Props) {
  const hojeSP = useHoje();
  const [nome, setNome] = useState(evento?.nome ?? '');
  const [inicio, setInicio] = useState<string>(evento?.inicio ?? dataSugerida ?? '');
  const [variosDias, setVariosDias] = useState(Boolean(evento?.fim));
  const [fim, setFim] = useState<string>(evento?.fim ?? '');
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  const dataOk = ehDiaISO(inicio);
  const fimOk = !variosDias || (ehDiaISO(fim) && fim >= inicio);
  const podeSalvar = nome.trim().length > 0 && dataOk && fimOk;

  const resultado = useMemo(() => {
    if (!dataOk || !fimOk) return null;
    return verificarEvento(
      entrada,
      { nome, inicio: diaISO(inicio), fim: variosDias ? diaISO(fim) : undefined },
      hojeSP,
    );
  }, [entrada, nome, inicio, fim, variosDias, dataOk, fimOk, hojeSP]);

  async function salvar() {
    if (!podeSalvar) return;
    await salvarEvento(
      { nome, inicio: diaISO(inicio), fim: variosDias ? diaISO(fim) : undefined },
      evento?.id,
    );
    aoFechar();
  }

  async function excluir() {
    if (evento?.id === undefined) return;
    await excluirEvento(evento.id);
    aoFechar();
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Nome</span>
        <input
          id="evento-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: ETAPA SP, aniversário da mãe"
          maxLength={LIMITES.nome}
          className={CAMPO}
          enterKeyHint="done"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className={variosDias ? 'block' : 'col-span-2 block'}>
          <span className="mb-1 block text-sm font-medium">{variosDias ? 'De' : 'Data'}</span>
          <input id="evento-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={CAMPO} />
        </label>
        {variosDias && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Até</span>
            <input
              id="evento-fim"
              type="date"
              value={fim}
              min={inicio || undefined}
              onChange={(e) => setFim(e.target.value)}
              className={CAMPO}
            />
          </label>
        )}
      </div>

      <label className="flex items-center gap-3 py-1">
        <input
          id="evento-varios"
          type="checkbox"
          checked={variosDias}
          onChange={(e) => setVariosDias(e.target.checked)}
          className="size-5 accent-blue-600"
        />
        <span>Dura mais de um dia</span>
      </label>

      {resultado ? (
        <div>
          <p className="mb-1 text-sm text-slate-500 dark:text-slate-400">Resposta ({contagem(resultado.diasAte)})</p>
          <CartaoResultado resultado={resultado} />
        </div>
      ) : (
        <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {variosDias && dataOk ? 'Escolha a data final para ver a resposta.' : 'Escolha a data para saber se você estará embarcado ou de folga.'}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        {evento?.id !== undefined &&
          (confirmarExclusao ? (
            <button
              type="button"
              onClick={excluir}
              className="h-14 flex-1 rounded-2xl bg-red-600 font-semibold text-white active:bg-red-700"
            >
              Confirmar exclusão
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmarExclusao(true)}
              aria-label="Excluir evento"
              className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-red-600 active:bg-slate-200 dark:bg-slate-800"
            >
              <Trash2 size={22} />
            </button>
          ))}
        <button
          type="submit"
          disabled={!podeSalvar}
          className="h-14 flex-1 rounded-2xl bg-embarcado text-lg font-semibold text-white active:bg-blue-700 disabled:opacity-40"
        >
          {evento ? 'Salvar' : 'Salvar evento'}
        </button>
      </div>
    </form>
  );
}
