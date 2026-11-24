import { TIPOS_AJUSTE, type Ajuste } from './ajustes';
import { ehDiaISO, type DiaISO } from './datas';
import type { Evento } from './eventos';
import type { DiaRealizado } from './historico';
import { validarParametros } from './regimes';
import type { Ancora, Categoria, ParametrosEscala } from './tipos';

export const ID_APP = 'escala-embarque';
export const VERSAO_BACKUP = 1;

export interface ConfiguracaoBackup extends ParametrosEscala {
  embarcacao: string;
  empresa: string;
  tema: 'sistema' | 'claro' | 'escuro';
  inicioEscala?: DiaISO;
}

export interface DadosBackup {
  configuracao: ConfiguracaoBackup;
  ancoras: (Ancora & { origem: 'configuracao' | 'reancoragem' })[];
  ajustes: (Ajuste & { criadoEm?: string })[];
  eventos: (Evento & { criadoEm?: string })[];
  realizados: DiaRealizado[];
  inicioHistorico?: DiaISO;
}

export interface Backup {
  app: typeof ID_APP;
  versao: number;
  exportadoEm: string;
  dados: DadosBackup;
}

export function montarBackup(dados: DadosBackup, agora: string): Backup {
  return { app: ID_APP, versao: VERSAO_BACKUP, exportadoEm: agora, dados };
}

export function nomeArquivoBackup(hoje: DiaISO): string {
  return `escala-embarque-backup-${hoje}.json`;
}

export interface ResumoBackup {
  exportadoEm: string;
  regime: string;
  ajustes: number;
  eventos: number;
  diasHistorico: number;
}

export type ResultadoLeitura = { ok: true; backup: Backup; resumo: ResumoBackup } | { ok: false; erro: string };

const CATEGORIAS: readonly Categoria[] = ['embarcado', 'folga', 'viagem', 'curso', 'afastamento', 'ferias'];

class ErroBackup extends Error {}

function exigir(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new ErroBackup(mensagem);
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ehData = (v: unknown): v is DiaISO => typeof v === 'string' && ehDiaISO(v);
const ehInteiro = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const textoOpcional = (v: unknown) => v === undefined || typeof v === 'string';

function lista(v: unknown, nome: string): unknown[] {
  exigir(Array.isArray(v), `O arquivo não tem a lista de ${nome}.`);
  return v;
}

function validarConfiguracao(v: unknown): ConfiguracaoBackup {
  exigir(ehObjeto(v), 'O arquivo não tem a configuração da escala.');
  exigir(ehObjeto(v.regime), 'Regime inválido no arquivo.');
  const parametros: ParametrosEscala = {
    regime: { embarcado: v.regime.embarcado as number, folga: v.regime.folga as number },
    regraDesembarque: v.regraDesembarque as ParametrosEscala['regraDesembarque'],
    diasViagemAntes: v.diasViagemAntes as number,
    diasViagemDepois: v.diasViagemDepois as number,
  };
  exigir(
    parametros.regraDesembarque === 'conta_embarcado' || parametros.regraDesembarque === 'conta_folga',
    'Regra do desembarque inválida no arquivo.',
  );
  const erros = validarParametros(parametros);
  exigir(erros.length === 0, `Configuração inválida no arquivo: ${erros[0]}`);
  exigir(['sistema', 'claro', 'escuro'].includes(v.tema as string), 'Tema inválido no arquivo.');
  exigir(typeof v.embarcacao === 'string' && typeof v.empresa === 'string', 'Embarcação ou empresa inválida no arquivo.');
  exigir(v.inicioEscala === undefined || ehData(v.inicioEscala), 'Início da escala inválido no arquivo.');
  return {
    ...(v.inicioEscala !== undefined ? { inicioEscala: v.inicioEscala as DiaISO } : {}),
    ...parametros,
    embarcacao: v.embarcacao as string,
    empresa: v.empresa as string,
    tema: v.tema as ConfiguracaoBackup['tema'],
  };
}

function validarAncora(v: unknown, i: number): DadosBackup['ancoras'][number] {
  exigir(ehObjeto(v), `Âncora ${i + 1} inválida.`);
  exigir(ehData(v.dataEmbarque) && ehData(v.vigenteDesde), `Âncora ${i + 1}: data inválida.`);
  exigir(v.origem === 'configuracao' || v.origem === 'reancoragem', `Âncora ${i + 1}: origem inválida.`);
  return { dataEmbarque: v.dataEmbarque, vigenteDesde: v.vigenteDesde, origem: v.origem };
}

function validarAjuste(v: unknown, i: number): DadosBackup['ajustes'][number] {
  exigir(ehObjeto(v), `Ajuste ${i + 1} inválido.`);
  exigir(TIPOS_AJUSTE.includes(v.tipo as Ajuste['tipo']), `Ajuste ${i + 1}: tipo desconhecido.`);
  exigir(ehData(v.inicio) && ehData(v.fim) && v.fim >= v.inicio, `Ajuste ${i + 1}: datas inválidas.`);
  exigir(v.aposAjuste === 'retomar_ciclo' || v.aposAjuste === 'reancorar', `Ajuste ${i + 1}: opção inválida.`);
  exigir(
    v.estadoTroca === undefined || v.estadoTroca === 'embarcado' || v.estadoTroca === 'folga',
    `Ajuste ${i + 1}: troca inválida.`,
  );
  exigir(textoOpcional(v.observacao) && textoOpcional(v.colega) && textoOpcional(v.criadoEm), `Ajuste ${i + 1}: texto inválido.`);
  exigir(v.id === undefined || ehInteiro(v.id), `Ajuste ${i + 1}: identificador inválido.`);
  return {
    ...(v.id !== undefined ? { id: v.id as number } : {}),
    tipo: v.tipo as Ajuste['tipo'],
    inicio: v.inicio,
    fim: v.fim,
    observacao: (v.observacao as string | undefined) ?? '',
    aposAjuste: v.aposAjuste,
    ...(v.colega !== undefined ? { colega: v.colega as string } : {}),
    ...(v.estadoTroca !== undefined ? { estadoTroca: v.estadoTroca as 'embarcado' | 'folga' } : {}),
    ...(v.criadoEm !== undefined ? { criadoEm: v.criadoEm as string } : {}),
  };
}

function validarEvento(v: unknown, i: number): DadosBackup['eventos'][number] {
  exigir(ehObjeto(v), `Evento ${i + 1} inválido.`);
  exigir(typeof v.nome === 'string' && v.nome.trim() !== '', `Evento ${i + 1}: sem nome.`);
  exigir(ehData(v.inicio), `Evento ${i + 1}: data inválida.`);
  exigir(v.fim === undefined || ehData(v.fim), `Evento ${i + 1}: data final inválida.`);
  exigir(textoOpcional(v.criadoEm), `Evento ${i + 1}: data de criação inválida.`);
  return {
    nome: v.nome as string,
    inicio: v.inicio,
    ...(v.fim !== undefined ? { fim: v.fim as DiaISO } : {}),
    ...(v.criadoEm !== undefined ? { criadoEm: v.criadoEm as string } : {}),
  };
}

function validarRealizado(v: unknown, i: number): DiaRealizado {
  const erro = `Histórico, dia ${i + 1}: dados inválidos.`;
  exigir(ehObjeto(v), erro);
  exigir(ehData(v.data) && typeof v.aBordo === 'boolean', erro);
  exigir(CATEGORIAS.includes(v.categoria as Categoria), erro);
  exigir(Array.isArray(v.marcos) && v.marcos.every((m) => m === 'embarque' || m === 'desembarque'), erro);
  const p = v.periodo;
  exigir(ehObjeto(p) && ehInteiro(p.dia) && ehInteiro(p.total) && ehData(p.inicio) && ehData(p.fim), erro);
  exigir(v.ajuste === undefined || (ehObjeto(v.ajuste) && TIPOS_AJUSTE.includes(v.ajuste.tipo as Ajuste['tipo'])), erro);
  exigir(typeof v.congeladoEm === 'string', erro);
  return v as unknown as DiaRealizado;
}

/** Lê e valida o texto de um arquivo de backup. Nunca lança exceção. */
export function lerBackup(texto: string): ResultadoLeitura {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return { ok: false, erro: 'O arquivo não é um backup válido (não é JSON).' };
  }
  try {
    exigir(ehObjeto(bruto) && bruto.app === ID_APP, 'Este arquivo não é um backup do Escala Embarque.');
    exigir(ehInteiro(bruto.versao), 'Versão do backup inválida.');
    exigir(
      bruto.versao <= VERSAO_BACKUP,
      'Este backup foi feito numa versão mais nova do app. Atualize o app e tente de novo.',
    );
    exigir(typeof bruto.exportadoEm === 'string', 'Data do backup inválida.');
    exigir(ehObjeto(bruto.dados), 'O arquivo não tem dados.');
    const d = bruto.dados;
    const configuracao = validarConfiguracao(d.configuracao);
    const ancoras = lista(d.ancoras, 'âncoras').map(validarAncora);
    exigir(ancoras.length > 0, 'O arquivo não tem a data de embarque (âncora).');
    const ajustes = lista(d.ajustes, 'ajustes').map(validarAjuste);
    const eventos = lista(d.eventos, 'eventos').map(validarEvento);
    const realizados = lista(d.realizados, 'dias do histórico').map(validarRealizado);
    exigir(d.inicioHistorico === undefined || ehData(d.inicioHistorico), 'Início do histórico inválido.');

    const backup: Backup = {
      app: ID_APP,
      versao: bruto.versao,
      exportadoEm: bruto.exportadoEm,
      dados: {
        configuracao,
        ancoras,
        ajustes,
        eventos,
        realizados,
        ...(d.inicioHistorico !== undefined ? { inicioHistorico: d.inicioHistorico as DiaISO } : {}),
      },
    };
    return {
      ok: true,
      backup,
      resumo: {
        exportadoEm: bruto.exportadoEm,
        regime: `${configuracao.regime.embarcado}x${configuracao.regime.folga}`,
        ajustes: ajustes.length,
        eventos: eventos.length,
        diasHistorico: realizados.length,
      },
    };
  } catch (e) {
    if (e instanceof ErroBackup) return { ok: false, erro: e.message };
    return { ok: false, erro: 'Não foi possível ler o backup.' };
  }
}
