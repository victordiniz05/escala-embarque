import { deNumero, paraNumero, type DiaISO } from './datas';
import { ancoraVigente, diaNoCiclo, type DiaBase } from './ciclo';
import { duracaoCiclo } from './regimes';
import type { Ancora, DiaEscala, ParametrosEscala } from './tipos';

export interface EntradaEscala {
  parametros: ParametrosEscala;
  ancoras: readonly Ancora[];
}

/**
 * Projeta a escala de `inicio` a `fim` (inclusive). Não há limite de anos:
 * cada dia é calculado a partir da âncora, então a virada do ano não quebra nada.
 *
 * Para saber "dia 12 de 28" nas pontas do intervalo, calcula uma margem extra
 * de cada lado e mede os períodos contínuos (sequências de dias a bordo ou não).
 */
export function projetarEscala(entrada: EntradaEscala, inicio: DiaISO, fim: DiaISO): DiaEscala[] {
  const a = paraNumero(inicio);
  const b = paraNumero(fim);
  if (b < a) return [];

  const margem = Math.max(366, 2 * duracaoCiclo(entrada.parametros.regime));
  const de = a - margem;
  const ate = b + margem;

  const base: DiaBase[] = [];
  for (let n = de; n <= ate; n++) {
    const dia = deNumero(n);
    base.push(diaNoCiclo(dia, ancoraVigente(entrada.ancoras, dia), entrada.parametros));
  }

  // Início de cada período contínuo.
  const inicioPeriodo: number[] = new Array(base.length);
  for (let i = 0; i < base.length; i++) {
    const mudou = i === 0 || base[i]!.aBordo !== base[i - 1]!.aBordo;
    inicioPeriodo[i] = mudou ? i : inicioPeriodo[i - 1]!;
  }
  const fimPeriodo: number[] = new Array(base.length);
  for (let i = base.length - 1; i >= 0; i--) {
    const mudou = i === base.length - 1 || base[i]!.aBordo !== base[i + 1]!.aBordo;
    fimPeriodo[i] = mudou ? i : fimPeriodo[i + 1]!;
  }

  const resultado: DiaEscala[] = [];
  for (let n = a; n <= b; n++) {
    const i = n - de;
    const d = base[i]!;
    const ini = inicioPeriodo[i]!;
    const fi = fimPeriodo[i]!;
    resultado.push({
      data: deNumero(n),
      aBordo: d.aBordo,
      categoria: d.categoria,
      marcos: d.marcos,
      periodo: {
        dia: i - ini + 1,
        total: fi - ini + 1,
        inicio: deNumero(de + ini),
        fim: deNumero(de + fi),
      },
    });
  }
  return resultado;
}

export function diaDaEscala(entrada: EntradaEscala, dia: DiaISO): DiaEscala {
  return projetarEscala(entrada, dia, dia)[0]!;
}
