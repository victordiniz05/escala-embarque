import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { INFO_AJUSTE } from '../componentes/ajustes/infoAjuste';
import { Cartao } from '../componentes/Cartao';
import { useHoje } from '../dados/hooks';
import { TIPOS_AJUSTE } from '../dominio/ajustes';
import { partes, type DiaISO } from '../dominio/datas';
import type { EntradaEscala } from '../dominio/escala';
import { calcularEstatisticas, CATEGORIAS, diasDoAno, type Contagem } from '../dominio/estatisticas';
import type { DiaRealizado } from '../dominio/historico';
import type { Categoria } from '../dominio/tipos';
import { ROTULO_CATEGORIA, diaMes, plural } from '../formatacao';

/** Cores de gráfico por categoria (validadas para daltonismo nos dois temas). */
const COR_GRAFICO: Record<Categoria, string> = {
  embarcado: 'bg-blue-600 dark:bg-blue-500',
  folga: 'bg-emerald-600',
  viagem: 'bg-amber-600',
  curso: 'bg-violet-600 dark:bg-violet-500',
  ferias: 'bg-sky-600',
  afastamento: 'bg-rose-600 dark:bg-rose-500',
};

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const pct = (parte: number, todo: number) => (todo === 0 ? 0 : Math.round((parte / todo) * 100));

interface Props {
  entrada: EntradaEscala;
  realizados: ReadonlyMap<DiaISO, DiaRealizado>;
}

export function Estatisticas({ entrada, realizados }: Props) {
  const hojeSP = useHoje();
  const anoAtual = partes(hojeSP).ano;
  const [ano, setAno] = useState(anoAtual);
  const est = useMemo(
    () => calcularEstatisticas(diasDoAno(entrada, realizados, ano, hojeSP), hojeSP),
    [entrada, realizados, ano, hojeSP],
  );
  const ajustesDoAno = TIPOS_AJUSTE.filter((t) => est.porAjuste[t].quantidade > 0);
  const categorias = CATEGORIAS.filter((c) => est.porCategoria[c] > 0);
  const maxMes = 31;
  // Se a escala começou no meio do ano, a porcentagem é dos dias desde o início.
  const diasNoAno = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0 ? 366 : 365;
  const base = est.total.dias < diasNoAno ? 'desde o início' : 'do ano';

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Estatísticas</h1>
        <div className="flex items-center gap-1">
          <BotaoAno rotulo="Ano anterior" aoClicar={() => setAno((a) => a - 1)}>
            <ChevronLeft size={22} />
          </BotaoAno>
          <span className="w-14 text-center text-lg font-semibold tabular-nums">{ano}</span>
          <BotaoAno rotulo="Próximo ano" aoClicar={() => setAno((a) => a + 1)}>
            <ChevronRight size={22} />
          </BotaoAno>
        </div>
      </header>

      {est.total.dias === 0 ? (
        <Cartao>
          <p className="text-slate-600 dark:text-slate-300">
            Sem escala em {ano}. Sua escala começa em {entrada.inicio ? diaMes(entrada.inicio) : '—'}
            {entrada.inicio ? ` de ${entrada.inicio.slice(0, 4)}` : ''}.
          </p>
        </Cartao>
      ) : (
        <>
        <div className="grid grid-cols-2 gap-3">
          <Numero titulo="A bordo" valor={est.total.aBordo} detalhe={`${pct(est.total.aBordo, est.total.dias)}% ${base}`} />
          <Numero titulo="Em terra" valor={est.total.emTerra} detalhe={`${pct(est.total.emTerra, est.total.dias)}% ${base}`} />
        </div>

        <Cartao>
          <h2 className="mb-3 font-semibold">Como foi o ano</h2>
          <div className="flex h-5 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Distribuição dos dias do ano">
            {categorias.map((c) => (
              <div
                key={c}
                className={`h-full first:rounded-l-full last:rounded-r-full ${COR_GRAFICO[c]}`}
                style={{ width: `${(est.porCategoria[c] / est.total.dias) * 100}%` }}
                title={`${ROTULO_CATEGORIA[c]}: ${est.porCategoria[c]} dias`}
              />
            ))}
          </div>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {categorias.map((c) => (
                <tr key={c} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="py-1.5">
                    <span className="flex items-center gap-2">
                      <span className={`size-3 shrink-0 rounded-sm ${COR_GRAFICO[c]}`} aria-hidden />
                      {ROTULO_CATEGORIA[c]}
                    </span>
                  </td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{plural(est.porCategoria[c], 'dia', 'dias')}</td>
                  <td className="w-12 py-1.5 text-right text-slate-500 tabular-nums dark:text-slate-400">
                    {pct(est.porCategoria[c], est.total.dias)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>

        {est.jaPassou.dias > 0 && est.aindaVem.dias > 0 && (
          <Cartao>
            <h2 className="mb-3 font-semibold">Já passou × ainda vem</h2>
            <div className="grid grid-cols-2 gap-3">
              <Parte titulo="Até ontem" subtitulo="pelo histórico" c={est.jaPassou} />
              <Parte titulo={`De hoje até 31/12`} subtitulo="pela escala" c={est.aindaVem} />
            </div>
          </Cartao>
        )}

        <Cartao>
          <h2 className="mb-3 font-semibold">Dias a bordo por mês</h2>
          <ul className="space-y-1.5">
            {est.porMes.map((m, i) => {
              const atual = ano === anoAtual && i === partes(hojeSP).mes - 1;
              return (
                <li key={i} className="flex items-center gap-2 text-sm" title={`${MESES_CURTOS[i]}: ${m.aBordo} de ${m.dias} dias a bordo`}>
                  <span className={`w-8 shrink-0 ${atual ? 'font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                    {MESES_CURTOS[i]}
                  </span>
                  <span className="h-3 flex-1 rounded-sm bg-slate-100 dark:bg-slate-800">
                    {m.aBordo > 0 && (
                      <span
                        className={`block h-full rounded-r-sm ${COR_GRAFICO.embarcado}`}
                        style={{ width: `${(m.aBordo / maxMes) * 100}%` }}
                      />
                    )}
                  </span>
                  <span className="w-8 shrink-0 text-right font-semibold tabular-nums">{m.aBordo}</span>
                </li>
              );
            })}
          </ul>
        </Cartao>

        <Cartao>
          <h2 className="mb-2 font-semibold">Ajustes no ano</h2>
          {ajustesDoAno.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum ajuste neste ano.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {ajustesDoAno.map((t) => {
                const { rotulo, Icone } = INFO_AJUSTE[t];
                const { quantidade, dias } = est.porAjuste[t];
                return (
                  <li key={t} className="flex items-center gap-3 py-2">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-100 text-ajuste dark:bg-violet-950 dark:text-violet-300">
                      <Icone size={16} />
                    </span>
                    <span className="flex-1">
                      {rotulo} <span className="text-slate-500 dark:text-slate-400">× {quantidade}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{plural(dias, 'dia', 'dias')}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {est.porAjuste.dobra.dias > 0 && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Dias extras a bordo por dobra: <strong className="text-slate-900 dark:text-slate-100">{est.porAjuste.dobra.dias}</strong>
            </p>
          )}
        </Cartao>

        <Cartao>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Embarques no ano</dt>
              <dd className="text-2xl font-bold tabular-nums">{est.embarques}</dd>
            </div>
            {est.maiorPeriodoABordo && (
              <div>
                <dt className="text-sm text-slate-500 dark:text-slate-400">Maior período a bordo</dt>
                <dd className="text-2xl font-bold tabular-nums">{est.maiorPeriodoABordo.dias} dias</dd>
                <dd className="text-sm text-slate-500 dark:text-slate-400">
                  {diaMes(est.maiorPeriodoABordo.inicio)} → {diaMes(est.maiorPeriodoABordo.fim)}
                </dd>
              </div>
            )}
          </dl>
        </Cartao>
        </>
      )}
    </div>
  );
}

function Numero({ titulo, valor, detalhe }: { titulo: string; valor: number; detalhe: string }) {
  return (
    <Cartao>
      <p className="text-sm text-slate-500 dark:text-slate-400">{titulo}</p>
      <p className="text-4xl font-bold tabular-nums">{valor}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">dias · {detalhe}</p>
    </Cartao>
  );
}

function Parte({ titulo, subtitulo, c }: { titulo: string; subtitulo: string; c: Contagem }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
      <p className="font-semibold">{titulo}</p>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{subtitulo}</p>
      <p className="text-sm">
        <strong className="tabular-nums">{c.aBordo}</strong> a bordo
      </p>
      <p className="text-sm">
        <strong className="tabular-nums">{c.emTerra}</strong> em terra
      </p>
    </div>
  );
}

function BotaoAno({ children, aoClicar, rotulo }: { children: ReactNode; aoClicar: () => void; rotulo: string }) {
  return (
    <button
      onClick={aoClicar}
      aria-label={rotulo}
      className="grid size-10 place-items-center rounded-full bg-white ring-1 ring-slate-200 active:bg-slate-100 dark:bg-slate-900 dark:ring-slate-800"
    >
      {children}
    </button>
  );
}
