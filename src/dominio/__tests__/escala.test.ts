import { describe, expect, it } from 'vitest';
import { diaISO, diferencaDias, somarDias } from '../datas';
import { diaDaEscala, projetarEscala, proximosPeriodos, type EntradaEscala } from '../escala';
import { REGIMES_PADRAO, nomeRegime, validarParametros } from '../regimes';
import type { ParametrosEscala, RegraDesembarque, Regime } from '../tipos';

const d = (s: string) => diaISO(s);

function entrada(
  regime: Regime,
  embarque: string,
  extra: Partial<ParametrosEscala> = {},
): EntradaEscala {
  return {
    parametros: {
      regime,
      regraDesembarque: 'conta_embarcado',
      diasViagemAntes: 0,
      diasViagemDepois: 0,
      ...extra,
    },
    ancoras: [{ dataEmbarque: d(embarque), vigenteDesde: d(embarque) }],
  };
}

function datasCom(e: EntradaEscala, inicio: string, fim: string, marco: 'embarque' | 'desembarque') {
  return projetarEscala(e, d(inicio), d(fim))
    .filter((x) => x.marcos.includes(marco))
    .map((x) => x.data);
}

describe('regimes padrão', () => {
  for (const regime of REGIMES_PADRAO) {
    const n = regime.embarcado;
    it(`${nomeRegime(regime)}: ${n} dias a bordo, ${n} de folga, ciclo de ${2 * n} dias`, () => {
      const e = entrada(regime, '2026-01-05');
      const dias = projetarEscala(e, d('2026-01-05'), somarDias(d('2026-01-05'), 2 * n - 1));
      expect(dias.filter((x) => x.aBordo)).toHaveLength(n);
      expect(dias.filter((x) => !x.aBordo)).toHaveLength(n);
      expect(dias[0]!.marcos).toContain('embarque');
      expect(dias[n - 1]!.marcos).toContain('desembarque');
      expect(dias[n - 1]!.aBordo).toBe(true);
      expect(dias[n]!.aBordo).toBe(false);

      // 10 ciclos seguidos sempre espaçados de 2n dias
      const embarques = datasCom(e, '2026-01-05', '2029-12-31', 'embarque');
      for (let i = 1; i < embarques.length; i++) {
        expect(diferencaDias(embarques[i - 1]!, embarques[i]!)).toBe(2 * n);
      }
    });
  }

  it('28x28 com embarque em 01/01/2026', () => {
    const e = entrada({ embarcado: 28, folga: 28 }, '2026-01-01');
    expect(datasCom(e, '2026-01-01', '2026-06-30', 'embarque')).toEqual([
      '2026-01-01',
      '2026-02-26',
      '2026-04-23',
      '2026-06-18',
    ]);
    expect(datasCom(e, '2026-01-01', '2026-03-31', 'desembarque')).toEqual([
      '2026-01-28',
      '2026-03-25',
    ]);
  });
});

describe('regime assimétrico', () => {
  it('28x14: 28 a bordo, 14 de folga, ciclo de 42 dias', () => {
    const e = entrada({ embarcado: 28, folga: 14 }, '2026-01-01');
    expect(diaDaEscala(e, d('2026-01-28'))).toMatchObject({
      aBordo: true,
      marcos: ['desembarque'],
      periodo: { dia: 28, total: 28 },
    });
    expect(diaDaEscala(e, d('2026-01-29'))).toMatchObject({
      aBordo: false,
      periodo: { dia: 1, total: 14, fim: '2026-02-11' },
    });
    expect(datasCom(e, '2026-01-01', '2026-04-30', 'embarque')).toEqual([
      '2026-01-01',
      '2026-02-12',
      '2026-03-26',
    ]);
  });

  it('14x21: folga maior que o embarque', () => {
    const e = entrada({ embarcado: 14, folga: 21 }, '2026-05-04');
    expect(datasCom(e, '2026-05-04', '2026-07-31', 'embarque')).toEqual([
      '2026-05-04',
      '2026-06-08',
      '2026-07-13',
    ]);
  });
});

describe('ano bissexto', () => {
  it('14x14 a partir de 15/02/2028 passa pelo 29/02', () => {
    const e = entrada({ embarcado: 14, folga: 14 }, '2028-02-15');
    expect(diaDaEscala(e, d('2028-02-28'))).toMatchObject({ aBordo: true, marcos: ['desembarque'] });
    expect(diaDaEscala(e, d('2028-02-29'))).toMatchObject({ aBordo: false, periodo: { dia: 1 } });
    expect(datasCom(e, '2028-02-16', '2028-03-31', 'embarque')).toEqual(['2028-03-14']);
  });

  it('o mesmo regime em 2027 (não bissexto) cai um dia depois em março', () => {
    const e = entrada({ embarcado: 14, folga: 14 }, '2027-02-15');
    expect(datasCom(e, '2027-02-16', '2027-03-31', 'embarque')).toEqual(['2027-03-15']);
  });

  it('2028 tem 366 dias projetados e a contagem fecha', () => {
    const e = entrada({ embarcado: 28, folga: 28 }, '2027-12-20');
    const ano = projetarEscala(e, d('2028-01-01'), d('2028-12-31'));
    expect(ano).toHaveLength(366);
    const aBordo = ano.filter((x) => x.aBordo).length;
    expect(aBordo + ano.filter((x) => !x.aBordo).length).toBe(366);
  });
});

describe('virada de ano', () => {
  const e = entrada({ embarcado: 28, folga: 28 }, '2026-12-10');

  it('o período a bordo atravessa o réveillon sem quebrar', () => {
    expect(diaDaEscala(e, d('2026-12-31'))).toMatchObject({
      aBordo: true,
      periodo: { dia: 22, total: 28, inicio: '2026-12-10', fim: '2027-01-06' },
    });
    expect(diaDaEscala(e, d('2027-01-01'))).toMatchObject({ aBordo: true, periodo: { dia: 23 } });
    expect(diaDaEscala(e, d('2027-01-06')).marcos).toEqual(['desembarque']);
    expect(diaDaEscala(e, d('2027-01-07'))).toMatchObject({ aBordo: false, periodo: { dia: 1, total: 28 } });
    expect(datasCom(e, '2026-12-11', '2027-03-31', 'embarque')).toEqual(['2027-02-04']);
  });

  it('projeta pelo menos 3 anos contínuos sem buracos', () => {
    const dias = projetarEscala(e, d('2026-11-24'), d('2029-12-31'));
    expect(dias).toHaveLength(diferencaDias(d('2026-11-24'), d('2029-12-31')) + 1);
    for (let i = 1; i < dias.length; i++) {
      expect(diferencaDias(dias[i - 1]!.data, dias[i]!.data)).toBe(1);
    }
    const embarques = dias.filter((x) => x.marcos.includes('embarque'));
    for (let i = 1; i < embarques.length; i++) {
      expect(diferencaDias(embarques[i - 1]!.data, embarques[i]!.data)).toBe(56);
    }
    // todo período a bordo tem exatamente 28 dias (exceto os cortados nas pontas)
    for (const x of dias.filter((y) => y.aBordo)) expect(x.periodo.total).toBe(28);
  });

  it('dias antes da âncora seguem o ciclo para trás', () => {
    expect(diaDaEscala(e, d('2026-10-15')).marcos).toEqual(['embarque']);
    expect(diaDaEscala(e, d('2026-12-09'))).toMatchObject({ aBordo: false, periodo: { dia: 28, total: 28 } });
  });
});

describe('regra de contagem do dia de desembarque', () => {
  const regime = { embarcado: 14, folga: 14 };
  const com = (regra: RegraDesembarque) =>
    entrada(regime, '2026-03-02', { regraDesembarque: regra });

  it('conta_embarcado (padrão): desembarque é o 14º dia a bordo', () => {
    const e = com('conta_embarcado');
    expect(diaDaEscala(e, d('2026-03-15'))).toMatchObject({
      aBordo: true,
      marcos: ['desembarque'],
      periodo: { dia: 14, total: 14 },
    });
    expect(diaDaEscala(e, d('2026-03-16'))).toMatchObject({ aBordo: false, marcos: [], periodo: { dia: 1 } });
  });

  it('conta_folga: desembarque no dia seguinte, já como 1º dia de folga', () => {
    const e = com('conta_folga');
    expect(diaDaEscala(e, d('2026-03-15'))).toMatchObject({ aBordo: true, marcos: [], periodo: { dia: 14 } });
    expect(diaDaEscala(e, d('2026-03-16'))).toMatchObject({
      aBordo: false,
      categoria: 'folga',
      marcos: ['desembarque'],
      periodo: { dia: 1, total: 14 },
    });
  });

  it('nas duas regras o próximo embarque é o mesmo (o ciclo não escorrega)', () => {
    const a = datasCom(com('conta_embarcado'), '2026-03-03', '2027-03-31', 'embarque');
    const b = datasCom(com('conta_folga'), '2026-03-03', '2027-03-31', 'embarque');
    expect(a).toEqual(b);
    expect(a[0]).toBe('2026-03-30');
  });
});

describe('dias de viagem', () => {
  it('pinta os dias de folga antes do embarque e depois do desembarque', () => {
    const e = entrada({ embarcado: 14, folga: 14 }, '2026-03-02', {
      diasViagemAntes: 1,
      diasViagemDepois: 2,
    });
    const cat = (s: string) => diaDaEscala(e, d(s)).categoria;
    expect(cat('2026-03-01')).toBe('viagem'); // véspera do embarque
    expect(cat('2026-03-02')).toBe('embarcado');
    expect(cat('2026-03-15')).toBe('embarcado'); // desembarque
    expect(cat('2026-03-16')).toBe('viagem');
    expect(cat('2026-03-17')).toBe('viagem');
    expect(cat('2026-03-18')).toBe('folga');
    expect(cat('2026-03-29')).toBe('viagem');
    // viagem não muda a contagem de dias a bordo
    expect(diaDaEscala(e, d('2026-03-16')).aBordo).toBe(false);
  });

  it('com conta_folga, o próprio dia do desembarque é o 1º dia de viagem', () => {
    const e = entrada({ embarcado: 14, folga: 14 }, '2026-03-02', {
      regraDesembarque: 'conta_folga',
      diasViagemDepois: 1,
    });
    expect(diaDaEscala(e, d('2026-03-16'))).toMatchObject({ categoria: 'viagem', marcos: ['desembarque'] });
    expect(diaDaEscala(e, d('2026-03-17')).categoria).toBe('folga');
  });
});

describe('28x28 com dia da troca no 29º dia', () => {
  it('29º dia é desembarque e viagem, conta como folga; próximo embarque no 57º dia', () => {
    const e = entrada({ embarcado: 28, folga: 28 }, '2027-01-04', {
      regraDesembarque: 'conta_folga',
      diasViagemDepois: 1,
    });
    expect(diaDaEscala(e, d('2027-01-31'))).toMatchObject({ aBordo: true, periodo: { dia: 28, total: 28 }, marcos: [] });
    expect(diaDaEscala(e, d('2027-02-01'))).toMatchObject({
      aBordo: false,
      categoria: 'viagem',
      marcos: ['desembarque'],
      periodo: { dia: 1, total: 28 },
    });
    expect(diaDaEscala(e, d('2027-02-02')).categoria).toBe('folga');
    expect(datasCom(e, '2027-01-05', '2027-04-30', 'embarque')).toEqual(['2027-03-01', '2027-04-26']);
  });
});

describe('várias âncoras', () => {
  it('a âncora mais recente passa a valer a partir de vigenteDesde', () => {
    const e: EntradaEscala = {
      ...entrada({ embarcado: 14, folga: 14 }, '2026-01-05'),
      ancoras: [
        { dataEmbarque: d('2026-01-05'), vigenteDesde: d('2026-01-05') },
        { dataEmbarque: d('2026-02-09'), vigenteDesde: d('2026-01-26') },
      ],
    };
    const embarques = datasCom(e, '2026-01-01', '2026-03-31', 'embarque');
    expect(embarques).toEqual(['2026-01-05', '2026-02-09', '2026-03-09']);
  });
});

describe('validação', () => {
  const base: ParametrosEscala = {
    regime: { embarcado: 14, folga: 14 },
    regraDesembarque: 'conta_embarcado',
    diasViagemAntes: 0,
    diasViagemDepois: 0,
  };
  it('aceita parâmetros válidos', () => expect(validarParametros(base)).toEqual([]));
  it('rejeita zero, frações e viagem maior que a folga', () => {
    expect(validarParametros({ ...base, regime: { embarcado: 0, folga: 14 } })).toHaveLength(1);
    expect(validarParametros({ ...base, regime: { embarcado: 14, folga: 1.5 } })).toHaveLength(1);
    expect(validarParametros({ ...base, diasViagemAntes: 10, diasViagemDepois: 5 })).toHaveLength(1);
  });
});

describe('próximos períodos', () => {
  it('lista o período atual e os seguintes, com a data de desembarque pela regra', () => {
    const e = entrada({ embarcado: 14, folga: 14 }, '2026-03-02', { regraDesembarque: 'conta_folga' });
    expect(proximosPeriodos(e, d('2026-03-10'), 3)).toEqual([
      { embarque: '2026-03-02', ultimoDiaABordo: '2026-03-15', desembarque: '2026-03-16', dias: 14 },
      { embarque: '2026-03-30', ultimoDiaABordo: '2026-04-12', desembarque: '2026-04-13', dias: 14 },
      { embarque: '2026-04-27', ultimoDiaABordo: '2026-05-10', desembarque: '2026-05-11', dias: 14 },
    ]);
  });

  it('de folga, começa pelo próximo embarque', () => {
    const e = entrada({ embarcado: 28, folga: 28 }, '2026-12-03');
    expect(proximosPeriodos(e, d('2026-11-24'), 1)[0]).toMatchObject({
      embarque: '2026-12-03',
      desembarque: '2026-12-30',
    });
  });
});
