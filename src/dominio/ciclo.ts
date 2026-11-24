import { diferencaDias, modPositivo, type DiaISO } from './datas';
import { duracaoCiclo } from './regimes';
import type { Ancora, Regime } from './tipos';

/** Ordena as âncoras por vigência (estável: em empate, a que veio depois vence). */
export function ordenarAncoras(ancoras: readonly Ancora[]): Ancora[] {
  return ancoras
    .map((a, i) => ({ a, i }))
    .sort((x, y) => (x.a.vigenteDesde < y.a.vigenteDesde ? -1 : x.a.vigenteDesde > y.a.vigenteDesde ? 1 : x.i - y.i))
    .map((x) => x.a);
}

/**
 * Âncora que vale para o dia: a mais recente com vigenteDesde <= dia.
 * Antes da primeira, vale a primeira (o ciclo segue para trás).
 * `ancoras` deve vir ordenada (ordenarAncoras).
 */
export function ancoraVigente(ancoras: readonly Ancora[], dia: DiaISO): Ancora {
  if (ancoras.length === 0) throw new Error('A escala precisa de pelo menos uma âncora.');
  let escolhida = ancoras[0]!;
  for (const a of ancoras) {
    if (a.vigenteDesde <= dia) escolhida = a;
    else break;
  }
  return escolhida;
}

/** Posição no ciclo: 0 = dia do embarque … X+Y-1 = último dia de folga. */
export function posicaoNoCiclo(dia: DiaISO, ancora: Ancora, regime: Regime): number {
  return modPositivo(diferencaDias(ancora.dataEmbarque, dia), duracaoCiclo(regime));
}

/** Pelo ciclo puro (sem ajustes), o dia é a bordo? */
export function aBordoNoCiclo(dia: DiaISO, ancora: Ancora, regime: Regime): boolean {
  return posicaoNoCiclo(dia, ancora, regime) < regime.embarcado;
}
