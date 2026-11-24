import { describe, expect, it } from 'vitest';
import { semanasDoMes } from '../../exportacao/imagem';
import { criarDia, diasNoMes } from '../datas';

const mes = (ano: number, m: number) =>
  Array.from({ length: diasNoMes(ano, m) }, (_, i) => ({ data: criarDia(ano, m, i + 1) }));

describe('grade do mês para a imagem', () => {
  it('novembro de 2026 começa num domingo: 5 semanas', () => {
    const s = semanasDoMes(mes(2026, 11));
    expect(s).toHaveLength(5);
    expect(s[0]![0]?.data).toBe('2026-11-01');
    expect(s[4]!.filter(Boolean)).toHaveLength(2); // 29 e 30
  });

  it('janeiro de 2026 começa numa quinta: 4 vazios antes', () => {
    const s = semanasDoMes(mes(2026, 1));
    expect(s[0]!.slice(0, 4)).toEqual([null, null, null, null]);
    expect(s[0]![4]?.data).toBe('2026-01-01');
    expect(s.flat().filter(Boolean)).toHaveLength(31);
    expect(s.every((sem) => sem.length === 7)).toBe(true);
  });

  it('fevereiro de 2026 (28 dias, começa no domingo) cabe em 4 semanas', () => {
    expect(semanasDoMes(mes(2026, 2))).toHaveLength(4);
  });
});
