import { describe, expect, it } from 'vitest';
import type { Ajuste } from '../ajustes';
import { diaISO, type DiaISO } from '../datas';
import type { EntradaEscala } from '../escala';
import { calcularEstatisticas, CATEGORIAS, diasDoAno } from '../estatisticas';
import { congelar, type DiaRealizado } from '../historico';
import type { ParametrosEscala } from '../tipos';

const d = (s: string) => diaISO(s);
const vazio = new Map<DiaISO, DiaRealizado>();

function escala(embarque: string, ajustes: Ajuste[] = [], extra: Partial<ParametrosEscala> = {}): EntradaEscala {
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

const ajuste = (tipo: Ajuste['tipo'], inicio: string, fim: string, id: number, extra: Partial<Ajuste> = {}): Ajuste => ({
  id,
  tipo,
  inicio: d(inicio),
  fim: d(fim),
  observacao: '',
  aposAjuste: 'retomar_ciclo',
  ...extra,
});

// 28x28 com embarque em 04/01/2027: a bordo 04/01–31/01, 01/03–28/03, 26/04–23/05, 21/06–18/07,
// 16/08–12/09, 11/10–07/11, 06/12–02/01/2028.
const base = escala('2027-01-04');
const ANTES_DO_ANO = d('2026-12-01');

describe('estatísticas do ano', () => {
  it('28x28 em 2027: dias a bordo e em terra fecham 365', () => {
    const e = calcularEstatisticas(diasDoAno(base, vazio, 2027, ANTES_DO_ANO), ANTES_DO_ANO);
    expect(e.total).toEqual({ dias: 365, aBordo: 6 * 28 + 26, emTerra: 365 - (6 * 28 + 26) });
    expect(e.embarques).toBe(7);
    expect(e.porCategoria.embarcado).toBe(194);
    expect(CATEGORIAS.reduce((s, c) => s + e.porCategoria[c], 0)).toBe(365);
  });

  it('mês a mês soma o total do ano', () => {
    const e = calcularEstatisticas(diasDoAno(base, vazio, 2027, ANTES_DO_ANO), ANTES_DO_ANO);
    expect(e.porMes).toHaveLength(12);
    expect(e.porMes.reduce((s, m) => s + m.aBordo, 0)).toBe(e.total.aBordo);
    expect(e.porMes[0]).toEqual({ dias: 31, aBordo: 28, emTerra: 3 });
    expect(e.porMes[1]).toEqual({ dias: 28, aBordo: 0, emTerra: 28 });
  });

  it('ano bissexto tem 366 dias', () => {
    const e = calcularEstatisticas(diasDoAno(base, vazio, 2028, ANTES_DO_ANO), ANTES_DO_ANO);
    expect(e.total.dias).toBe(366);
    expect(e.porMes[1]!.dias).toBe(29);
  });

  it('separa o que já passou do que ainda vem', () => {
    const hoje = d('2027-07-01');
    const e = calcularEstatisticas(diasDoAno(base, vazio, 2027, hoje), hoje);
    expect(e.jaPassou.dias).toBe(181); // 01/01 a 30/06
    expect(e.aindaVem.dias).toBe(184);
    expect(e.jaPassou.aBordo + e.aindaVem.aBordo).toBe(e.total.aBordo);
    expect(e.jaPassou.aBordo).toBe(28 + 28 + 28 + 10); // jan, mar, abr–mai, 21–30/06
  });

  it('conta dobras, cursos e férias, com dias de cada um', () => {
    const ajustes = [
      ajuste('dobra', '2027-02-01', '2027-02-14', 1),
      ajuste('dobra', '2027-11-08', '2027-11-14', 2),
      ajuste('curso', '2027-02-20', '2027-02-22', 3),
      ajuste('ferias', '2027-07-19', '2027-08-10', 4),
    ];
    const e = calcularEstatisticas(diasDoAno(escala('2027-01-04', ajustes), vazio, 2027, ANTES_DO_ANO), ANTES_DO_ANO);
    expect(e.porAjuste.dobra).toEqual({ quantidade: 2, dias: 21 });
    expect(e.porAjuste.curso).toEqual({ quantidade: 1, dias: 3 });
    expect(e.porAjuste.ferias).toEqual({ quantidade: 1, dias: 23 });
    expect(e.porAjuste.troca).toEqual({ quantidade: 0, dias: 0 });
    expect(e.total.aBordo).toBe(194 + 21);
    expect(e.porCategoria.curso).toBe(3);
    expect(e.porCategoria.ferias).toBe(23);
    expect(e.maiorPeriodoABordo).toEqual({ dias: 42, inicio: '2027-01-04', fim: '2027-02-14' });
  });

  it('ajuste que atravessa a virada do ano conta nos dois anos, com os dias de cada um', () => {
    const e = escala('2027-01-04', [ajuste('dobra', '2028-01-03', '2028-01-09', 1)]);
    const e2027 = calcularEstatisticas(diasDoAno(e, vazio, 2027, ANTES_DO_ANO), ANTES_DO_ANO);
    const e2028 = calcularEstatisticas(diasDoAno(e, vazio, 2028, ANTES_DO_ANO), ANTES_DO_ANO);
    expect(e2027.porAjuste.dobra.quantidade).toBe(0);
    expect(e2028.porAjuste.dobra).toEqual({ quantidade: 1, dias: 7 });
    // o período que começou em 06/12/2027 conta como maior período nos dois anos
    expect(e2028.maiorPeriodoABordo).toEqual({ dias: 35, inicio: '2027-12-06', fim: '2028-01-09' });
  });

  it('dias de viagem aparecem separados, mas contam como em terra', () => {
    const e = calcularEstatisticas(
      diasDoAno(escala('2027-01-04', [], { regraDesembarque: 'conta_folga', diasViagemDepois: 1 }), vazio, 2027, ANTES_DO_ANO),
      ANTES_DO_ANO,
    );
    expect(e.porCategoria.viagem).toBe(6); // 6 desembarques em 2027 (o 7º cai em 03/01/2028)
    expect(e.total.aBordo).toBe(194);
  });

  it('usa o histórico para o passado, mesmo que a escala tenha mudado', () => {
    const hoje = d('2027-02-01');
    const banco = new Map<DiaISO, DiaRealizado>();
    for (const x of congelar(base, d('2027-01-01'), d('2027-01-31'), 'agora')) banco.set(x.data, x);
    // a escala atual diz outra coisa (âncora mudou), mas janeiro já passou
    const nova = escala('2027-01-18');
    const e = calcularEstatisticas(diasDoAno(nova, banco, 2027, hoje), hoje);
    expect(e.porMes[0]!.aBordo).toBe(28);
    expect(e.jaPassou).toEqual({ dias: 31, aBordo: 28, emTerra: 3 });
  });
});
