import { describe, expect, it } from 'vitest';
import type { Ajuste } from '../ajustes';
import { diaISO, somarDias } from '../datas';
import { projetarEscala, type EntradaEscala } from '../escala';
import { blocosDaEscala, dobrarLinha, escaparTexto, gerarIcs } from '../ics';
import type { ParametrosEscala } from '../tipos';

const d = (s: string) => diaISO(s);
const AGORA = new Date(Date.UTC(2026, 10, 24, 15, 0, 0));

function escala(extra: Partial<ParametrosEscala> = {}, ajustes: Ajuste[] = []): EntradaEscala {
  return {
    parametros: {
      regime: { embarcado: 28, folga: 28 },
      regraDesembarque: 'conta_embarcado',
      diasViagemAntes: 0,
      diasViagemDepois: 0,
      ...extra,
    },
    ancoras: [{ dataEmbarque: d('2026-11-13'), vigenteDesde: d('2026-11-13') }],
    ajustes,
  };
}

function blocos(e: EntradaEscala, de: string, ate: string) {
  const dias = projetarEscala(e, somarDias(d(de), -60), somarDias(d(ate), 60));
  return blocosDaEscala(dias, d(de), d(ate));
}

describe('blocos da escala', () => {
  it('períodos a bordo e de folga, inteiros, atravessando a virada do ano', () => {
    const b = blocos(escala(), '2026-12-01', '2027-02-28');
    expect(b.map((x) => [x.categoria, x.inicio, x.fim, x.dias])).toEqual([
      ['embarcado', '2026-11-13', '2026-12-10', 28],
      ['folga', '2026-12-11', '2027-01-07', 28],
      ['embarcado', '2027-01-08', '2027-02-04', 28],
      ['folga', '2027-02-05', '2027-03-04', 28],
    ]);
    expect(b[0]!.desembarque).toBe('2026-12-10');
  });

  it('com desembarque no dia da troca, o desembarque é o dia seguinte; a viagem conta como folga', () => {
    const b = blocos(escala({ regraDesembarque: 'conta_folga', diasViagemDepois: 1 }), '2026-12-01', '2026-12-31');
    expect(b[0]).toMatchObject({ categoria: 'embarcado', fim: '2026-12-10', desembarque: '2026-12-11' });
    expect(b[1]).toMatchObject({ categoria: 'folga', inicio: '2026-12-11', dias: 28 });
  });

  it('dobra aumenta o bloco; curso vira um bloco próprio', () => {
    const ajustes: Ajuste[] = [
      { tipo: 'dobra', inicio: d('2026-12-11'), fim: d('2026-12-24'), observacao: '', aposAjuste: 'retomar_ciclo' },
      { tipo: 'curso', inicio: d('2027-01-02'), fim: d('2027-01-04'), observacao: '', aposAjuste: 'retomar_ciclo' },
    ];
    const b = blocos(escala({}, ajustes), '2026-12-01', '2027-01-31');
    expect(b.map((x) => [x.categoria, x.inicio, x.fim])).toEqual([
      ['embarcado', '2026-11-13', '2026-12-24'],
      ['folga', '2026-12-25', '2027-01-01'],
      ['curso', '2027-01-02', '2027-01-04'],
      ['folga', '2027-01-05', '2027-01-07'],
      ['embarcado', '2027-01-08', '2027-02-04'],
    ]);
  });
});

describe('arquivo .ics', () => {
  const b = blocos(escala(), '2026-12-01', '2027-01-31');

  it('segue o formato: CRLF, datas de dia inteiro e DTEND exclusivo', () => {
    const ics = gerarIcs(b, { incluirFolgas: false, embarcacao: 'P-77', agora: AGORA });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.split('\r\n').every((l) => !l.includes('\n'))).toBe(true);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261113\r\nDTEND;VALUE=DATE:20261211');
    expect(ics).toContain('SUMMARY:A bordo – P-77');
    expect(ics).toContain('DTSTAMP:20261124T150000Z');
    expect(ics).toContain('UID:embarcado-20261113@escala-embarque');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2); // só os períodos a bordo
  });

  it('inclui as folgas quando pedido', () => {
    const ics = gerarIcs(b, { incluirFolgas: true, agora: AGORA });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3); // 2 a bordo + 1 folga
    expect(ics).toContain('SUMMARY:Folga');
  });

  it('escapa vírgula, ponto e vírgula e quebra de linha', () => {
    expect(escaparTexto('a, b; c\nd\\e')).toBe('a\\, b\\; c\\nd\\\\e');
    const ics = gerarIcs(b, { incluirFolgas: false, embarcacao: 'Navio A, B', agora: AGORA });
    expect(ics).toContain('SUMMARY:A bordo – Navio A\\, B');
  });

  it('quebra linhas longas em até 75 bytes, sem partir acentos', () => {
    const longa = 'DESCRIPTION:' + 'Embarcação ação '.repeat(10);
    const dobrada = dobrarLinha(longa);
    const enc = new TextEncoder();
    for (const l of dobrada.split('\r\n')) expect(enc.encode(l).length).toBeLessThanOrEqual(75);
    expect(dobrada.replaceAll('\r\n ', '')).toBe(longa);
  });
});
