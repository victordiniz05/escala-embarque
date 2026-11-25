import { Anchor, Plane, Ship, Sun } from 'lucide-react';
import { useMemo } from 'react';
import { Cartao } from '../componentes/Cartao';
import { ListaEventos } from '../componentes/eventos/ListaEventos';
import { LembreteBackup } from '../componentes/LembreteBackup';
import { useHoje } from '../dados/hooks';
import type { RegistroConfiguracao } from '../dados/db';
import { diferencaDias } from '../dominio/datas';
import { proximosPeriodos, type EntradaEscala } from '../dominio/escala';
import { calcularStatus, tituloStatus } from '../dominio/status';
import { compacta, diaMes, plural, porExtenso } from '../formatacao';

interface Props {
  entrada: EntradaEscala;
  configuracao: RegistroConfiguracao;
}

export function Inicio({ entrada, configuracao }: Props) {
  const hojeSP = useHoje();
  const status = useMemo(() => calcularStatus(entrada, hojeSP), [entrada, hojeSP]);
  const periodos = useMemo(() => proximosPeriodos(entrada, hojeSP, 4), [entrada, hojeSP]);
  const { titulo, subtitulo } = tituloStatus(status);
  const [rotulo, detalhe] = titulo.split(' – ');
  const embarcado = status.situacao === 'embarcado';
  const emQuantos = status.diasRestantes;
  const local = [configuracao.embarcacao, configuracao.empresa].filter(Boolean).join(' · ');

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{porExtenso(hojeSP)}</p>
        {local && <p className="text-sm text-slate-500 dark:text-slate-400">{local}</p>}
      </header>

      <section
        aria-live="polite"
        className={`rounded-3xl p-5 text-white shadow-lg ${
          embarcado
            ? 'bg-gradient-to-br from-blue-600 to-blue-800'
            : ['curso', 'afastamento', 'ferias'].includes(status.categoriaHoje)
              ? 'bg-gradient-to-br from-violet-600 to-violet-800'
              : 'bg-gradient-to-br from-emerald-600 to-emerald-800'
        }`}
      >
        <div className="flex items-center gap-2 text-white/85">
          {embarcado ? <Ship size={22} /> : <Sun size={22} />}
          <span className="text-sm font-semibold tracking-wide">{rotulo}</span>
        </div>
        <p className="mt-2 text-4xl leading-tight font-bold">{detalhe}</p>
        <p className="mt-1 text-lg text-white/90">{subtitulo}</p>

        <div className="mt-5">
          <div
            className="h-3 w-full overflow-hidden rounded-full bg-white/25"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={status.totalDoPeriodo}
            aria-valuenow={status.diaDoPeriodo}
            aria-label="Progresso do período"
          >
            <div className="h-full rounded-full bg-white" style={{ width: `${Math.round(status.progresso * 100)}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-sm text-white/80">
            <span>
              Dia {status.diaDoPeriodo} de {status.totalDoPeriodo}
            </span>
            <span>{Math.round(status.progresso * 100)}%</span>
          </div>
        </div>
      </section>

      <Cartao>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Próxima troca de turma</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <div>
            <p className="text-xl font-bold">
              {status.proximaTroca.tipo === 'embarque' ? 'Embarque' : 'Desembarque'}
            </p>
            <p className="text-lg">{porExtenso(status.proximaTroca.data)}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums">{emQuantos === 0 ? 'Hoje' : emQuantos}</p>
            {emQuantos > 0 && <p className="text-sm text-slate-500">{emQuantos === 1 ? 'dia' : 'dias'}</p>}
          </div>
        </div>
      </Cartao>

      <LembreteBackup entrada={entrada} />

      <ListaEventos entrada={entrada} />

      {status.proximaViagem && (
        <Cartao className="flex items-center gap-3 !bg-amber-50 !ring-amber-200 dark:!bg-amber-950/40 dark:!ring-amber-900">
          <Plane className="shrink-0 text-amber-600" size={24} />
          <p>
            Viagem começa <strong>{compacta(status.proximaViagem)}</strong> (
            {plural(diferencaDias(hojeSP, status.proximaViagem), 'dia', 'dias')})
          </p>
        </Cartao>
      )}

      <Cartao>
        <p className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">Próximos embarques</p>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {periodos.map((p) => {
            const atual = p.embarque <= hojeSP;
            return (
              <li key={p.embarque} className="flex items-center gap-3 py-2.5">
                <Anchor size={18} className={atual ? 'text-embarcado' : 'text-slate-400'} />
                <div className="flex-1">
                  <p className="font-semibold">
                    {diaMes(p.embarque)} → {diaMes(p.desembarque)}
                  </p>
                  {atual && <p className="text-xs text-embarcado">período atual</p>}
                </div>
                <span className="text-sm text-slate-500 tabular-nums">{p.dias} dias</span>
              </li>
            );
          })}
        </ul>
      </Cartao>
    </div>
  );
}
