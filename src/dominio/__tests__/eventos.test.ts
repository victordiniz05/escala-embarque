import { describe, expect, it } from 'vitest';
import { diaISO } from '../datas';
import type { EntradaEscala } from '../escala';
import { verificarEvento } from '../eventos';
import type { ParametrosEscala } from '../tipos';

const d = (s: string) => diaISO(s);
const HOJE = d('2026-11-24');

function entrada(embarque: string, extra: Partial<ParametrosEscala> = {}): EntradaEscala {
  return {
    parametros: {
      regime: { embarcado: 14, folga: 14 },
      regraDesembarque: 'conta_embarcado',
      diasViagemAntes: 0,
      diasViagemDepois: 0,
      ...extra,
    },
    ancoras: [{ dataEmbarque: d(embarque), vigenteDesde: d(embarque) }],
  };
}

// 14x14 embarcando em 03/05/2027: a bordo 03/05–16/05, folga 17/05–30/05, embarque 31/05.
const escala = entrada('2027-05-03');

describe('evento: vou estar embarcado?', () => {
  it('ETAPA SP em 16/05/2027 cai no último dia a bordo (desembarque)', () => {
    const r = verificarEvento(escala, { nome: 'ETAPA SP', inicio: d('2027-05-16') }, HOJE);
    expect(r).toMatchObject({
      disponibilidade: 'embarcado',
      diasABordo: 1,
      totalDias: 1,
      desembarque: '2027-05-16',
      alertas: ['dia_do_desembarque'],
      primeiroDia: { periodo: { dia: 14, total: 14 } },
    });
    expect(r.diasAte).toBe(173);
  });

  it('no meio do embarque: embarcado, com a data do desembarque', () => {
    const r = verificarEvento(escala, { nome: 'Casamento', inicio: d('2027-05-08') }, HOJE);
    expect(r).toMatchObject({ disponibilidade: 'embarcado', desembarque: '2027-05-16', alertas: [] });
  });

  it('no meio da folga: livre, com o próximo embarque', () => {
    const r = verificarEvento(escala, { nome: 'Show', inicio: d('2027-05-22') }, HOJE);
    expect(r).toMatchObject({
      disponibilidade: 'livre',
      alertas: [],
      proximoEmbarque: '2027-05-31',
      primeiroDia: { periodo: { dia: 6, total: 14 } },
    });
    expect(r.desembarque).toBeUndefined();
  });

  it('véspera do embarque: de folga, mas com atenção', () => {
    const r = verificarEvento(escala, { nome: 'Festa', inicio: d('2027-05-30') }, HOJE);
    expect(r).toMatchObject({ disponibilidade: 'atencao', alertas: ['embarca_no_dia_seguinte'] });
  });

  it('dia de viagem: de folga, mas com atenção', () => {
    const r = verificarEvento(entrada('2027-05-03', { diasViagemAntes: 1 }), { nome: 'X', inicio: d('2027-05-30') }, HOJE);
    expect(r.disponibilidade).toBe('atencao');
    expect(r.alertas).toContain('dia_de_viagem');
  });

  it('com conta_folga, o dia do desembarque já é folga, mas avisa', () => {
    const r = verificarEvento(
      entrada('2027-05-03', { regraDesembarque: 'conta_folga' }),
      { nome: 'X', inicio: d('2027-05-17') },
      HOJE,
    );
    expect(r).toMatchObject({ disponibilidade: 'atencao', alertas: ['dia_do_desembarque'], diasABordo: 0 });
  });

  it('evento de vários dias pegando o fim do embarque: parcial', () => {
    const r = verificarEvento(escala, { nome: 'Viagem', inicio: d('2027-05-14'), fim: d('2027-05-20') }, HOJE);
    expect(r).toMatchObject({ disponibilidade: 'parcial', diasABordo: 3, totalDias: 7 });
  });

  it('evento de vários dias todo na folga: livre', () => {
    const r = verificarEvento(escala, { nome: 'Férias', inicio: d('2027-05-18'), fim: d('2027-05-28') }, HOJE);
    expect(r).toMatchObject({ disponibilidade: 'livre', totalDias: 11, proximoEmbarque: '2027-05-31' });
  });

  it('data final antes da inicial é tratada como evento de um dia', () => {
    const r = verificarEvento(escala, { nome: 'X', inicio: d('2027-05-22'), fim: d('2027-05-01') }, HOJE);
    expect(r.totalDias).toBe(1);
  });

  it('evento no passado tem diasAte negativo', () => {
    expect(verificarEvento(escala, { nome: 'X', inicio: d('2026-11-20') }, HOJE).diasAte).toBe(-4);
  });

  it('evento anos à frente, atravessando a virada do ano', () => {
    const r = verificarEvento(escala, { nome: 'Réveillon', inicio: d('2029-12-31'), fim: d('2030-01-01') }, HOJE);
    // 973 dias depois da âncora → posição 21 do ciclo de 28 → 8º dia de folga
    expect(r).toMatchObject({
      disponibilidade: 'livre',
      totalDias: 2,
      primeiroDia: { periodo: { dia: 8, total: 14 } },
      proximoEmbarque: '2030-01-07',
    });
  });
});
