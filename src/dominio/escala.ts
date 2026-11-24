import { ancoraDoAjuste, efeitoAjuste, fimDoAjuste, type Ajuste } from './ajustes';
import { aBordoNoCiclo, ancoraVigente, ordenarAncoras } from './ciclo';
import { deNumero, paraNumero, type DiaISO } from './datas';
import { duracaoCiclo } from './regimes';
import type { Ancora, Categoria, DiaEscala, Marco, ParametrosEscala } from './tipos';

export interface EntradaEscala {
  parametros: ParametrosEscala;
  ancoras: readonly Ancora[];
  /** Ajustes manuais, na ordem em que foram criados (o último vence em sobreposição). */
  ajustes?: readonly Ajuste[];
  /** Primeiro dia da escala: os dias antes dele ficam em branco (sem histórico nem estatísticas). */
  inicio?: DiaISO;
}

/** Âncoras da configuração + as criadas por ajustes com "re-ancorar". */
export function todasAsAncoras(entrada: EntradaEscala): Ancora[] {
  const derivadas = (entrada.ajustes ?? [])
    .map((a) => ancoraDoAjuste(a, entrada.parametros.regime))
    .filter((a): a is Ancora => a !== null);
  return ordenarAncoras([...entrada.ancoras, ...derivadas]);
}

/**
 * Projeta a escala de `inicio` a `fim` (inclusive). Não há limite de anos:
 * cada dia é calculado a partir da âncora, então a virada do ano não quebra nada.
 *
 * Passos:
 * 1. ciclo puro (a bordo ou não) pela âncora vigente;
 * 2. ajustes manuais por cima;
 * 3. embarque, desembarque e viagem recalculados a partir das sequências a bordo,
 *    então uma dobra "empurra" o desembarque e a viagem junto;
 * 4. "dia 12 de 28" medido no período contínuo.
 * Calcula uma margem extra de cada lado para as pontas saírem certas.
 */
export function projetarEscala(entrada: EntradaEscala, inicio: DiaISO, fim: DiaISO): DiaEscala[] {
  const a = paraNumero(inicio);
  const b = paraNumero(fim);
  if (b < a) return [];

  const p = entrada.parametros;
  const margem = Math.max(366, 2 * duracaoCiclo(p.regime));
  const de = a - margem;
  const n = b + margem - de + 1;
  const ancoras = todasAsAncoras(entrada);

  // 1. ciclo puro
  const aBordo: boolean[] = new Array(n);
  const categoria: Categoria[] = new Array(n);
  const ajusteDoDia: (DiaEscala['ajuste'] | undefined)[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const dia = deNumero(de + i);
    aBordo[i] = aBordoNoCiclo(dia, ancoraVigente(ancoras, dia), p.regime);
    categoria[i] = aBordo[i] ? 'embarcado' : 'folga';
  }

  // 2. ajustes (o mais recente por último, para vencer)
  (entrada.ajustes ?? []).forEach((aj, indice) => {
    const efeito = efeitoAjuste(aj);
    const ini = Math.max(paraNumero(aj.inicio), de);
    const fi = Math.min(paraNumero(fimDoAjuste(aj)), de + n - 1);
    for (let x = ini; x <= fi; x++) {
      const i = x - de;
      aBordo[i] = efeito.aBordo;
      categoria[i] = efeito.categoria;
      ajusteDoDia[i] = { id: aj.id, tipo: aj.tipo, indice };
    }
  });

  return derivarEscala(de, aBordo, categoria, ajusteDoDia, p).slice(a - de, b - de + 1);
}

/** Estado básico de um dia (o resto é derivado da sequência). */
export interface EstadoDia {
  aBordo: boolean;
  /** Sem 'viagem': a viagem é derivada dos dias de folga em volta do embarque. */
  categoria: Categoria;
  ajuste?: DiaEscala['ajuste'];
}

/**
 * A partir da sequência de estados (dia `de` em diante), calcula embarque,
 * desembarque, viagem e o "dia X de Y" de cada dia.
 * As pontas da sequência servem só de contexto: use uma margem dos dois lados.
 */
export function derivarEscala(
  de: number,
  aBordo: readonly boolean[],
  categoriaBase: readonly Categoria[],
  ajusteDoDia: readonly (DiaEscala['ajuste'] | undefined)[],
  p: ParametrosEscala,
): DiaEscala[] {
  const n = aBordo.length;
  const categoria = [...categoriaBase];

  // marcos e viagem a partir das sequências a bordo
  const marcos: Marco[][] = Array.from({ length: n }, () => []);
  const contaFolga = p.regraDesembarque === 'conta_folga';
  for (let i = 1; i < n - 1; i++) {
    const comeca = aBordo[i] && !aBordo[i - 1];
    const termina = aBordo[i] && !aBordo[i + 1];
    if (comeca) {
      marcos[i]!.push('embarque');
      for (let k = 1; k <= p.diasViagemAntes && i - k >= 0; k++) {
        if (aBordo[i - k] || categoria[i - k] !== 'folga') break;
        categoria[i - k] = 'viagem';
      }
    }
    if (termina) {
      marcos[contaFolga ? i + 1 : i]!.push('desembarque');
      for (let k = 1; k <= p.diasViagemDepois && i + k < n; k++) {
        if (aBordo[i + k] || categoria[i + k] !== 'folga') break;
        categoria[i + k] = 'viagem';
      }
    }
  }

  // períodos contínuos
  const inicioPeriodo: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    inicioPeriodo[i] = i === 0 || aBordo[i] !== aBordo[i - 1] ? i : inicioPeriodo[i - 1]!;
  }
  const fimPeriodo: number[] = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    fimPeriodo[i] = i === n - 1 || aBordo[i] !== aBordo[i + 1] ? i : fimPeriodo[i + 1]!;
  }

  const resultado: DiaEscala[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const ini = inicioPeriodo[i]!;
    const fi = fimPeriodo[i]!;
    const dia: DiaEscala = {
      data: deNumero(de + i),
      aBordo: aBordo[i]!,
      categoria: categoria[i]!,
      marcos: marcos[i]!,
      periodo: {
        dia: i - ini + 1,
        total: fi - ini + 1,
        inicio: deNumero(de + ini),
        fim: deNumero(de + fi),
      },
    };
    const aj = ajusteDoDia[i];
    if (aj) dia.ajuste = aj;
    resultado[i] = dia;
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
