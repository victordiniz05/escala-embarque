import { describe, expect, it } from 'vitest';
import type { Ajuste } from '../ajustes';
import { diaISO, diferencaDias } from '../datas';
import { diaDaEscala, projetarEscala, proximosPeriodos, type EntradaEscala } from '../escala';
import { verificarEvento } from '../eventos';
import { preverAjuste } from '../previa';
import { calcularStatus, tituloStatus } from '../status';
import type { ParametrosEscala } from '../tipos';

const d = (s: string) => diaISO(s);

/*
 * Escala base 28x28 com embarque em 04/01/2027:
 *   a bordo 04/01–31/01 · folga 01/02–28/02 · embarque 01/03
 *   a bordo 01/03–28/03 · folga 29/03–25/04 · embarque 26/04
 */
function base(ajustes: Ajuste[] = [], extra: Partial<ParametrosEscala> = {}): EntradaEscala {
  return {
    parametros: {
      regime: { embarcado: 28, folga: 28 },
      regraDesembarque: 'conta_embarcado',
      diasViagemAntes: 0,
      diasViagemDepois: 0,
      ...extra,
    },
    ancoras: [{ dataEmbarque: d('2027-01-04'), vigenteDesde: d('2027-01-04') }],
    ajustes,
  };
}

function ajuste(tipo: Ajuste['tipo'], inicio: string, fim: string, extra: Partial<Ajuste> = {}): Ajuste {
  return { tipo, inicio: d(inicio), fim: d(fim), observacao: '', aposAjuste: 'retomar_ciclo', ...extra };
}

const periodos = (e: EntradaEscala, de: string, n = 3) =>
  proximosPeriodos(e, d(de), n).map((p) => [p.embarque, p.desembarque, p.dias]);

describe('dobra', () => {
  it('voltando ao ciclo original: período de 42 dias, folga encurta, próximo embarque não muda', () => {
    const e = base([ajuste('dobra', '2027-02-01', '2027-02-14')]);
    expect(periodos(e, '2027-01-10')).toEqual([
      ['2027-01-04', '2027-02-14', 42],
      ['2027-03-01', '2027-03-28', 28],
      ['2027-04-26', '2027-05-23', 28],
    ]);
    expect(diaDaEscala(e, d('2027-02-10'))).toMatchObject({
      aBordo: true,
      periodo: { dia: 38, total: 42 },
      ajuste: { tipo: 'dobra' },
    });
    expect(diaDaEscala(e, d('2027-02-15'))).toMatchObject({ aBordo: false, periodo: { dia: 1, total: 14 } });
  });

  it('seguida de re-ancoragem: desembarque no fim da dobra e folga completa depois', () => {
    const e = base([ajuste('dobra', '2027-02-01', '2027-02-14', { aposAjuste: 'reancorar' })]);
    expect(periodos(e, '2027-01-10', 4)).toEqual([
      ['2027-01-04', '2027-02-14', 42],
      ['2027-03-15', '2027-04-11', 28],
      ['2027-05-10', '2027-06-06', 28],
      ['2027-07-05', '2027-08-01', 28],
    ]);
    expect(diaDaEscala(e, d('2027-02-15'))).toMatchObject({ aBordo: false, periodo: { dia: 1, total: 28 } });
    // o ciclo segue regular depois da re-ancoragem, atravessando anos
    const embarques = projetarEscala(e, d('2027-03-01'), d('2030-12-31'))
      .filter((x) => x.marcos.includes('embarque'))
      .map((x) => x.data);
    for (let i = 1; i < embarques.length; i++) expect(diferencaDias(embarques[i - 1]!, embarques[i]!)).toBe(56);
  });

  it('re-ancorada com desembarque no dia da troca (29º dia) e viagem', () => {
    const e = base([ajuste('dobra', '2027-02-01', '2027-02-14', { aposAjuste: 'reancorar' })], {
      regraDesembarque: 'conta_folga',
      diasViagemDepois: 1,
    });
    expect(diaDaEscala(e, d('2027-02-14'))).toMatchObject({ aBordo: true, marcos: [] });
    expect(diaDaEscala(e, d('2027-02-15'))).toMatchObject({
      aBordo: false,
      categoria: 'viagem',
      marcos: ['desembarque'],
      periodo: { dia: 1, total: 28 },
    });
    expect(diaDaEscala(e, d('2027-03-15')).marcos).toEqual(['embarque']);
  });

  it('a viagem acompanha o novo desembarque', () => {
    const e = base([ajuste('dobra', '2027-02-01', '2027-02-07')], { diasViagemDepois: 1 });
    expect(diaDaEscala(e, d('2027-02-01')).categoria).toBe('embarcado'); // era viagem
    expect(diaDaEscala(e, d('2027-02-07')).marcos).toEqual(['desembarque']);
    expect(diaDaEscala(e, d('2027-02-08')).categoria).toBe('viagem');
  });
});

describe('antecipação e atraso de embarque', () => {
  it('antecipação de 3 dias voltando ao ciclo: período de 31 dias', () => {
    const e = base([ajuste('antecipacao', '2027-02-26', '2027-02-28')]);
    expect(periodos(e, '2027-02-20', 2)).toEqual([
      ['2027-02-26', '2027-03-28', 31],
      ['2027-04-26', '2027-05-23', 28],
    ]);
  });

  it('antecipação re-ancorada: 28 dias a partir do novo embarque', () => {
    const e = base([ajuste('antecipacao', '2027-02-26', '2027-02-28', { aposAjuste: 'reancorar' })]);
    expect(periodos(e, '2027-02-20', 2)).toEqual([
      ['2027-02-26', '2027-03-25', 28],
      ['2027-04-23', '2027-05-20', 28],
    ]);
  });

  it('atraso de 2 dias voltando ao ciclo: período de 26 dias', () => {
    const e = base([ajuste('atraso', '2027-03-01', '2027-03-02')]);
    expect(periodos(e, '2027-02-20', 2)).toEqual([
      ['2027-03-03', '2027-03-28', 26],
      ['2027-04-26', '2027-05-23', 28],
    ]);
  });

  it('atraso re-ancorado: embarca no dia seguinte e cumpre 28 dias', () => {
    const e = base([ajuste('atraso', '2027-03-01', '2027-03-02', { aposAjuste: 'reancorar' })]);
    expect(periodos(e, '2027-02-20', 2)).toEqual([
      ['2027-03-03', '2027-03-30', 28],
      ['2027-04-28', '2027-05-25', 28],
    ]);
  });
});

describe('troca com colega', () => {
  it('embarcando na folga: vira um período curto a bordo', () => {
    const e = base([ajuste('troca', '2027-02-10', '2027-02-12', { estadoTroca: 'embarcado', colega: 'João' })]);
    expect(diaDaEscala(e, d('2027-02-10'))).toMatchObject({ aBordo: true, marcos: ['embarque'], periodo: { total: 3 } });
    expect(diaDaEscala(e, d('2027-02-12')).marcos).toEqual(['desembarque']);
  });

  it('folgando no embarque: o período a bordo se divide', () => {
    const e = base([ajuste('troca', '2027-01-20', '2027-01-22', { estadoTroca: 'folga' })]);
    expect(diaDaEscala(e, d('2027-01-19'))).toMatchObject({ aBordo: true, marcos: ['desembarque'], periodo: { total: 16 } });
    expect(diaDaEscala(e, d('2027-01-21'))).toMatchObject({ aBordo: false, ajuste: { tipo: 'troca' } });
    expect(diaDaEscala(e, d('2027-01-23'))).toMatchObject({ aBordo: true, marcos: ['embarque'], periodo: { total: 9 } });
  });
});

describe('curso, afastamento e férias', () => {
  it('curso na folga tem cor própria e não conta como a bordo', () => {
    const e = base([ajuste('curso', '2027-02-16', '2027-02-18')]);
    expect(diaDaEscala(e, d('2027-02-17'))).toMatchObject({
      aBordo: false,
      categoria: 'curso',
      periodo: { total: 28 },
    });
    expect(diaDaEscala(e, d('2027-02-15')).categoria).toBe('folga');
  });

  it('afastamento no meio do embarque interrompe o período', () => {
    const e = base([ajuste('afastamento', '2027-01-15', '2027-01-31')]);
    expect(diaDaEscala(e, d('2027-01-14'))).toMatchObject({ marcos: ['desembarque'], periodo: { total: 11 } });
    expect(diaDaEscala(e, d('2027-01-20')).categoria).toBe('afastamento');
  });

  it('o ajuste mais recente vence quando se sobrepõem', () => {
    const e = base([ajuste('ferias', '2027-02-10', '2027-02-20'), ajuste('curso', '2027-02-15', '2027-02-16')]);
    expect(diaDaEscala(e, d('2027-02-14')).categoria).toBe('ferias');
    expect(diaDaEscala(e, d('2027-02-15')).categoria).toBe('curso');
  });
});

describe('efeito nas outras telas', () => {
  it('status mostra a dobra: dia 38 de 42', () => {
    const e = base([ajuste('dobra', '2027-02-01', '2027-02-14')]);
    expect(tituloStatus(calcularStatus(e, d('2027-02-10'))).titulo).toBe('EMBARCADO – dia 38 de 42');
  });

  it('status em férias', () => {
    const e = base([ajuste('ferias', '2027-02-01', '2027-02-28')]);
    expect(tituloStatus(calcularStatus(e, d('2027-02-10'))).titulo).toBe('DE FÉRIAS – faltam 19 dias para embarcar');
  });

  it('evento num dia de curso pede atenção', () => {
    const e = base([ajuste('curso', '2027-02-16', '2027-02-18')]);
    const r = verificarEvento(e, { nome: 'X', inicio: d('2027-02-17') }, d('2026-11-24'));
    expect(r).toMatchObject({ disponibilidade: 'atencao', alertas: ['em_curso'] });
  });

  it('evento que caía na folga passa a cair na dobra', () => {
    const evento = { nome: 'ETAPA', inicio: d('2027-02-10') };
    expect(verificarEvento(base(), evento, d('2026-11-24')).disponibilidade).toBe('livre');
    const comDobra = base([ajuste('dobra', '2027-02-01', '2027-02-14')]);
    expect(verificarEvento(comDobra, evento, d('2026-11-24')).disponibilidade).toBe('embarcado');
  });
});

describe('prévia', () => {
  it('dobra re-ancorada: mostra o antes e o depois dos próximos embarques', () => {
    const p = preverAjuste(base(), ajuste('dobra', '2027-02-01', '2027-02-14', { aposAjuste: 'reancorar' }));
    expect(p.periodosAntes.map((x) => [x.embarque, x.desembarque])).toEqual([
      ['2027-01-04', '2027-01-31'],
      ['2027-03-01', '2027-03-28'],
      ['2027-04-26', '2027-05-23'],
    ]);
    expect(p.periodosDepois.map((x) => [x.embarque, x.desembarque])).toEqual([
      ['2027-01-04', '2027-02-14'],
      ['2027-03-15', '2027-04-11'],
      ['2027-05-10', '2027-06-06'],
    ]);
    expect(p.diasAlterados).toContain('2027-02-01');
    expect(p.diasAlterados).toContain('2027-03-01');
    expect(p.diasAlterados).not.toContain('2027-01-20');
  });

  it('editar um ajuste existente substitui o antigo na prévia', () => {
    const antigo = { ...ajuste('dobra', '2027-02-01', '2027-02-14'), id: 7 };
    const novo = { ...ajuste('dobra', '2027-02-01', '2027-02-07'), id: 7 };
    const p = preverAjuste(base([antigo]), novo);
    expect(p.periodosDepois[0]).toMatchObject({ desembarque: '2027-02-07', dias: 35 });
    expect(p.entradaDepois.ajustes).toHaveLength(1);
  });

  it('ajuste que não muda nada não tem dias alterados', () => {
    const p = preverAjuste(base(), ajuste('dobra', '2027-01-10', '2027-01-12'));
    expect(p.diasAlterados).toEqual([]);
  });
});
