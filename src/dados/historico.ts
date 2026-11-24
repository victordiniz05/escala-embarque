import type { DiaISO } from '../dominio/datas';
import type { EntradaEscala } from '../dominio/escala';
import {
  congelar,
  inicioPadraoDoHistorico,
  intervaloParaConsolidar,
  recalcularHistorico as calcularRecalculo,
  type DiaRealizado,
} from '../dominio/historico';
import { db } from './db';

const CHAVE_INICIO = 'inicioHistorico';

/** Primeiro dia do histórico (definido na primeira vez que o app roda). */
export async function inicioDoHistorico(hoje: DiaISO): Promise<DiaISO> {
  const salvo = await db.meta.get(CHAVE_INICIO);
  if (salvo) return salvo.valor as DiaISO;
  const inicio = inicioPadraoDoHistorico(hoje);
  await db.meta.put({ chave: CHAVE_INICIO, valor: inicio });
  return inicio;
}

/** Grava no histórico os dias que já passaram e ainda não foram gravados. */
export async function consolidarHistorico(entrada: EntradaEscala, hoje: DiaISO): Promise<number> {
  const inicio = await inicioDoHistorico(hoje);
  const ultimo = await db.realizados.orderBy('data').last();
  const intervalo = intervaloParaConsolidar(inicio, ultimo?.data, hoje);
  if (!intervalo) return 0;
  const dias = congelar(entrada, intervalo.de, intervalo.ate, new Date().toISOString());
  await db.realizados.bulkPut(dias);
  return dias.length;
}

/**
 * Depois de salvar ou excluir um ajuste que mexe no passado, regrava no
 * histórico os dias que o ajuste muda (o resto fica como foi gravado).
 */
export async function recalcularHistorico(
  antes: EntradaEscala,
  depois: EntradaEscala,
  faixas: readonly { inicio: DiaISO; fim: DiaISO }[],
  hoje: DiaISO,
): Promise<void> {
  if (faixas.every((f) => f.inicio >= hoje)) return;
  const inicioHistorico = await inicioDoHistorico(hoje);
  const lista = await db.realizados.toArray();
  const realizados = new Map<DiaISO, DiaRealizado>(lista.map((d) => [d.data, d]));
  const dias = calcularRecalculo({
    antes,
    depois,
    faixas,
    realizados,
    inicioHistorico,
    hoje,
    agora: new Date().toISOString(),
  });
  if (dias.length > 0) await db.realizados.bulkPut(dias);
}

/** Apaga o histórico e grava de novo pela escala atual (saída de emergência). */
export async function refazerHistorico(entrada: EntradaEscala, hoje: DiaISO): Promise<void> {
  await db.realizados.clear();
  await consolidarHistorico(entrada, hoje);
}
