import { diferencaDias, modPositivo, type DiaISO } from './datas';
import { duracaoCiclo } from './regimes';
import type { Ancora, Categoria, Marco, ParametrosEscala } from './tipos';

export interface DiaBase {
  aBordo: boolean;
  categoria: Categoria;
  marcos: Marco[];
  /** Posição no ciclo: 0 = dia do embarque … X+Y-1 = último dia de folga. */
  posicao: number;
}

/** Âncora que vale para o dia: a mais recente com vigenteDesde <= dia. */
export function ancoraVigente(ancoras: readonly Ancora[], dia: DiaISO): Ancora {
  if (ancoras.length === 0) throw new Error('A escala precisa de pelo menos uma âncora.');
  const ordenadas = [...ancoras].sort((a, b) => (a.vigenteDesde < b.vigenteDesde ? -1 : 1));
  let escolhida = ordenadas[0]!;
  for (const a of ordenadas) {
    if (a.vigenteDesde <= dia) escolhida = a;
    else break;
  }
  return escolhida;
}

/** Estado de um dia pelo ciclo puro (sem ajustes manuais). */
export function diaNoCiclo(dia: DiaISO, ancora: Ancora, p: ParametrosEscala): DiaBase {
  const { embarcado: x, folga: y } = p.regime;
  const posicao = modPositivo(diferencaDias(ancora.dataEmbarque, dia), duracaoCiclo(p.regime));
  const aBordo = posicao < x;
  const marcos: Marco[] = [];

  if (posicao === 0) marcos.push('embarque');
  const posDesembarque = p.regraDesembarque === 'conta_embarcado' ? x - 1 : x;
  // No regime "conta_folga" com 1 dia de folga, o desembarque cai no dia de folga (pos x).
  if (posicao === posDesembarque) marcos.push('desembarque');

  let categoria: Categoria = aBordo ? 'embarcado' : 'folga';
  if (!aBordo) {
    const posFolga = posicao - x; // 0 … y-1
    const ehViagemDepois = posFolga < p.diasViagemDepois;
    const ehViagemAntes = posFolga >= y - p.diasViagemAntes;
    if (ehViagemDepois || ehViagemAntes) categoria = 'viagem';
  }

  return { aBordo, categoria, marcos, posicao };
}
