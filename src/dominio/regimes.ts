import type { ParametrosEscala, Regime } from './tipos';

export const REGIMES_PADRAO: readonly Regime[] = [7, 14, 21, 28, 35].map((n) => ({
  embarcado: n,
  folga: n,
}));

export const LIMITE_DIAS_REGIME = 120;

export function nomeRegime(r: Regime): string {
  return `${r.embarcado}x${r.folga}`;
}

export function ehRegimePadrao(r: Regime): boolean {
  return REGIMES_PADRAO.some((p) => p.embarcado === r.embarcado && p.folga === r.folga);
}

export function duracaoCiclo(r: Regime): number {
  return r.embarcado + r.folga;
}

/** Lista de problemas (em português) ou lista vazia se estiver tudo certo. */
export function validarParametros(p: ParametrosEscala): string[] {
  const erros: string[] = [];
  const inteiro = (n: number) => Number.isInteger(n);
  const { embarcado, folga } = p.regime;

  if (!inteiro(embarcado) || embarcado < 1 || embarcado > LIMITE_DIAS_REGIME) {
    erros.push(`Dias embarcado deve ser um número inteiro entre 1 e ${LIMITE_DIAS_REGIME}.`);
  }
  if (!inteiro(folga) || folga < 1 || folga > LIMITE_DIAS_REGIME) {
    erros.push(`Dias de folga deve ser um número inteiro entre 1 e ${LIMITE_DIAS_REGIME}.`);
  }
  if (!inteiro(p.diasViagemAntes) || p.diasViagemAntes < 0) {
    erros.push('Dias de viagem antes do embarque deve ser 0 ou mais.');
  }
  if (!inteiro(p.diasViagemDepois) || p.diasViagemDepois < 0) {
    erros.push('Dias de viagem depois do desembarque deve ser 0 ou mais.');
  }
  if (erros.length === 0 && p.diasViagemAntes + p.diasViagemDepois > folga) {
    erros.push('Os dias de viagem não podem passar do total de dias de folga.');
  }
  return erros;
}
