import { Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { excluirAjuste, salvarAjuste } from '../../dados/db';
import { recalcularHistorico } from '../../dados/historico';
import { useHoje } from '../../dados/hooks';
import {
  TIPOS_AJUSTE,
  efeitoAjuste,
  validarAjuste,
  type Ajuste,
  type AposAjuste,
  type TipoAjuste,
} from '../../dominio/ajustes';
import {
  diaISO,
  ehDiaISO,
  partes,
  primeiroDiaDoMes,
  somarDias,
  somarMeses,
  ultimoDiaDoMes,
  type DiaISO,
} from '../../dominio/datas';
import { projetarEscala, type EntradaEscala, type PeriodoEmbarque } from '../../dominio/escala';
import { comAjuste, preverAjuste, semAjuste } from '../../dominio/previa';
import { compacta, diaMes } from '../../formatacao';
import { MiniMes } from '../MiniMes';
import { INFO_AJUSTE } from './infoAjuste';

interface Props {
  entrada: EntradaEscala;
  ajuste?: Ajuste;
  dataSugerida?: DiaISO;
  aoFechar: () => void;
}

const CAMPO =
  'h-12 w-full rounded-xl bg-white px-4 text-base ring-1 ring-slate-300 dark:bg-slate-950 dark:ring-slate-700';

export function FormAjuste({ entrada, ajuste, dataSugerida, aoFechar }: Props) {
  const hojeSP = useHoje();
  const [tipo, setTipo] = useState<TipoAjuste | null>(ajuste?.tipo ?? null);
  const [inicio, setInicio] = useState<string>(ajuste?.inicio ?? dataSugerida ?? '');
  const [fim, setFim] = useState<string>(ajuste?.fim ?? dataSugerida ?? '');
  const [estadoTroca, setEstadoTroca] = useState<'embarcado' | 'folga' | undefined>(ajuste?.estadoTroca);
  const [colega, setColega] = useState(ajuste?.colega ?? '');
  const [observacao, setObservacao] = useState(ajuste?.observacao ?? '');
  const [aposAjuste, setAposAjuste] = useState<AposAjuste>(ajuste?.aposAjuste ?? 'retomar_ciclo');
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  const rascunho: Ajuste | null = useMemo(() => {
    if (!tipo || !ehDiaISO(inicio) || !ehDiaISO(fim)) return null;
    return {
      id: ajuste?.id,
      tipo,
      inicio: diaISO(inicio),
      fim: diaISO(fim),
      observacao,
      colega: tipo === 'troca' ? colega : undefined,
      estadoTroca: tipo === 'troca' ? estadoTroca : undefined,
      aposAjuste,
    };
  }, [ajuste?.id, tipo, inicio, fim, observacao, colega, estadoTroca, aposAjuste]);

  const erros = rascunho ? validarAjuste(rascunho) : [];
  const previa = useMemo(
    () => (rascunho && erros.length === 0 ? preverAjuste(entrada, rascunho) : null),
    [entrada, rascunho, erros.length],
  );

  async function confirmar() {
    if (!rascunho || erros.length > 0) return;
    const id = await salvarAjuste(rascunho);
    const faixas = ajuste ? [ajuste, rascunho] : [rascunho];
    await recalcularHistorico(entrada, comAjuste(entrada, { ...rascunho, id }), faixas, hojeSP);
    aoFechar();
  }

  async function excluir() {
    if (ajuste?.id === undefined) return;
    await excluirAjuste(ajuste.id);
    await recalcularHistorico(entrada, semAjuste(entrada, ajuste.id), [ajuste], hojeSP);
    aoFechar();
  }

  return (
    <div className="space-y-5">
      <Secao titulo="1. Tipo de ajuste">
        <div className="grid grid-cols-2 gap-2">
          {TIPOS_AJUSTE.map((t) => {
            const { rotulo, Icone } = INFO_AJUSTE[t];
            const ativo = tipo === t;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={ativo}
                onClick={() => setTipo(t)}
                className={`flex h-12 items-center gap-2 rounded-xl px-3 text-left font-semibold ring-1 ${
                  ativo
                    ? 'bg-ajuste text-white ring-ajuste'
                    : 'bg-white ring-slate-300 active:bg-slate-100 dark:bg-slate-950 dark:ring-slate-700'
                }`}
              >
                <Icone size={18} aria-hidden /> {rotulo}
              </button>
            );
          })}
        </div>
        {tipo && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{INFO_AJUSTE[tipo].descricao}</p>}
      </Secao>

      {tipo && (
        <>
          <Secao titulo="2. Datas" ajuda={INFO_AJUSTE[tipo].ajudaDatas}>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">De</span>
                <input
                  id="ajuste-inicio"
                  type="date"
                  value={inicio}
                  onChange={(e) => {
                    setInicio(e.target.value);
                    if (!fim || e.target.value > fim) setFim(e.target.value);
                  }}
                  className={CAMPO}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Até</span>
                <input
                  id="ajuste-fim"
                  type="date"
                  value={fim}
                  min={inicio || undefined}
                  onChange={(e) => setFim(e.target.value)}
                  className={CAMPO}
                />
              </label>
            </div>

            {tipo === 'troca' && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium">Nesses dias você fica…</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['embarcado', 'folga'] as const).map((e) => (
                    <button
                      key={e}
                      type="button"
                      aria-pressed={estadoTroca === e}
                      onClick={() => setEstadoTroca(e)}
                      className={`h-12 rounded-xl font-semibold ring-1 ${
                        estadoTroca === e
                          ? e === 'embarcado'
                            ? 'bg-embarcado text-white ring-embarcado'
                            : 'bg-folga text-white ring-folga'
                          : 'bg-white ring-slate-300 dark:bg-slate-950 dark:ring-slate-700'
                      }`}
                    >
                      {e === 'embarcado' ? 'Embarcado' : 'De folga'}
                    </button>
                  ))}
                </div>
                <input
                  id="ajuste-colega"
                  value={colega}
                  onChange={(e) => setColega(e.target.value)}
                  placeholder="Nome do colega (opcional)"
                  className={CAMPO}
                />
              </div>
            )}

            <input
              id="ajuste-observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Observação (opcional)"
              className={`${CAMPO} mt-3`}
            />
          </Secao>

          <Secao titulo="3. Depois do ajuste">
            <div className="space-y-2">
              <Opcao
                marcada={aposAjuste === 'retomar_ciclo'}
                aoEscolher={() => setAposAjuste('retomar_ciclo')}
                titulo="Voltar ao ciclo original"
                texto="Só esses dias mudam. Os próximos embarques continuam nas datas de antes."
              />
              <Opcao
                marcada={aposAjuste === 'reancorar'}
                aoEscolher={() => setAposAjuste('reancorar')}
                titulo="Re-ancorar a escala"
                texto={textoReancorar(rascunho, entrada)}
              />
            </div>
          </Secao>

          <Secao titulo="4. Prévia">
            {rascunho && erros.length === 0 && rascunho.inicio < hojeSP && (
              <p className="mb-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                Este ajuste mexe em dias que já passaram: o histórico desses dias será atualizado.
              </p>
            )}
            {erros.length > 0 ? (
              <ul className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
                {erros.map((e) => (
                  <li key={e}>• {e}</li>
                ))}
              </ul>
            ) : !previa || !rascunho ? (
              <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                Escolha as datas para ver como a escala fica.
              </p>
            ) : (
              <Previa entrada={previa.entradaDepois} ajuste={rascunho} alterados={previa.diasAlterados} antes={previa.periodosAntes} depois={previa.periodosDepois} />
            )}
          </Secao>
        </>
      )}

      <div className="flex gap-2">
        {ajuste?.id !== undefined &&
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
              aria-label="Excluir ajuste"
              className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-red-600 active:bg-slate-200 dark:bg-slate-800"
            >
              <Trash2 size={22} />
            </button>
          ))}
        <button
          type="button"
          disabled={!previa || erros.length > 0}
          onClick={confirmar}
          className="h-14 flex-1 rounded-2xl bg-ajuste text-lg font-semibold text-white active:bg-violet-700 disabled:opacity-40"
        >
          {ajuste ? 'Salvar ajuste' : 'Confirmar ajuste'}
        </button>
      </div>
    </div>
  );
}

function textoReancorar(a: Ajuste | null, entrada: EntradaEscala): string {
  if (!a) return 'A escala recomeça a partir do fim do ajuste.';
  const x = entrada.parametros.regime.embarcado;
  if (a.tipo === 'antecipacao') return `Os ${x} dias a bordo passam a contar de ${diaMes(a.inicio)}.`;
  if (efeitoAjuste(a).aBordo) return `O último dia a bordo passa a ser ${diaMes(a.fim)} e a escala recomeça daí, com a folga completa.`;
  return `Você embarca em ${diaMes(somarDias(a.fim, 1))} e a escala recomeça daí.`;
}

function Previa({
  entrada,
  ajuste,
  alterados,
  antes,
  depois,
}: {
  entrada: EntradaEscala;
  ajuste: Ajuste;
  alterados: DiaISO[];
  antes: PeriodoEmbarque[];
  depois: PeriodoEmbarque[];
}) {
  const destacar = useMemo(() => new Set(alterados), [alterados]);
  const meses = useMemo(() => {
    // Mês do início do ajuste até o mês do fim (no máximo 3).
    const ini = partes(ajuste.inicio);
    const fi = partes(ajuste.fim);
    const total = Math.min(3, (fi.ano - ini.ano) * 12 + (fi.mes - ini.mes) + 1);
    return Array.from({ length: Math.max(1, total) }, (_, i) => {
      const m = somarMeses(ini.ano, ini.mes, i);
      return projetarEscala(entrada, primeiroDiaDoMes(m.ano, m.mes), ultimoDiaDoMes(m.ano, m.mes));
    });
  }, [entrada, ajuste.inicio, ajuste.fim]);

  if (alterados.length === 0) {
    return (
      <p className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
        Nada muda na escala com esse ajuste (esses dias já estavam assim).
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-violet-50 p-3 dark:bg-violet-950/40">
        <p className="mb-2 text-sm font-semibold text-violet-900 dark:text-violet-200">
          Próximos embarques (antes → depois)
        </p>
        <ul className="space-y-1 text-sm">
          {depois.map((p, i) => {
            const a = antes[i];
            const mudou = !a || a.embarque !== p.embarque || a.desembarque !== p.desembarque;
            return (
              <li key={p.embarque} className={mudou ? 'font-semibold' : 'text-slate-500 dark:text-slate-400'}>
                {a && mudou && (
                  <span className="text-slate-400 line-through">
                    {diaMes(a.embarque)}–{diaMes(a.desembarque)}
                  </span>
                )}
                {a && mudou && ' → '}
                {diaMes(p.embarque)}–{diaMes(p.desembarque)}
                <span className="font-normal text-slate-500 dark:text-slate-400"> · {p.dias} dias</span>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Dias que mudam aparecem com contorno roxo. Primeiro dia afetado: {compacta(alterados[0]!)}.
      </p>
      <div className="grid gap-4">
        {meses.map((dias) => (
          <MiniMes key={dias[0]!.data} dias={dias} destacar={destacar} />
        ))}
      </div>
    </div>
  );
}

function Secao({ titulo, ajuda, children }: { titulo: string; ajuda?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="font-semibold">{titulo}</h3>
      {ajuda ? <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">{ajuda}</p> : <div className="mb-2" />}
      {children}
    </section>
  );
}

function Opcao(props: { marcada: boolean; aoEscolher: () => void; titulo: string; texto: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.marcada}
      onClick={props.aoEscolher}
      className={`flex w-full items-start gap-3 rounded-xl p-3 text-left ring-1 ${
        props.marcada
          ? 'bg-violet-50 ring-ajuste dark:bg-violet-950/40'
          : 'bg-white ring-slate-300 dark:bg-slate-950 dark:ring-slate-700'
      }`}
    >
      <span
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${
          props.marcada ? 'border-ajuste' : 'border-slate-400'
        }`}
      >
        {props.marcada && <span className="size-2.5 rounded-full bg-ajuste" />}
      </span>
      <span>
        <span className="block font-medium">{props.titulo}</span>
        <span className="block text-sm text-slate-500 dark:text-slate-400">{props.texto}</span>
      </span>
    </button>
  );
}
