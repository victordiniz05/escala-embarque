import { diferencaDias, somarDias, type DiaISO } from './datas';
import { projetarEscala, type EntradaEscala } from './escala';
import { duracaoCiclo } from './regimes';
import type { Categoria, Marco } from './tipos';

export interface StatusHoje {
  situacao: 'embarcado' | 'folga';
  categoriaHoje: Categoria;
  marcosHoje: Marco[];
  diaDoPeriodo: number;
  totalDoPeriodo: number;
  /** 0 a 1, para a barra de progresso. */
  progresso: number;
  /** Embarcado: dias até o desembarque. De folga: dias até o embarque. */
  diasRestantes: number;
  proximaTroca: { data: DiaISO; tipo: Marco };
  /** Primeiro dia de viagem antes do próximo embarque (se houver e ainda não começou). */
  proximaViagem?: DiaISO;
}

export function calcularStatus(entrada: EntradaEscala, dia: DiaISO): StatusHoje {
  const horizonte = 3 * duracaoCiclo(entrada.parametros.regime) + 366;
  const dias = projetarEscala(entrada, dia, somarDias(dia, horizonte));
  const hojeE = dias[0]!;
  const situacao = hojeE.aBordo ? 'embarcado' : 'folga';

  const alvo: Marco = hojeE.aBordo ? 'desembarque' : 'embarque';
  // De folga, o embarque de hoje não conta (não existe: hoje não está a bordo).
  const troca = dias.find((d, i) => d.marcos.includes(alvo) && (alvo === 'desembarque' || i > 0));
  if (!troca) throw new Error('Não foi possível encontrar a próxima troca de turma.');

  let proximaViagem: DiaISO | undefined;
  if (!hojeE.aBordo) {
    const v = dias.find(
      (d, i) => i > 0 && d.data <= troca.data && d.categoria === 'viagem' && dias[i - 1]!.categoria !== 'viagem',
    );
    if (v && v.data < troca.data) proximaViagem = v.data;
  }

  return {
    situacao,
    categoriaHoje: hojeE.categoria,
    marcosHoje: hojeE.marcos,
    diaDoPeriodo: hojeE.periodo.dia,
    totalDoPeriodo: hojeE.periodo.total,
    progresso: hojeE.periodo.dia / hojeE.periodo.total,
    diasRestantes: diferencaDias(dia, troca.data),
    proximaTroca: { data: troca.data, tipo: alvo },
    proximaViagem,
  };
}

/** Frase principal da tela Início. */
export function tituloStatus(s: StatusHoje): { titulo: string; subtitulo: string } {
  if (s.situacao === 'embarcado') {
    const sub =
      s.diasRestantes === 0
        ? 'Desembarque hoje'
        : s.diasRestantes === 1
          ? 'Desembarque amanhã'
          : `Faltam ${s.diasRestantes} dias para desembarcar`;
    return { titulo: `EMBARCADO – dia ${s.diaDoPeriodo} de ${s.totalDoPeriodo}`, subtitulo: sub };
  }
  const n = s.diasRestantes;
  const titulo =
    n === 1 ? 'DE FOLGA – embarque amanhã' : `DE FOLGA – faltam ${n} dias para embarcar`;
  if (s.marcosHoje.includes('desembarque')) {
    const sub = s.categoriaHoje === 'viagem' ? 'Hoje: desembarque e viagem (dia da troca)' : 'Hoje: desembarque';
    return { titulo, subtitulo: sub };
  }
  if (s.categoriaHoje === 'viagem') return { titulo, subtitulo: 'Hoje é dia de viagem' };
  return { titulo, subtitulo: `Dia ${s.diaDoPeriodo} de ${s.totalDoPeriodo} de folga` };
}
