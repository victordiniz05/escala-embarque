import { describe, expect, it } from 'vitest';
import type { Ajuste } from '../ajustes';
import { diaISO, type DiaISO } from '../datas';
import { projetarEscala, type EntradaEscala } from '../escala';
import {
  congelar,
  recalcularHistorico,
  inicioDoRecalculo,
  inicioPadraoDoHistorico,
  intervaloParaConsolidar,
  intervaloParaRecalcular,
  mesclarComHistorico,
  type DiaRealizado,
} from '../historico';
import type { ParametrosEscala } from '../tipos';

const d = (s: string) => diaISO(s);
const AGORA = '2027-02-10T12:00:00.000Z';

function escala(embarque: string, extra: Partial<ParametrosEscala> = {}, ajustes: Ajuste[] = []): EntradaEscala {
  return {
    parametros: {
      regime: { embarcado: 28, folga: 28 },
      regraDesembarque: 'conta_embarcado',
      diasViagemAntes: 0,
      diasViagemDepois: 0,
      ...extra,
    },
    ancoras: [{ dataEmbarque: d(embarque), vigenteDesde: d(embarque) }],
    ajustes,
  };
}

/** Simula o banco: grava os dias congelados num Map. */
function gravar(banco: Map<DiaISO, DiaRealizado>, dias: DiaRealizado[]) {
  for (const x of dias) banco.set(x.data, x);
}

describe('intervalos do histórico', () => {
  it('começa em 1º de janeiro do ano da configuração', () => {
    expect(inicioPadraoDoHistorico(d('2026-11-24'))).toBe('2026-01-01');
  });

  it('na primeira vez, grava do início até ontem', () => {
    expect(intervaloParaConsolidar(d('2026-01-01'), undefined, d('2026-11-24'))).toEqual({
      de: '2026-01-01',
      ate: '2026-11-23',
    });
  });

  it('depois, só os dias que faltam (atravessando a virada do ano)', () => {
    expect(intervaloParaConsolidar(d('2026-01-01'), d('2026-12-29'), d('2027-01-03'))).toEqual({
      de: '2026-12-30',
      ate: '2027-01-02',
    });
  });

  it('nada a fazer quando ontem já está gravado', () => {
    expect(intervaloParaConsolidar(d('2026-01-01'), d('2026-11-23'), d('2026-11-24'))).toBeNull();
  });

  it('ajuste no passado recalcula do início dele até ontem; ajuste no futuro não mexe', () => {
    expect(intervaloParaRecalcular(d('2026-11-01'), d('2026-01-01'), d('2026-11-24'))).toEqual({
      de: '2026-11-01',
      ate: '2026-11-23',
    });
    expect(intervaloParaRecalcular(d('2025-06-01'), d('2026-01-01'), d('2026-11-24'))?.de).toBe('2026-01-01');
    expect(intervaloParaRecalcular(d('2026-12-01'), d('2026-01-01'), d('2026-11-24'))).toBeNull();
  });
});

describe('o passado não muda quando a escala muda', () => {
  const hoje = d('2027-02-10');
  const original = escala('2027-01-04');
  const banco = new Map<DiaISO, DiaRealizado>();
  const intervalo = intervaloParaConsolidar(d('2027-01-01'), undefined, hoje)!;
  gravar(banco, congelar(original, intervalo.de, intervalo.ate, AGORA));

  it('grava os dias até ontem', () => {
    expect(banco.size).toBe(40); // 01/01 a 09/02
    expect(banco.get(d('2027-01-31'))).toMatchObject({ aBordo: true, marcos: ['desembarque'] });
  });

  it('trocar a âncora muda o futuro, mas não o passado', () => {
    const nova = escala('2027-01-20'); // a escala "andou" 16 dias
    const mostrados = mesclarComHistorico(projetarEscala(nova, d('2027-01-01'), d('2027-03-31')), banco, hoje);
    const dia = (s: string) => mostrados.find((x) => x.data === s)!;
    // passado = como foi gravado
    expect(dia('2027-01-05')).toMatchObject({ aBordo: true, realizado: true });
    expect(dia('2027-02-05')).toMatchObject({ aBordo: false, realizado: true });
    // hoje e futuro = nova projeção (pela nova âncora, 10/02 está a bordo)
    expect(dia('2027-02-10')).toMatchObject({ aBordo: true });
    expect(dia('2027-02-10').realizado).toBeUndefined();
    expect(dia('2027-02-16').marcos).toEqual(['desembarque']);
  });

  it('dias sem histórico (antes do início) continuam projetados', () => {
    const mostrados = mesclarComHistorico(projetarEscala(original, d('2026-12-30'), d('2027-01-02')), banco, hoje);
    expect(mostrados.map((x) => Boolean(x.realizado))).toEqual([false, false, true, true]);
  });
});

describe('dobra registrada depois que aconteceu', () => {
  it('recalcula o histórico a partir do início do ajuste', () => {
    const hoje = d('2027-02-10');
    const banco = new Map<DiaISO, DiaRealizado>();
    gravar(banco, congelar(escala('2027-01-04'), d('2027-01-01'), d('2027-02-09'), AGORA));
    expect(banco.get(d('2027-02-03'))?.aBordo).toBe(false);

    // o usuário lembra: dobrou 7 dias (01/02 a 07/02)
    const dobra: Ajuste = {
      tipo: 'dobra',
      inicio: d('2027-02-01'),
      fim: d('2027-02-07'),
      observacao: 'Rendição atrasou',
      aposAjuste: 'retomar_ciclo',
    };
    const comDobra = escala('2027-01-04', {}, [dobra]);
    expect(inicioDoRecalculo([escala('2027-01-04'), comDobra], dobra.inicio)).toBe('2027-01-04');
    gravar(
      banco,
      recalcularHistorico({
        antes: escala('2027-01-04'),
        depois: comDobra,
        faixas: [dobra],
        realizados: banco,
        inicioHistorico: d('2027-01-01'),
        hoje,
        agora: AGORA,
      }),
    );

    expect(banco.get(d('2027-02-03'))).toMatchObject({
      aBordo: true,
      ajuste: { tipo: 'dobra' },
      periodo: { dia: 31, total: 35 },
    });
    expect(banco.get(d('2027-01-31'))?.marcos).toEqual([]); // não é mais o desembarque
    expect(banco.get(d('2027-02-07'))?.marcos).toEqual(['desembarque']);
    expect(banco.get(d('2027-01-20'))?.periodo.total).toBe(35); // mesmo período, agora com 35 dias
  });
});

describe('início do recálculo', () => {
  it('ajuste no meio da folga começa no início da folga', () => {
    const curso: Ajuste = { tipo: 'curso', inicio: d('2027-02-10'), fim: d('2027-02-12'), observacao: '', aposAjuste: 'retomar_ciclo' };
    expect(inicioDoRecalculo([escala('2027-01-04'), escala('2027-01-04', {}, [curso])], curso.inicio)).toBe('2027-02-01');
  });
});

describe('ajuste no passado depois de mudar a escala', () => {
  it('só os dias do ajuste mudam; o resto do histórico fica como foi', () => {
    const hoje = d('2026-11-24');
    const banco = new Map<DiaISO, DiaRealizado>();
    // histórico gravado com a âncora antiga (13/11)
    gravar(banco, congelar(escala('2026-11-13'), d('2026-11-01'), d('2026-11-23'), AGORA));
    expect(banco.get(d('2026-11-10'))?.aBordo).toBe(false);

    // o usuário muda a âncora para 01/11 e depois registra um curso em 03–05/11
    const curso: Ajuste = { tipo: 'curso', inicio: d('2026-11-03'), fim: d('2026-11-05'), observacao: '', aposAjuste: 'retomar_ciclo' };
    const antes = escala('2026-11-01');
    const depois = escala('2026-11-01', {}, [curso]);
    const mudados = recalcularHistorico({
      antes,
      depois,
      faixas: [curso],
      realizados: banco,
      inicioHistorico: d('2026-01-01'),
      hoje,
      agora: AGORA,
    });
    gravar(banco, mudados);

    expect(mudados.every((x) => x.data >= '2026-11-01' && x.data <= '2026-11-23')).toBe(true);
    expect(banco.get(d('2026-11-04'))?.categoria).toBe('curso');
    expect(banco.get(d('2026-11-10'))?.aBordo).toBe(false); // continua como foi
    expect(banco.get(d('2026-11-15'))?.aBordo).toBe(true); // continua como foi
  });
});

describe('excluir um ajuste do passado', () => {
  it('os dias voltam ao que a escala diz, e o desembarque volta para o lugar', () => {
    const hoje = d('2027-02-10');
    const dobra: Ajuste = { id: 1, tipo: 'dobra', inicio: d('2027-02-01'), fim: d('2027-02-07'), observacao: '', aposAjuste: 'retomar_ciclo' };
    const comDobra = escala('2027-01-04', {}, [dobra]);
    const banco = new Map<DiaISO, DiaRealizado>();
    gravar(banco, congelar(comDobra, d('2027-01-01'), d('2027-02-09'), AGORA));
    expect(banco.get(d('2027-02-07'))?.marcos).toEqual(['desembarque']);

    gravar(
      banco,
      recalcularHistorico({
        antes: comDobra,
        depois: escala('2027-01-04'),
        faixas: [dobra],
        realizados: banco,
        inicioHistorico: d('2027-01-01'),
        hoje,
        agora: AGORA,
      }),
    );
    expect(banco.get(d('2027-02-03'))?.aBordo).toBe(false);
    expect(banco.get(d('2027-02-03'))?.ajuste).toBeUndefined();
    expect(banco.get(d('2027-01-31'))?.marcos).toEqual(['desembarque']);
    expect(banco.get(d('2027-01-20'))?.periodo.total).toBe(28);
  });
});
