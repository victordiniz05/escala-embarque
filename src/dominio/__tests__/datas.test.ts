import { describe, expect, it } from 'vitest';
import {
  criarDia,
  deNumero,
  diaDaSemana,
  diaISO,
  diasNoMes,
  diferencaDias,
  ehBissexto,
  ehDiaISO,
  hoje,
  intervaloDeDias,
  modPositivo,
  paraDateLocal,
  paraNumero,
  somarDias,
  somarMeses,
  type DiaISO,
} from '../datas';

const d = (s: string) => diaISO(s);

describe('datas puras', () => {
  it('valida o formato e datas impossíveis', () => {
    expect(ehDiaISO('2026-11-24')).toBe(true);
    expect(ehDiaISO('2026-02-29')).toBe(false);
    expect(ehDiaISO('2028-02-29')).toBe(true);
    expect(ehDiaISO('2026-13-01')).toBe(false);
    expect(ehDiaISO('24/11/2026')).toBe(false);
    expect(() => criarDia(2026, 4, 31)).toThrow();
  });

  it('converte para número e volta sem perder nada (1900–2100)', () => {
    let dia = d('1900-01-01');
    let n = paraNumero(dia);
    while (dia <= '2100-12-31') {
      expect(paraNumero(dia)).toBe(n);
      expect(deNumero(n)).toBe(dia);
      n += 1;
      dia = somarDias(dia, 1);
    }
  });

  it('soma dias atravessando virada de mês e de ano', () => {
    expect(somarDias(d('2026-12-31'), 1)).toBe('2027-01-01');
    expect(somarDias(d('2027-01-01'), -1)).toBe('2026-12-31');
    expect(somarDias(d('2026-12-10'), 56)).toBe('2027-02-04');
    expect(somarDias(d('2028-02-28'), 1)).toBe('2028-02-29');
    expect(somarDias(d('2027-02-28'), 1)).toBe('2027-03-01');
  });

  it('calcula diferença entre dias', () => {
    expect(diferencaDias(d('2026-01-01'), d('2027-01-01'))).toBe(365);
    expect(diferencaDias(d('2028-01-01'), d('2029-01-01'))).toBe(366);
    expect(diferencaDias(d('2027-01-01'), d('2026-01-01'))).toBe(-365);
  });

  it('sabe o dia da semana', () => {
    expect(diaDaSemana(d('2026-11-24'))).toBe(2); // terça
    expect(diaDaSemana(d('1970-01-01'))).toBe(4); // quinta
    expect(diaDaSemana(d('1969-12-31'))).toBe(3); // quarta (antes da época)
    expect(diaDaSemana(d('2028-02-29'))).toBe(2); // terça
  });

  it('anos bissextos e dias no mês', () => {
    expect(ehBissexto(2028)).toBe(true);
    expect(ehBissexto(2026)).toBe(false);
    expect(ehBissexto(2100)).toBe(false);
    expect(ehBissexto(2000)).toBe(true);
    expect(diasNoMes(2028, 2)).toBe(29);
    expect(diasNoMes(2027, 2)).toBe(28);
    expect(diasNoMes(2026, 12)).toBe(31);
  });

  it('soma meses com virada de ano', () => {
    expect(somarMeses(2026, 12, 1)).toEqual({ ano: 2027, mes: 1 });
    expect(somarMeses(2027, 1, -1)).toEqual({ ano: 2026, mes: 12 });
    expect(somarMeses(2026, 11, 26)).toEqual({ ano: 2029, mes: 1 });
  });

  it('modPositivo nunca é negativo', () => {
    expect(modPositivo(-1, 56)).toBe(55);
    expect(modPositivo(-56, 56)).toBe(0);
    expect(modPositivo(57, 56)).toBe(1);
  });

  it('gera intervalos inclusivos', () => {
    expect(intervaloDeDias(d('2026-12-30'), d('2027-01-02'))).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });

  describe('hoje no fuso de São Paulo', () => {
    it('23h30 em SP ainda é o mesmo dia, mesmo já sendo o dia seguinte em UTC', () => {
      const agora = new Date(Date.UTC(2026, 10, 25, 2, 30)); // 25/11 02:30 UTC
      expect(hoje('America/Sao_Paulo', agora)).toBe('2026-11-24');
      expect(hoje('UTC', agora)).toBe('2026-11-25');
    });

    it('réveillon: 31/12 21h em SP é 01/01 em UTC', () => {
      const agora = new Date(Date.UTC(2027, 0, 1, 0, 0));
      expect(hoje('America/Sao_Paulo', agora)).toBe('2026-12-31');
    });
  });

  it('paraDateLocal devolve meia-noite local do mesmo dia (qualquer fuso)', () => {
    const data = paraDateLocal(d('2026-01-01') as DiaISO);
    expect(data.getFullYear()).toBe(2026);
    expect(data.getMonth()).toBe(0);
    expect(data.getDate()).toBe(1);
  });
});
