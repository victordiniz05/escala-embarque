import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { hoje, type DiaISO } from '../dominio/datas';
import type { EntradaEscala } from '../dominio/escala';
import type { DiaRealizado } from '../dominio/historico';
import { db, type RegistroAjuste, type RegistroAncora, type RegistroConfiguracao, type RegistroEvento } from './db';

export type EstadoDados =
  | { carregando: true }
  | { carregando: false; configuracao: null }
  | {
      carregando: false;
      configuracao: RegistroConfiguracao;
      ancoras: RegistroAncora[];
      ajustes: RegistroAjuste[];
      entrada: EntradaEscala;
      /** Histórico (dias que já passaram), por data. */
      realizados: Map<DiaISO, DiaRealizado>;
    };

export function useDadosEscala(): EstadoDados {
  const dados = useLiveQuery(async () => {
    const configuracao = (await db.configuracao.get('atual')) ?? null;
    const ancoras = await db.ancoras.orderBy('vigenteDesde').toArray();
    // Ordem de criação (id): o ajuste mais recente vence quando há sobreposição.
    const ajustes = await db.ajustes.toArray();
    return { configuracao, ancoras, ajustes };
  });
  // Consulta separada: gravar no histórico não recria a escala.
  const realizados = useLiveQuery(async () => {
    const lista = await db.realizados.toArray();
    return new Map(lista.map((d) => [d.data, d]));
  });

  const base = useMemo(() => {
    if (!dados?.configuracao || dados.ancoras.length === 0) return null;
    const { configuracao, ancoras, ajustes } = dados;
    const { regime, regraDesembarque, diasViagemAntes, diasViagemDepois } = configuracao;
    const entrada: EntradaEscala = {
      parametros: { regime, regraDesembarque, diasViagemAntes, diasViagemDepois },
      ancoras,
      ajustes,
      inicio: configuracao.inicioEscala,
    };
    return { configuracao, ancoras, ajustes, entrada };
  }, [dados]);

  return useMemo<EstadoDados>(() => {
    // Só mostra o app quando a escala e o histórico já carregaram (sem "piscar").
    if (!dados || !realizados) return { carregando: true };
    if (!base) return { carregando: false, configuracao: null };
    return { carregando: false, ...base, realizados };
  }, [dados, realizados, base]);
}

/** Hoje em São Paulo, atualizado quando o app volta para a tela ou vira o dia. */
export function useHoje(): DiaISO {
  const [dia, setDia] = useState<DiaISO>(() => hoje());
  useEffect(() => {
    const atualizar = () => setDia(hoje());
    const intervalo = window.setInterval(atualizar, 60_000);
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, []);
  return dia;
}

/** Eventos ordenados por data (lista vazia enquanto carrega). */
export function useEventos(): RegistroEvento[] {
  return useLiveQuery(() => db.eventos.orderBy('inicio').toArray(), [], []);
}

export function useUltimoBackup(): string | undefined {
  return useLiveQuery(async () => (await db.meta.get('ultimoBackup'))?.valor, []);
}

export function useLembreteBackupAdiadoAte(): DiaISO | undefined {
  return useLiveQuery(async () => (await db.meta.get('lembreteBackupAdiadoAte'))?.valor as DiaISO | undefined, []);
}
