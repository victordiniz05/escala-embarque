import type { DiaISO } from '../dominio/datas';
import type { EntradaEscala } from '../dominio/escala';
import {
  congelar,
  intervaloParaConsolidar,
  recalcularHistorico as calcularRecalculo,
  type DiaRealizado,
} from '../dominio/historico';
import { db } from './db';

/** Primeiro dia do histórico = início da escala (ou hoje, se não houver). */
function inicioDoHistorico(entrada: EntradaEscala, hoje: DiaISO): DiaISO {
  return entrada.inicio ?? hoje;
}

/** Grava no histórico os dias que já passaram e ainda não foram gravados. */
export async function consolidarHistorico(entrada: EntradaEscala, hoje: DiaISO): Promise<number> {
  const inicio = inicioDoHistorico(entrada, hoje);
  // Nada antes do início da escala.
  await db.realizados.where('data').below(inicio).delete();
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
  const inicioHistorico = inicioDoHistorico(depois, hoje);
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
