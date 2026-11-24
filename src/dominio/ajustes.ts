import { somarDias, type DiaISO } from './datas';
import type { Ancora, Categoria, Regime } from './tipos';

export type TipoAjuste = 'dobra' | 'antecipacao' | 'atraso' | 'troca' | 'curso' | 'afastamento' | 'ferias';

export const TIPOS_AJUSTE: readonly TipoAjuste[] = [
  'dobra',
  'antecipacao',
  'atraso',
  'troca',
  'curso',
  'afastamento',
  'ferias',
];

/** O que fazer com a escala depois do ajuste. */
export type AposAjuste = 'retomar_ciclo' | 'reancorar';

export interface Ajuste {
  id?: number;
  tipo: TipoAjuste;
  inicio: DiaISO;
  fim: DiaISO;
  observacao: string;
  /** Só na troca com colega. */
  colega?: string;
  /** Só na troca: como você fica nos dias trocados. */
  estadoTroca?: 'embarcado' | 'folga';
  aposAjuste: AposAjuste;
}

export interface EfeitoAjuste {
  aBordo: boolean;
  categoria: Categoria;
}

/** Como ficam os dias cobertos pelo ajuste. */
export function efeitoAjuste(a: Ajuste): EfeitoAjuste {
  switch (a.tipo) {
    case 'dobra':
    case 'antecipacao':
      return { aBordo: true, categoria: 'embarcado' };
    case 'atraso':
      return { aBordo: false, categoria: 'folga' };
    case 'troca':
      return a.estadoTroca === 'folga'
        ? { aBordo: false, categoria: 'folga' }
        : { aBordo: true, categoria: 'embarcado' };
    case 'curso':
      return { aBordo: false, categoria: 'curso' };
    case 'afastamento':
      return { aBordo: false, categoria: 'afastamento' };
    case 'ferias':
      return { aBordo: false, categoria: 'ferias' };
  }
}

export function fimDoAjuste(a: Ajuste): DiaISO {
  return a.fim >= a.inicio ? a.fim : a.inicio;
}

/**
 * Nova âncora criada quando o usuário escolhe "re-ancorar".
 * - Antecipação: o período de X dias passa a contar do novo embarque.
 * - Ajuste que termina a bordo (dobra, troca embarcado): o último dia do ajuste
 *   vira o último dia a bordo; segue a folga completa.
 * - Ajuste que termina em terra (atraso, troca de folga, curso, afastamento, férias):
 *   o dia seguinte vira o dia de embarque.
 */
export function ancoraDoAjuste(a: Ajuste, regime: Regime): Ancora | null {
  if (a.aposAjuste !== 'reancorar') return null;
  if (a.tipo === 'antecipacao') return { dataEmbarque: a.inicio, vigenteDesde: a.inicio };
  const fim = fimDoAjuste(a);
  const depois = somarDias(fim, 1);
  if (efeitoAjuste(a).aBordo) {
    return { dataEmbarque: somarDias(fim, -(regime.embarcado - 1)), vigenteDesde: depois };
  }
  return { dataEmbarque: depois, vigenteDesde: depois };
}

export function validarAjuste(a: Ajuste): string[] {
  const erros: string[] = [];
  if (a.fim < a.inicio) erros.push('A data final não pode ser antes da inicial.');
  if (a.tipo === 'troca' && !a.estadoTroca) erros.push('Diga se nos dias trocados você fica embarcado ou de folga.');
  return erros;
}
