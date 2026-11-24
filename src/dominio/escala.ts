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

export interface PeriodoEmbarque {
  embarque: DiaISO;
  /** Último dia a bordo. */
  ultimoDiaABordo: DiaISO;
  /** Data do desembarque conforme a regra de contagem. */
  desembarque: DiaISO;
  dias: number;
}

/**
 * Próximos períodos a bordo, incluindo o atual se `aPartirDe` estiver embarcado.
 */
export function proximosPeriodos(
  entrada: EntradaEscala,
  aPartirDe: DiaISO,
  quantidade: number,
): PeriodoEmbarque[] {
  const ciclo = duracaoCiclo(entrada.parametros.regime);
  const fim = deNumero(paraNumero(aPartirDe) + ciclo * (quantidade + 1) + 366);
  const dias = projetarEscala(entrada, aPartirDe, fim);
  const periodos: PeriodoEmbarque[] = [];
  for (let i = 0; i < dias.length && periodos.length < quantidade; i++) {
    const d = dias[i]!;
    if (!d.aBordo || (d.periodo.dia !== 1 && i !== 0)) continue;
    const ultimo = d.periodo.fim;
    const desembarque =
      dias.find((x) => x.data >= ultimo && x.marcos.includes('desembarque'))?.data ?? ultimo;
    periodos.push({
      embarque: d.periodo.inicio,
      ultimoDiaABordo: ultimo,
      desembarque,
      dias: d.periodo.total,
    });
  }
  return periodos;
}
