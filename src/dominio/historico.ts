import { maiorDia, menorDia, somarDias, type DiaISO } from './datas';
import { diaDaEscala, projetarEscala, type EntradaEscala } from './escala';
import type { DiaEscala } from './tipos';

/**
 * Histórico (escala realizada): os dias que já passaram ficam gravados como
 * estavam, separados da projeção. Assim, mudar a configuração da escala não
 * reescreve o passado. Correções do passado entram como ajustes, que
 * recalculam o histórico a partir do início do ajuste.
 */
export interface DiaRealizado extends DiaEscala {
  congeladoEm: string;
}

/** Primeiro dia do histórico: 1º de janeiro do ano em que o app foi configurado. */
export function inicioPadraoDoHistorico(hoje: DiaISO): DiaISO {
  return `${hoje.slice(0, 4)}-01-01` as DiaISO;
}

/**
 * Intervalo de dias a gravar: do dia seguinte ao último gravado (ou do início
 * do histórico) até ontem. `null` se não há nada a fazer.
 */
export function intervaloParaConsolidar(
  inicioHistorico: DiaISO,
  ultimoGravado: DiaISO | undefined,
  hoje: DiaISO,
): { de: DiaISO; ate: DiaISO } | null {
  const ontem = somarDias(hoje, -1);
  const de = ultimoGravado ? maiorDia(somarDias(ultimoGravado, 1), inicioHistorico) : inicioHistorico;
  return de > ontem ? null : { de, ate: ontem };
}

/**
 * De onde recalcular quando um ajuste começa em `desde`: do início do período
 * vizinho (antes e depois da mudança), porque o desembarque e o "dia X de Y"
 * desse período também mudam.
 */
export function inicioDoRecalculo(entradas: readonly EntradaEscala[], desde: DiaISO): DiaISO {
  const vespera = somarDias(desde, -1);
  return entradas.reduce((min, e) => menorDia(min, diaDaEscala(e, vespera).periodo.inicio), desde);
}

/**
 * Intervalo a regravar depois de criar, editar ou excluir um ajuste que mexe no
 * passado: de `desde` (ver inicioDoRecalculo) até ontem.
 */
export function intervaloParaRecalcular(
  desde: DiaISO,
  inicioHistorico: DiaISO,
  hoje: DiaISO,
): { de: DiaISO; ate: DiaISO } | null {
  const ontem = somarDias(hoje, -1);
  const de = maiorDia(desde, inicioHistorico);
  return de > ontem ? null : { de, ate: ontem };
}

export function congelar(entrada: EntradaEscala, de: DiaISO, ate: DiaISO, agora: string): DiaRealizado[] {
  return projetarEscala(entrada, de, ate).map((d) => ({ ...d, congeladoEm: agora }));
}

/**
 * Escala para mostrar: dias antes de hoje vêm do histórico (quando existe);
 * hoje e o futuro vêm da projeção.
 */
export function mesclarComHistorico(
  projetados: readonly DiaEscala[],
  realizados: ReadonlyMap<DiaISO, DiaRealizado>,
  hoje: DiaISO,
): (DiaEscala & { realizado?: true })[] {
  return projetados.map((d) => {
    if (d.data >= hoje) return d;
    const r = realizados.get(d.data);
    if (!r) return d;
    const { congeladoEm: _ignorado, ...dia } = r;
    void _ignorado;
    return { ...dia, realizado: true as const };
  });
}
