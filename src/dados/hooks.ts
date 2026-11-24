import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { hoje, type DiaISO } from '../dominio/datas';
import type { EntradaEscala } from '../dominio/escala';
import { db, type RegistroAncora, type RegistroConfiguracao, type RegistroEvento } from './db';

export type EstadoDados =
  | { carregando: true }
  | { carregando: false; configuracao: null }
  | {
      carregando: false;
      configuracao: RegistroConfiguracao;
      ancoras: RegistroAncora[];
      entrada: EntradaEscala;
    };

export function useDadosEscala(): EstadoDados {
  const dados = useLiveQuery(async () => {
    const configuracao = (await db.configuracao.get('atual')) ?? null;
    const ancoras = await db.ancoras.orderBy('vigenteDesde').toArray();
    return { configuracao, ancoras };
  });

  return useMemo<EstadoDados>(() => {
    if (!dados) return { carregando: true };
    const { configuracao, ancoras } = dados;
    if (!configuracao || ancoras.length === 0) return { carregando: false, configuracao: null };
    const { regime, regraDesembarque, diasViagemAntes, diasViagemDepois } = configuracao;
    return {
      carregando: false,
      configuracao,
      ancoras,
      entrada: {
        parametros: { regime, regraDesembarque, diasViagemAntes, diasViagemDepois },
        ancoras,
      },
    };
  }, [dados]);
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
