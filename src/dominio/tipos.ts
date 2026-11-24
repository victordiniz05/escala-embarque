import type { TipoAjuste } from './ajustes';
import type { DiaISO } from './datas';

/** X dias embarcado / Y dias de folga. */
export interface Regime {
  embarcado: number;
  folga: number;
}

/**
 * Como a empresa conta o dia do desembarque.
 * - conta_embarcado (padrão): o desembarque é o ÚLTIMO dia embarcado do período.
 * - conta_folga: o desembarque acontece no dia seguinte ao último dia a bordo
 *   e já conta como o 1º dia de folga.
 * Nos dois casos o ciclo tem sempre X + Y dias, então a escala nunca "escorrega".
 */
export type RegraDesembarque = 'conta_embarcado' | 'conta_folga';

export interface ParametrosEscala {
  regime: Regime;
  regraDesembarque: RegraDesembarque;
  /** Dias de folga logo antes do embarque usados em viagem. */
  diasViagemAntes: number;
  /** Dias de folga logo depois do desembarque usados em viagem. */
  diasViagemDepois: number;
}

/**
 * Ponto de referência do ciclo. A escala é uma sequência de âncoras:
 * a configuração inicial cria a primeira; re-ancorar após um ajuste cria outra.
 */
export interface Ancora {
  /** Um dia de embarque (1º dia a bordo) do ciclo. */
  dataEmbarque: DiaISO;
  /** A partir de quando esta âncora vale. A primeira vale também para trás. */
  vigenteDesde: DiaISO;
}

export type Categoria = 'embarcado' | 'folga' | 'viagem' | 'curso' | 'afastamento' | 'ferias';
export type Marco = 'embarque' | 'desembarque';

export interface Periodo {
  /** Posição do dia dentro do período contínuo (começa em 1). */
  dia: number;
  total: number;
  inicio: DiaISO;
  fim: DiaISO;
}

export interface DiaEscala {
  data: DiaISO;
  /** Conta como dia embarcado? */
  aBordo: boolean;
  categoria: Categoria;
  marcos: Marco[];
  periodo: Periodo;
  /** Ajuste manual que define este dia (o mais recente, se houver vários). */
  ajuste?: { id?: number; tipo: TipoAjuste; indice: number };
}
