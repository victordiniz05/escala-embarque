import { maiorDia, menorDia, paraNumero, somarDias, type DiaISO } from './datas';
import { derivarEscala, diaDaEscala, projetarEscala, type EntradaEscala } from './escala';
import { duracaoCiclo } from './regimes';
import type { Categoria, DiaEscala } from './tipos';

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

function igual(a: DiaEscala, b: DiaEscala): boolean {
  return (
    a.aBordo === b.aBordo &&
    a.categoria === b.categoria &&
    a.marcos.join() === b.marcos.join() &&
    a.periodo.dia === b.periodo.dia &&
    a.periodo.total === b.periodo.total &&
    a.periodo.inicio === b.periodo.inicio &&
    a.ajuste?.id === b.ajuste?.id &&
    a.ajuste?.tipo === b.ajuste?.tipo
  );
}

const semViagem = (c: Categoria): Categoria => (c === 'viagem' ? 'folga' : c);

function mesmoEstado(a: DiaEscala, b: DiaEscala): boolean {
  return (
    a.aBordo === b.aBordo &&
    semViagem(a.categoria) === semViagem(b.categoria) &&
    a.ajuste?.id === b.ajuste?.id &&
    a.ajuste?.tipo === b.ajuste?.tipo
  );
}

export interface EntradaRecalculo {
  /** Escala sem a mudança e com a mudança. */
  antes: EntradaEscala;
  depois: EntradaEscala;
  /** Dias cobertos pelo ajuste (o antigo e o novo, ao editar). */
  faixas: readonly { inicio: DiaISO; fim: DiaISO }[];
  realizados: ReadonlyMap<DiaISO, DiaRealizado>;
  inicioHistorico: DiaISO;
  hoje: DiaISO;
  agora: string;
}

/**
 * Dias do histórico a regravar depois de criar, editar ou excluir um ajuste.
 *
 * - Os dias cobertos pelo ajuste, e os que ele muda (ex.: re-ancoragem),
 *   recebem o estado novo.
 * - Os demais dias ficam como foram gravados, mesmo que a escala tenha mudado
 *   depois.
 * - Embarque, desembarque, viagem e "dia X de Y" são recalculados por cima.
 */
export function recalcularHistorico(e: EntradaRecalculo): DiaRealizado[] {
  const desde = e.faixas.reduce((m, f) => menorDia(m, f.inicio), e.faixas[0]?.inicio ?? e.hoje);
  const intervalo = intervaloParaRecalcular(inicioDoRecalculo([e.antes, e.depois], desde), e.inicioHistorico, e.hoje);
  if (!intervalo) return [];

  const ciclo = duracaoCiclo(e.depois.parametros.regime);
  const wDe = somarDias(intervalo.de, -2 * ciclo);
  const wAte = somarDias(e.hoje, 2 * ciclo);
  const pa = projetarEscala(e.antes, wDe, wAte);
  const pb = projetarEscala(e.depois, wDe, wAte);
  const naFaixa = (d: DiaISO) => e.faixas.some((f) => f.inicio <= d && d <= f.fim);

  const aBordo: boolean[] = [];
  const categoria: Categoria[] = [];
  const ajuste: (DiaEscala['ajuste'] | undefined)[] = [];
  pb.forEach((novo, i) => {
    const gravado = novo.data < e.hoje ? e.realizados.get(novo.data) : undefined;
    const usarNovo = !gravado || naFaixa(novo.data) || !mesmoEstado(pa[i]!, novo);
    const fonte = usarNovo ? novo : gravado;
    aBordo.push(fonte.aBordo);
    categoria.push(semViagem(fonte.categoria));
    ajuste.push(fonte.ajuste);
  });

  const derivados = derivarEscala(paraNumero(wDe), aBordo, categoria, ajuste, e.depois.parametros);
  return derivados
    .filter((d) => d.data >= intervalo.de && d.data <= intervalo.ate)
    .filter((d) => {
      const gravado = e.realizados.get(d.data);
      return !gravado || !igual(d, gravado);
    })
    .map((d) => ({ ...d, congeladoEm: e.agora }));
}

export function congelar(entrada: EntradaEscala, de: DiaISO, ate: DiaISO, agora: string): DiaRealizado[] {
  return projetarEscala(entrada, de, ate).map((d) => ({ ...d, congeladoEm: agora }));
}

/**
 * Escala para mostrar: dias antes de hoje vêm do histórico (quando existe);
 * hoje e o futuro vêm da projeção.
 */
export type DiaMostrado = DiaEscala & { realizado?: true };

export function mesclarComHistorico(
  projetados: readonly DiaEscala[],
  realizados: ReadonlyMap<DiaISO, DiaRealizado>,
  hoje: DiaISO,
): DiaMostrado[] {
  return projetados.map((d) => {
    if (d.data >= hoje) return d;
    const r = realizados.get(d.data);
    if (!r) return d;
    const { congeladoEm: _ignorado, ...dia } = r;
    void _ignorado;
    return { ...dia, realizado: true as const };
  });
}
