import { Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { Cartao, TituloTela } from '../componentes/Cartao';
import { ListaAjustes } from '../componentes/ajustes/ListaAjustes';
import { CartaoBackup } from '../componentes/CartaoBackup';
import { CartaoHistorico } from '../componentes/CartaoHistorico';
import { salvarTema, type RegistroAjuste, type RegistroAncora, type RegistroConfiguracao, type Tema } from '../dados/db';
import type { DiaISO } from '../dominio/datas';
import type { EntradaEscala } from '../dominio/escala';
import type { DiaRealizado } from '../dominio/historico';
import { nomeRegime } from '../dominio/regimes';
import { curta } from '../formatacao';
import { ConfigurarEscala } from './ConfigurarEscala';

interface Props {
  configuracao: RegistroConfiguracao;
  ancoras: RegistroAncora[];
  ajustes: RegistroAjuste[];
  entrada: EntradaEscala;
  realizados: ReadonlyMap<DiaISO, DiaRealizado>;
}

const TEMAS: { valor: Tema; rotulo: string; Icone: typeof Sun }[] = [
  { valor: 'sistema', rotulo: 'Sistema', Icone: Monitor },
  { valor: 'claro', rotulo: 'Claro', Icone: Sun },
  { valor: 'escuro', rotulo: 'Escuro', Icone: Moon },
];

export function Configuracoes({ configuracao, ancoras, ajustes, entrada, realizados }: Props) {
  const [editando, setEditando] = useState(false);
  const ancoraPrincipal = ancoras.find((a) => a.origem === 'configuracao') ?? ancoras[0]!;

  if (editando) {
    return (
      <div>
        <TituloTela>Editar escala</TituloTela>
        <ConfigurarEscala
          atual={{ configuracao, dataEmbarque: ancoraPrincipal.dataEmbarque }}
          aoSalvar={() => setEditando(false)}
          aoCancelar={() => setEditando(false)}
        />
      </div>
    );
  }

  const linhas: [string, string][] = [
    ['Regime', nomeRegime(configuracao.regime)],
    ['Âncora (embarque)', curta(ancoraPrincipal.dataEmbarque)],
    [
      'Desembarque',
      configuracao.regraDesembarque === 'conta_embarcado'
        ? `No ${configuracao.regime.embarcado}º dia`
        : `No ${configuracao.regime.embarcado + 1}º dia (troca)`,
    ],
    ['Viagem antes / depois', `${configuracao.diasViagemAntes} / ${configuracao.diasViagemDepois} dias`],
    ['Embarcação', configuracao.embarcacao || '—'],
    ['Empresa', configuracao.empresa || '—'],
  ];

  return (
    <div className="space-y-4">
      <TituloTela>Configurações</TituloTela>

      <Cartao>
        <h2 className="mb-2 font-semibold">Minha escala</h2>
        <dl className="divide-y divide-slate-100 dark:divide-slate-800">
          {linhas.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5">
              <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <button
          onClick={() => setEditando(true)}
          className="mt-3 h-12 w-full rounded-2xl bg-embarcado font-semibold text-white active:bg-blue-700"
        >
          Editar escala
        </button>
      </Cartao>

      <ListaAjustes entrada={entrada} ajustes={ajustes} />

      <Cartao>
        <h2 className="mb-3 font-semibold">Aparência</h2>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema">
          {TEMAS.map(({ valor, rotulo, Icone }) => {
            const ativo = configuracao.tema === valor;
            return (
              <button
                key={valor}
                role="radio"
                aria-checked={ativo}
                onClick={() => salvarTema(valor)}
                className={`flex h-16 flex-col items-center justify-center gap-1 rounded-xl text-sm font-medium ring-1 ${
                  ativo
                    ? 'bg-blue-50 text-embarcado ring-embarcado dark:bg-blue-950/40 dark:text-blue-300'
                    : 'ring-slate-300 dark:ring-slate-700'
                }`}
              >
                <Icone size={20} />
                {rotulo}
              </button>
            );
          })}
        </div>
      </Cartao>

      <CartaoBackup />

      <CartaoHistorico entrada={entrada} totalGravados={realizados.size} />

      <Cartao>
        <h2 className="mb-1 font-semibold">Exportação</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Em breve: exportar para o Calendário do iPhone (.ics) e imagem do mês ou do ano para o WhatsApp.
        </p>
      </Cartao>

      <p className="pt-2 text-center text-xs text-slate-400">
        Escala Embarque · seus dados ficam só neste aparelho e o app funciona sem internet.
      </p>
    </div>
  );
}
