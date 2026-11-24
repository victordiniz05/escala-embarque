import Dexie, { type EntityTable } from 'dexie';
import type { DiaISO } from '../dominio/datas';
import type { Ajuste } from '../dominio/ajustes';
import type { Evento } from '../dominio/eventos';
import type { DiaRealizado } from '../dominio/historico';
import type { Ancora, ParametrosEscala } from '../dominio/tipos';

export type Tema = 'sistema' | 'claro' | 'escuro';

export interface RegistroConfiguracao extends ParametrosEscala {
  id: 'atual';
  embarcacao: string;
  empresa: string;
  tema: Tema;
  atualizadoEm: string;
}

export interface RegistroAncora extends Ancora {
  id?: number;
  origem: 'configuracao' | 'reancoragem';
}

export interface RegistroAjuste extends Ajuste {
  id?: number;
  criadoEm: string;
}

export interface RegistroEvento extends Evento {
  id?: number;
  criadoEm: string;
}

class BancoEscala extends Dexie {
  configuracao!: EntityTable<RegistroConfiguracao, 'id'>;
  ancoras!: EntityTable<RegistroAncora, 'id'>;
  eventos!: EntityTable<RegistroEvento, 'id'>;
  ajustes!: EntityTable<RegistroAjuste, 'id'>;
  /** Histórico: dias que já passaram, gravados como estavam. */
  realizados!: EntityTable<DiaRealizado, 'data'>;
  /** Valores avulsos (ex.: início do histórico). */
  meta!: EntityTable<{ chave: string; valor: string }, 'chave'>;

  constructor() {
    super('escala-embarque');
    this.version(1).stores({
      configuracao: 'id',
      ancoras: '++id, vigenteDesde, origem',
    });
    this.version(2).stores({
      eventos: '++id, inicio',
    });
    this.version(3).stores({
      ajustes: '++id, inicio, fim',
    });
    this.version(4).stores({
      realizados: 'data',
      meta: 'chave',
    });
  }
}

export const db = new BancoEscala();

/** Pede ao navegador para não apagar os dados (importante no iPhone). */
export async function pedirArmazenamentoPersistente(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // Sem suporte: segue normalmente.
  }
}

export interface DadosConfiguracaoInicial extends ParametrosEscala {
  dataEmbarque: DiaISO;
  embarcacao: string;
  empresa: string;
}

/** Salva (ou refaz) a configuração da escala e a âncora principal. */
export async function salvarConfiguracao(dados: DadosConfiguracaoInicial): Promise<void> {
  const { dataEmbarque, ...resto } = dados;
  await db.transaction('rw', db.configuracao, db.ancoras, async () => {
    const atual = await db.configuracao.get('atual');
    await db.configuracao.put({
      ...resto,
      id: 'atual',
      tema: atual?.tema ?? 'sistema',
      atualizadoEm: new Date().toISOString(),
    });
    await db.ancoras.where('origem').equals('configuracao').delete();
    await db.ancoras.add({ dataEmbarque, vigenteDesde: dataEmbarque, origem: 'configuracao' });
  });
}

export async function salvarTema(tema: Tema): Promise<void> {
  await db.configuracao.update('atual', { tema });
}

export async function salvarEvento(evento: Evento, id?: number): Promise<void> {
  const dados: RegistroEvento = {
    nome: evento.nome.trim(),
    inicio: evento.inicio,
    ...(evento.fim && evento.fim > evento.inicio ? { fim: evento.fim } : {}),
    criadoEm: new Date().toISOString(),
  };
  if (id === undefined) await db.eventos.add(dados);
  else await db.eventos.put({ ...dados, id });
}

export async function excluirEvento(id: number): Promise<void> {
  await db.eventos.delete(id);
}

/** Salva um ajuste. Ao editar, mantém a posição original (a ordem decide sobreposições). */
export async function salvarAjuste(ajuste: Ajuste): Promise<number> {
  const dados: RegistroAjuste = {
    tipo: ajuste.tipo,
    inicio: ajuste.inicio,
    fim: ajuste.fim < ajuste.inicio ? ajuste.inicio : ajuste.fim,
    observacao: ajuste.observacao.trim(),
    aposAjuste: ajuste.aposAjuste,
    ...(ajuste.tipo === 'troca' ? { estadoTroca: ajuste.estadoTroca, colega: ajuste.colega?.trim() || undefined } : {}),
    criadoEm: new Date().toISOString(),
  };
  if (ajuste.id === undefined) return (await db.ajustes.add(dados)) as number;
  const atual = await db.ajustes.get(ajuste.id);
  await db.ajustes.put({ ...dados, id: ajuste.id, criadoEm: atual?.criadoEm ?? dados.criadoEm });
  return ajuste.id;
}

export async function excluirAjuste(id: number): Promise<void> {
  await db.ajustes.delete(id);
}
