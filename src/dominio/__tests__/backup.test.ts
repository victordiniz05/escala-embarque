import { describe, expect, it } from 'vitest';
import { lerBackup, montarBackup, nomeArquivoBackup, type DadosBackup } from '../backup';
import { diaISO } from '../datas';
import { congelar } from '../historico';

const d = (s: string) => diaISO(s);

const parametros = {
  regime: { embarcado: 28, folga: 28 },
  regraDesembarque: 'conta_folga' as const,
  diasViagemAntes: 0,
  diasViagemDepois: 1,
};

const dados: DadosBackup = {
  configuracao: { ...parametros, embarcacao: 'P-77', empresa: 'Petrobras', tema: 'sistema' },
  ancoras: [{ dataEmbarque: d('2026-11-13'), vigenteDesde: d('2026-11-13'), origem: 'configuracao' }],
  ajustes: [
    {
      id: 3,
      tipo: 'dobra',
      inicio: d('2026-12-11'),
      fim: d('2026-12-24'),
      observacao: 'Rendição atrasou',
      aposAjuste: 'reancorar',
      criadoEm: '2026-11-24T10:00:00.000Z',
    },
    {
      id: 4,
      tipo: 'troca',
      inicio: d('2027-01-10'),
      fim: d('2027-01-12'),
      observacao: '',
      colega: 'João',
      estadoTroca: 'folga',
      aposAjuste: 'retomar_ciclo',
    },
  ],
  eventos: [{ nome: 'ETAPA SP', inicio: d('2027-05-16') }],
  realizados: congelar(
    { parametros, ancoras: [{ dataEmbarque: d('2026-11-13'), vigenteDesde: d('2026-11-13') }] },
    d('2026-01-01'),
    d('2026-01-10'),
    '2026-11-24T10:00:00.000Z',
  ),
  inicioHistorico: d('2026-01-01'),
};

const valido = () => JSON.parse(JSON.stringify(montarBackup(dados, '2026-11-24T12:00:00.000Z')));

describe('backup', () => {
  it('nome do arquivo tem a data', () => {
    expect(nomeArquivoBackup(d('2026-11-24'))).toBe('escala-embarque-backup-2026-11-24.json');
  });

  it('exportar e importar devolve os mesmos dados', () => {
    const texto = JSON.stringify(montarBackup(dados, '2026-11-24T12:00:00.000Z'));
    const r = lerBackup(texto);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup.dados).toEqual(dados);
    expect(r.resumo).toEqual({
      exportadoEm: '2026-11-24T12:00:00.000Z',
      regime: '28x28',
      ajustes: 2,
      eventos: 1,
      diasHistorico: 10,
    });
  });

  it('recusa arquivo que não é JSON', () => {
    expect(lerBackup('não é json')).toEqual({ ok: false, erro: 'O arquivo não é um backup válido (não é JSON).' });
  });

  it('recusa JSON de outro app', () => {
    const r = lerBackup(JSON.stringify({ app: 'outro', versao: 1 }));
    expect(r).toEqual({ ok: false, erro: 'Este arquivo não é um backup do Escala Embarque.' });
  });

  it('recusa backup de versão mais nova', () => {
    const b = valido();
    b.versao = 99;
    const r = lerBackup(JSON.stringify(b));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/versão mais nova/);
  });

  it('recusa datas impossíveis e tipos desconhecidos', () => {
    const b1 = valido();
    b1.dados.ajustes[0].fim = '2026-02-30';
    expect(lerBackup(JSON.stringify(b1))).toEqual({ ok: false, erro: 'Ajuste 1: datas inválidas.' });

    const b2 = valido();
    b2.dados.ajustes[1].tipo = 'pescaria';
    expect(lerBackup(JSON.stringify(b2))).toEqual({ ok: false, erro: 'Ajuste 2: tipo desconhecido.' });

    const b3 = valido();
    b3.dados.eventos[0].nome = '   ';
    expect(lerBackup(JSON.stringify(b3))).toEqual({ ok: false, erro: 'Evento 1: sem nome.' });
  });

  it('recusa configuração inválida', () => {
    const b = valido();
    b.dados.configuracao.regime.embarcado = 0;
    const r = lerBackup(JSON.stringify(b));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/^Configuração inválida/);
  });

  it('recusa backup sem âncora', () => {
    const b = valido();
    b.dados.ancoras = [];
    expect(lerBackup(JSON.stringify(b))).toEqual({ ok: false, erro: 'O arquivo não tem a data de embarque (âncora).' });
  });

  it('recusa histórico corrompido', () => {
    const b = valido();
    b.dados.realizados[3].categoria = 'praia';
    expect(lerBackup(JSON.stringify(b))).toEqual({ ok: false, erro: 'Histórico, dia 4: dados inválidos.' });
  });

  it('ignora campos extras desconhecidos nos ajustes e eventos', () => {
    const b = valido();
    b.dados.ajustes[0].campoNovo = 'x';
    b.dados.eventos[0].cor = 'azul';
    const r = lerBackup(JSON.stringify(b));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.dados.ajustes[0]).not.toHaveProperty('campoNovo');
      expect(r.backup.dados.eventos[0]).not.toHaveProperty('cor');
    }
  });
});
