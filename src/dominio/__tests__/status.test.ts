import { describe, expect, it } from 'vitest';
import { diaISO } from '../datas';
import type { EntradaEscala } from '../escala';
import { calcularStatus, tituloStatus } from '../status';
import type { ParametrosEscala } from '../tipos';

const d = (s: string) => diaISO(s);

function entrada(embarque: string, extra: Partial<ParametrosEscala> = {}): EntradaEscala {
  return {
    parametros: {
      regime: { embarcado: 28, folga: 28 },
      regraDesembarque: 'conta_embarcado',
      diasViagemAntes: 0,
      diasViagemDepois: 0,
      ...extra,
    },
    ancoras: [{ dataEmbarque: d(embarque), vigenteDesde: d(embarque) }],
  };
}

describe('status da tela Início', () => {
  it('EMBARCADO – dia 12 de 28', () => {
    const s = calcularStatus(entrada('2026-11-13'), d('2026-11-24'));
    expect(s).toMatchObject({
      situacao: 'embarcado',
      diaDoPeriodo: 12,
      totalDoPeriodo: 28,
      diasRestantes: 16,
      proximaTroca: { data: '2026-12-10', tipo: 'desembarque' },
    });
    expect(s.progresso).toBeCloseTo(12 / 28);
    expect(tituloStatus(s).titulo).toBe('EMBARCADO – dia 12 de 28');
  });

  it('DE FOLGA – faltam 9 dias para embarcar', () => {
    const s = calcularStatus(entrada('2026-12-03'), d('2026-11-24'));
    expect(s).toMatchObject({
      situacao: 'folga',
      diasRestantes: 9,
      diaDoPeriodo: 20,
      proximaTroca: { data: '2026-12-03', tipo: 'embarque' },
    });
    expect(tituloStatus(s).titulo).toBe('DE FOLGA – faltam 9 dias para embarcar');
  });

  it('no dia do embarque já está embarcado, dia 1', () => {
    const s = calcularStatus(entrada('2026-11-24'), d('2026-11-24'));
    expect(s).toMatchObject({ situacao: 'embarcado', diaDoPeriodo: 1, marcosHoje: ['embarque'] });
  });

  it('no dia do desembarque (conta_embarcado) mostra "Desembarque hoje"', () => {
    const s = calcularStatus(entrada('2026-10-28'), d('2026-11-24'));
    expect(s).toMatchObject({ situacao: 'embarcado', diaDoPeriodo: 28, diasRestantes: 0 });
    expect(tituloStatus(s).subtitulo).toBe('Desembarque hoje');
  });

  it('no dia do desembarque (conta_folga) já está de folga', () => {
    const s = calcularStatus(entrada('2026-10-27', { regraDesembarque: 'conta_folga' }), d('2026-11-24'));
    expect(s).toMatchObject({ situacao: 'folga', diaDoPeriodo: 1, marcosHoje: ['desembarque'], diasRestantes: 28 });
  });

  it('véspera do embarque: "embarque amanhã"', () => {
    const s = calcularStatus(entrada('2026-11-25'), d('2026-11-24'));
    expect(tituloStatus(s).titulo).toBe('DE FOLGA – embarque amanhã');
  });

  it('avisa quando a viagem começa antes do embarque', () => {
    const s = calcularStatus(entrada('2026-12-03', { diasViagemAntes: 2 }), d('2026-11-24'));
    expect(s.proximaViagem).toBe('2026-12-01');
  });

  it('próxima troca atravessa a virada do ano', () => {
    const s = calcularStatus(entrada('2026-12-10'), d('2026-12-31'));
    expect(s.proximaTroca).toEqual({ data: '2027-01-06', tipo: 'desembarque' });
  });
});
