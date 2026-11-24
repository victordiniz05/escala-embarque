import Dexie, { type EntityTable } from 'dexie';
import type { DiaISO } from '../dominio/datas';
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

class BancoEscala extends Dexie {
  configuracao!: EntityTable<RegistroConfiguracao, 'id'>;
  ancoras!: EntityTable<RegistroAncora, 'id'>;

  constructor() {
    super('escala-embarque');
    // Tabelas de ajustes e dias realizados entram nas próximas versões.
    this.version(1).stores({
      configuracao: 'id',
      ancoras: '++id, vigenteDesde, origem',
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
