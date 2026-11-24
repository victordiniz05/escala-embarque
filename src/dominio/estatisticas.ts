import { TIPOS_AJUSTE, type TipoAjuste } from './ajustes';
import { criarDia, partes, ultimoDiaDoMes, type DiaISO } from './datas';
import { projetarEscala, type EntradaEscala } from './escala';
import { mesclarComHistorico, type DiaMostrado, type DiaRealizado } from './historico';
import type { Categoria } from './tipos';

export const CATEGORIAS: readonly Categoria[] = ['embarcado', 'folga', 'viagem', 'curso', 'ferias', 'afastamento'];

export interface Contagem {
  dias: number;
  aBordo: number;
  emTerra: number;
}

export interface EstatisticasAno {
  ano: number;
  total: Contagem;
  porCategoria: Record<Categoria, number>;
  /** Dias antes de hoje (histórico) e de hoje em diante (projeção). */
  jaPassou: Contagem;
  aindaVem: Contagem;
  /** 12 meses, janeiro = índice 0. */
  porMes: Contagem[];
  /** Quantos ajustes de cada tipo tocam o ano e quantos dias do ano eles ocupam. */
  porAjuste: Record<TipoAjuste, { quantidade: number; dias: number }>;
  embarques: number;
  maiorPeriodoABordo: { dias: number; inicio: DiaISO; fim: DiaISO } | null;
}

function contagemVazia(): Contagem {
  return { dias: 0, aBordo: 0, emTerra: 0 };
}

function somar(c: Contagem, aBordo: boolean) {
  c.dias++;
  if (aBordo) c.aBordo++;
  else c.emTerra++;
}

/** Dias do ano como o app mostra: histórico no passado, projeção de hoje em diante. */
export function diasDoAno(
  entrada: EntradaEscala,
  realizados: ReadonlyMap<DiaISO, DiaRealizado>,
  ano: number,
  hoje: DiaISO,
): DiaMostrado[] {
  return mesclarComHistorico(
    projetarEscala(entrada, criarDia(ano, 1, 1), ultimoDiaDoMes(ano, 12)),
    realizados,
    hoje,
    entrada.inicio,
  );
}

export function calcularEstatisticas(dias: readonly DiaMostrado[], hoje: DiaISO): EstatisticasAno {
  const ano = dias.length ? partes(dias[0]!.data).ano : partes(hoje).ano;
  const total = contagemVazia();
  const jaPassou = contagemVazia();
  const aindaVem = contagemVazia();
  const porMes = Array.from({ length: 12 }, contagemVazia);
  const porCategoria = Object.fromEntries(CATEGORIAS.map((c) => [c, 0])) as Record<Categoria, number>;
  const porAjuste = Object.fromEntries(TIPOS_AJUSTE.map((t) => [t, { quantidade: 0, dias: 0 }])) as EstatisticasAno['porAjuste'];
  const ajustesVistos = new Set<string>();
  let embarques = 0;
  let maior: EstatisticasAno['maiorPeriodoABordo'] = null;

  for (const d of dias) {
    if (d.foraDaEscala) continue; // antes do início da escala: não conta
    somar(total, d.aBordo);
    somar(d.data < hoje ? jaPassou : aindaVem, d.aBordo);
    somar(porMes[partes(d.data).mes - 1]!, d.aBordo);
    porCategoria[d.categoria]++;
    if (d.marcos.includes('embarque')) embarques++;

    if (d.ajuste) {
      porAjuste[d.ajuste.tipo].dias++;
      // Ajustes sem id (prévia) são identificados pela posição na lista.
      const chave = `${d.ajuste.tipo}:${d.ajuste.id ?? `i${d.ajuste.indice}`}`;
      if (!ajustesVistos.has(chave)) {
        ajustesVistos.add(chave);
        porAjuste[d.ajuste.tipo].quantidade++;
      }
    }

    // Maior período a bordo que toca o ano (pode começar ou terminar fora dele).
    if (d.aBordo && (!maior || d.periodo.total > maior.dias)) {
      maior = { dias: d.periodo.total, inicio: d.periodo.inicio, fim: d.periodo.fim };
    }
  }

  return { ano, total, porCategoria, jaPassou, aindaVem, porMes, porAjuste, embarques, maiorPeriodoABordo: maior };
}
