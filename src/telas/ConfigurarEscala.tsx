import { Minus, Plus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { salvarConfiguracao, type RegistroConfiguracao } from '../dados/db';
import { useHoje } from '../dados/hooks';
import { diaISO, ehDiaISO, type DiaISO } from '../dominio/datas';
import { proximosPeriodos } from '../dominio/escala';
import { REGIMES_PADRAO, nomeRegime, validarParametros } from '../dominio/regimes';
import type { ParametrosEscala, RegraDesembarque } from '../dominio/tipos';
import { diaMes } from '../formatacao';

interface Props {
  /** Configuração atual (ao editar). Sem ela, é a primeira configuração. */
  atual?: { configuracao: RegistroConfiguracao; dataEmbarque: DiaISO };
  aoSalvar?: () => void;
  aoCancelar?: () => void;
}

const PERSONALIZADO = 'personalizado';

export function ConfigurarEscala({ atual, aoSalvar, aoCancelar }: Props) {
  const hojeSP = useHoje();
  const cfg = atual?.configuracao;

  const regimeInicial = cfg ? nomeRegime(cfg.regime) : '14x14';
  const [escolha, setEscolha] = useState(
    REGIMES_PADRAO.some((r) => nomeRegime(r) === regimeInicial) ? regimeInicial : PERSONALIZADO,
  );
  const [embarcado, setEmbarcado] = useState(String(cfg?.regime.embarcado ?? 28));
  const [folga, setFolga] = useState(String(cfg?.regime.folga ?? 14));
  const [dataEmbarque, setDataEmbarque] = useState<string>(atual?.dataEmbarque ?? hojeSP);
  const [regra, setRegra] = useState<RegraDesembarque>(cfg?.regraDesembarque ?? 'conta_embarcado');
  const [viagemAntes, setViagemAntes] = useState(cfg?.diasViagemAntes ?? 0);
  const [viagemDepois, setViagemDepois] = useState(cfg?.diasViagemDepois ?? 0);
  const [embarcacao, setEmbarcacao] = useState(cfg?.embarcacao ?? '');
  const [empresa, setEmpresa] = useState(cfg?.empresa ?? '');
  const [salvando, setSalvando] = useState(false);

  const parametros: ParametrosEscala = useMemo(() => {
    const regime =
      escolha === PERSONALIZADO
        ? { embarcado: Number(embarcado), folga: Number(folga) }
        : REGIMES_PADRAO.find((r) => nomeRegime(r) === escolha)!;
    return { regime, regraDesembarque: regra, diasViagemAntes: viagemAntes, diasViagemDepois: viagemDepois };
  }, [escolha, embarcado, folga, regra, viagemAntes, viagemDepois]);

  const diasABordo = Number.isInteger(parametros.regime.embarcado) && parametros.regime.embarcado > 0 ? parametros.regime.embarcado : 28;

  const erros = useMemo(() => {
    const e = validarParametros(parametros);
    if (!ehDiaISO(dataEmbarque)) e.push('Informe a data do embarque.');
    return e;
  }, [parametros, dataEmbarque]);

  const previa = useMemo(() => {
    if (erros.length > 0) return [];
    const ancora = diaISO(dataEmbarque);
    return proximosPeriodos({ parametros, ancoras: [{ dataEmbarque: ancora, vigenteDesde: ancora }] }, hojeSP, 3);
  }, [erros, parametros, dataEmbarque, hojeSP]);

  async function salvar() {
    if (erros.length > 0) return;
    setSalvando(true);
    await salvarConfiguracao({
      ...parametros,
      dataEmbarque: diaISO(dataEmbarque),
      embarcacao: embarcacao.trim(),
      empresa: empresa.trim(),
    });
    setSalvando(false);
    aoSalvar?.();
  }

  return (
    <div className="space-y-6">
      <Campo titulo="Regime de embarque" ajuda="Dias embarcado × dias de folga">
        <div className="grid grid-cols-3 gap-2">
          {[...REGIMES_PADRAO.map(nomeRegime), PERSONALIZADO].map((nome) => (
            <button
              key={nome}
              type="button"
              onClick={() => setEscolha(nome)}
              className={`h-14 rounded-xl text-base font-semibold ring-1 ${
                escolha === nome
                  ? 'bg-embarcado text-white ring-embarcado'
                  : 'bg-white ring-slate-300 active:bg-slate-100 dark:bg-slate-900 dark:ring-slate-700'
              }`}
            >
              {nome === PERSONALIZADO ? 'Outro' : nome}
            </button>
          ))}
        </div>
        {escolha === PERSONALIZADO && (
          <div className="mt-3 flex items-center gap-3">
            <NumeroLivre rotulo="Embarcado" valor={embarcado} aoMudar={setEmbarcado} />
            <span className="pt-5 text-xl font-bold text-slate-400">×</span>
            <NumeroLivre rotulo="Folga" valor={folga} aoMudar={setFolga} />
          </div>
        )}
      </Campo>

      <Campo
        titulo="Data de um embarque"
        ajuda="O próximo ou o último dia em que você embarcou. Ela vira a âncora do ciclo."
      >
        <input
          type="date"
          value={dataEmbarque}
          onChange={(e) => setDataEmbarque(e.target.value)}
          className="h-14 w-full rounded-xl bg-white px-4 text-lg ring-1 ring-slate-300 dark:bg-slate-900 dark:ring-slate-700"
        />
      </Campo>

      <Campo titulo="Em que dia você desembarca?" ajuda="Cada empresa conta de um jeito.">
        <div className="space-y-2">
          <OpcaoRadio
            marcada={regra === 'conta_embarcado'}
            aoEscolher={() => setRegra('conta_embarcado')}
            titulo={`No ${diasABordo}º dia (último dia a bordo)`}
            texto="O dia do desembarque conta como dia embarcado."
          />
          <OpcaoRadio
            marcada={regra === 'conta_folga'}
            aoEscolher={() => {
              setRegra('conta_folga');
              // O dia da troca costuma ser também dia de viagem.
              if (viagemDepois === 0) setViagemDepois(1);
            }}
            titulo={`No ${diasABordo + 1}º dia (dia da troca)`}
            texto={`Você fica ${diasABordo} dias a bordo e desembarca no dia seguinte, que já conta como folga e aparece como viagem.`}
          />
        </div>
      </Campo>

      <Campo titulo="Dias de viagem (opcional)" ajuda="Dias da folga gastos no deslocamento. Aparecem em laranja.">
        <div className="space-y-2">
          <Contador rotulo="Antes do embarque" valor={viagemAntes} aoMudar={setViagemAntes} />
          <Contador rotulo="Depois do desembarque" valor={viagemDepois} aoMudar={setViagemDepois} />
        </div>
      </Campo>

      <Campo titulo="Embarcação e empresa (opcional)">
        <div className="space-y-2">
          <TextoLivre valor={embarcacao} aoMudar={setEmbarcacao} placeholder="Embarcação / plataforma" />
          <TextoLivre valor={empresa} aoMudar={setEmpresa} placeholder="Empresa" />
        </div>
      </Campo>

      {erros.length > 0 ? (
        <ul className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {erros.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl bg-blue-50 p-3 text-sm dark:bg-blue-950/40">
          <p className="mb-1 font-semibold text-blue-900 dark:text-blue-200">Prévia dos próximos embarques</p>
          <ul className="space-y-0.5 text-blue-900/80 dark:text-blue-100/80">
            {previa.map((p) => (
              <li key={p.embarque}>
                {diaMes(p.embarque)} → desembarque {diaMes(p.desembarque)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {atual && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          As mudanças valem de hoje em diante. Os dias que já passaram continuam como estão no histórico.
        </p>
      )}

      <div className="flex gap-3">
        {aoCancelar && (
          <button
            type="button"
            onClick={aoCancelar}
            className="h-14 flex-1 rounded-2xl bg-slate-200 text-lg font-semibold active:bg-slate-300 dark:bg-slate-800"
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          disabled={erros.length > 0 || salvando}
          onClick={salvar}
          className="h-14 flex-[2] rounded-2xl bg-embarcado text-lg font-semibold text-white active:bg-blue-700 disabled:opacity-40"
        >
          {atual ? 'Salvar alterações' : 'Começar'}
        </button>
      </div>
    </div>
  );
}

function Campo({ titulo, ajuda, children }: { titulo: string; ajuda?: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="text-base font-semibold">{titulo}</legend>
      {ajuda && <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">{ajuda}</p>}
      {!ajuda && <div className="mb-2" />}
      {children}
    </fieldset>
  );
}

function OpcaoRadio(props: { marcada: boolean; aoEscolher: () => void; titulo: string; texto: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.marcada}
      onClick={props.aoEscolher}
      className={`flex w-full items-start gap-3 rounded-xl p-3 text-left ring-1 ${
        props.marcada
          ? 'bg-blue-50 ring-embarcado dark:bg-blue-950/40'
          : 'bg-white ring-slate-300 dark:bg-slate-900 dark:ring-slate-700'
      }`}
    >
      <span
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${
          props.marcada ? 'border-embarcado' : 'border-slate-400'
        }`}
      >
        {props.marcada && <span className="size-2.5 rounded-full bg-embarcado" />}
      </span>
      <span>
        <span className="block font-medium">{props.titulo}</span>
        <span className="block text-sm text-slate-500 dark:text-slate-400">{props.texto}</span>
      </span>
    </button>
  );
}

function Contador({ rotulo, valor, aoMudar }: { rotulo: string; valor: number; aoMudar: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white p-2 pl-4 ring-1 ring-slate-300 dark:bg-slate-900 dark:ring-slate-700">
      <span>{rotulo}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Diminuir ${rotulo}`}
          onClick={() => aoMudar(Math.max(0, valor - 1))}
          className="grid size-11 place-items-center rounded-lg bg-slate-100 active:bg-slate-200 dark:bg-slate-800"
        >
          <Minus size={20} />
        </button>
        <span className="w-8 text-center text-lg font-semibold tabular-nums">{valor}</span>
        <button
          type="button"
          aria-label={`Aumentar ${rotulo}`}
          onClick={() => aoMudar(Math.min(10, valor + 1))}
          className="grid size-11 place-items-center rounded-lg bg-slate-100 active:bg-slate-200 dark:bg-slate-800"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
}

function NumeroLivre({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (v: string) => void }) {
  return (
    <label className="flex-1">
      <span className="mb-1 block text-sm text-slate-500 dark:text-slate-400">{rotulo}</span>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        value={valor}
        onChange={(e) => aoMudar(e.target.value.replace(/\D/g, ''))}
        className="h-14 w-full rounded-xl bg-white px-4 text-center text-xl font-semibold ring-1 ring-slate-300 dark:bg-slate-900 dark:ring-slate-700"
      />
    </label>
  );
}

function TextoLivre({ valor, aoMudar, placeholder }: { valor: string; aoMudar: (v: string) => void; placeholder: string }) {
  return (
    <input
      value={valor}
      onChange={(e) => aoMudar(e.target.value)}
      placeholder={placeholder}
      className="h-12 w-full rounded-xl bg-white px-4 ring-1 ring-slate-300 dark:bg-slate-900 dark:ring-slate-700"
    />
  );
}
