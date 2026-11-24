import type { Ajuste } from './ajustes';
import { fimDoAjuste } from './ajustes';
import { somarDias, type DiaISO } from './datas';
import { projetarEscala, proximosPeriodos, type EntradaEscala, type PeriodoEmbarque } from './escala';
import { duracaoCiclo } from './regimes';
import type { DiaEscala } from './tipos';

export interface PreviaAjuste {
  /** Dias que mudam na janela do ajuste até dois ciclos depois. */
  diasAlterados: DiaISO[];
  periodosAntes: PeriodoEmbarque[];
  periodosDepois: PeriodoEmbarque[];
  /** Escala com o ajuste aplicado (para desenhar o calendário da prévia). */
  entradaDepois: EntradaEscala;
}

/** Entrada com o ajuste incluído (ou substituído, se já existir com o mesmo id). */
export function comAjuste(entrada: EntradaEscala, ajuste: Ajuste): EntradaEscala {
  const atuais = entrada.ajustes ?? [];
  const existe = ajuste.id !== undefined && atuais.some((a) => a.id === ajuste.id);
  // Editando: mantém a posição (a ordem decide quem vence em sobreposição).
  const ajustes = existe ? atuais.map((a) => (a.id === ajuste.id ? ajuste : a)) : [...atuais, ajuste];
  return { ...entrada, ajustes };
}

export function semAjuste(entrada: EntradaEscala, id: number): EntradaEscala {
  return { ...entrada, ajustes: (entrada.ajustes ?? []).filter((a) => a.id !== id) };
}

function mesmoDia(a: DiaEscala, b: DiaEscala): boolean {
  return a.aBordo === b.aBordo && a.categoria === b.categoria && a.marcos.join() === b.marcos.join();
}

/** Compara a escala atual com a escala depois do ajuste. */
export function preverAjuste(entrada: EntradaEscala, ajuste: Ajuste): PreviaAjuste {
  const entradaDepois = comAjuste(entrada, ajuste);
  const ciclo = duracaoCiclo(entrada.parametros.regime);
  const de = somarDias(ajuste.inicio, -ciclo);
  const ate = somarDias(fimDoAjuste(ajuste), 2 * ciclo);

  const antes = projetarEscala(entrada, de, ate);
  const depois = projetarEscala(entradaDepois, de, ate);
  const diasAlterados = depois.filter((d, i) => !mesmoDia(d, antes[i]!)).map((d) => d.data);

  // Começa no período que termina logo antes do ajuste (dobra) ou no próximo.
  const aPartirDe = somarDias(ajuste.inicio, -1);
  return {
    diasAlterados,
    periodosAntes: proximosPeriodos(entrada, aPartirDe, 3),
    periodosDepois: proximosPeriodos(entradaDepois, aPartirDe, 3),
    entradaDepois,
  };
}
