import { CalendarArrowDown } from 'lucide-react';
import { useState } from 'react';
import { enviarArquivo } from '../compartilhar';
import { useHoje } from '../dados/hooks';
import { partes, primeiroDiaDoMes, somarDias, somarMeses, type DiaISO } from '../dominio/datas';
import { projetarEscala, type EntradaEscala } from '../dominio/escala';
import { mesclarComHistorico, type DiaRealizado } from '../dominio/historico';
import { blocosDaEscala, gerarIcs, nomeArquivoIcs } from '../dominio/ics';
import { curta } from '../formatacao';
import { Cartao } from './Cartao';

interface Props {
  entrada: EntradaEscala;
  realizados: ReadonlyMap<DiaISO, DiaRealizado>;
  embarcacao: string;
}

/** Exportar a escala para o Calendário do iPhone ou Google Agenda (.ics). */
export function CartaoExportar({ entrada, realizados, embarcacao }: Props) {
  const hojeSP = useHoje();
  const [anos, setAnos] = useState<1 | 3>(1);
  const [incluirFolgas, setIncluirFolgas] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const { ano, mes } = partes(hojeSP);
  const de = primeiroDiaDoMes(ano, mes);
  const fimMes = somarMeses(ano, mes, anos * 12);
  const ate = somarDias(primeiroDiaDoMes(fimMes.ano, fimMes.mes), -1);

  async function exportar() {
    setAviso(null);
    // Margem dos dois lados para os períodos das pontas saírem inteiros.
    const dias = mesclarComHistorico(projetarEscala(entrada, somarDias(de, -120), somarDias(ate, 120)), realizados, hojeSP);
    const ics = gerarIcs(blocosDaEscala(dias, de, ate), { incluirFolgas, embarcacao, agora: new Date() });
    const r = await enviarArquivo(nomeArquivoIcs(hojeSP), ics, 'text/calendar');
    if (r === 'baixado') setAviso('Arquivo salvo. Abra-o para importar na agenda.');
    else if (r === 'indisponivel') setAviso('Este navegador não deixou salvar o arquivo.');
  }

  return (
    <Cartao>
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <CalendarArrowDown size={18} aria-hidden /> Exportar para a agenda
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Cria um arquivo .ics com seus períodos a bordo (e cursos, férias e afastamentos) para o Calendário do iPhone
        ou o Google Agenda.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Período">
        {([1, 3] as const).map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={anos === n}
            onClick={() => setAnos(n)}
            className={`h-11 rounded-xl text-sm font-semibold ring-1 ${
              anos === n
                ? 'bg-blue-50 text-embarcado ring-embarcado dark:bg-blue-950/40 dark:text-blue-300'
                : 'ring-slate-300 dark:ring-slate-700'
            }`}
          >
            Próximos {n === 1 ? '12 meses' : '3 anos'}
          </button>
        ))}
      </div>
      <label className="mt-3 flex items-center gap-3">
        <input
          id="exportar-folgas"
          type="checkbox"
          checked={incluirFolgas}
          onChange={(e) => setIncluirFolgas(e.target.checked)}
          className="size-5 accent-blue-600"
        />
        <span className="text-sm">Incluir os períodos de folga</span>
      </label>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        De {curta(de)} a {curta(ate)}.
      </p>

      <button
        onClick={exportar}
        className="mt-3 h-12 w-full rounded-2xl bg-embarcado font-semibold text-white active:bg-blue-700"
      >
        Exportar (.ics)
      </button>
      {aviso && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{aviso}</p>}

      <details className="mt-3 text-sm text-slate-600 dark:text-slate-300">
        <summary className="cursor-pointer font-medium">Como importar</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>iPhone:</strong> toque em Exportar, escolha “Salvar em Arquivos”, abra o arquivo no app Arquivos e
            toque em “Adicionar todos”. Dica: crie antes um calendário “Escala” no app Calendário e escolha-o ao
            adicionar.
          </li>
          <li>
            <strong>Google Agenda:</strong> no computador, em calendar.google.com → Configurações → Importar e exportar
            → escolha o arquivo.
          </li>
          <li>
            Se a escala mudar, apague os eventos antigos (ou o calendário “Escala”) antes de importar de novo, para não
            duplicar.
          </li>
        </ul>
      </details>
    </Cartao>
  );
}
