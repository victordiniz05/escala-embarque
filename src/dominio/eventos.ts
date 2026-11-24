import { diferencaDias, somarDias, type DiaISO } from './datas';
import { projetarEscala, type EntradaEscala } from './escala';
import { duracaoCiclo } from './regimes';
import type { DiaEscala } from './tipos';

/** Compromisso pessoal: "ETAPA SP", casamento, aniversário… */
export interface Evento {
  nome: string;
  inicio: DiaISO;
  /** Último dia, para eventos de vários dias. */
  fim?: DiaISO;
}

/**
 * - livre: de folga em todos os dias, sem nada no caminho
 * - atencao: de folga, mas é dia de viagem, de troca de turma ou véspera de embarque
 * - parcial: embarcado em parte dos dias
 * - embarcado: embarcado em todos os dias
 */
export type Disponibilidade = 'livre' | 'atencao' | 'parcial' | 'embarcado';

export type AlertaEvento =
  | 'dia_de_viagem'
  | 'dia_do_embarque'
  | 'dia_do_desembarque'
  | 'embarca_no_dia_seguinte'
  | 'em_curso'
  | 'afastado';

export interface ResultadoEvento {
  disponibilidade: Disponibilidade;
  alertas: AlertaEvento[];
  diasABordo: number;
  totalDias: number;
  /** Como está a escala no primeiro dia do evento. */
  primeiroDia: DiaEscala;
  /** Se o evento começa a bordo: data do desembarque desse período. */
  desembarque?: DiaISO;
  /** Próximo embarque depois do fim do evento (útil quando está de folga). */
  proximoEmbarque?: DiaISO;
  /** Dias de hoje até o início (negativo = já passou). */
  diasAte: number;
}

export function fimDoEvento(e: Evento): DiaISO {
  return e.fim && e.fim > e.inicio ? e.fim : e.inicio;
}

export function verificarEvento(entrada: EntradaEscala, evento: Evento, hoje: DiaISO): ResultadoEvento {
  const fim = fimDoEvento(evento);
  const ciclo = duracaoCiclo(entrada.parametros.regime);
  // Projeta o evento e um pouco além, para achar desembarque e próximo embarque.
  const dias = projetarEscala(entrada, evento.inicio, somarDias(fim, 2 * ciclo + 1));
  const totalDias = diferencaDias(evento.inicio, fim) + 1;
  const doEvento = dias.slice(0, totalDias);
  const depois = dias.slice(totalDias);

  const diasABordo = doEvento.filter((d) => d.aBordo).length;
  const primeiroDia = doEvento[0]!;

  const alertas: AlertaEvento[] = [];
  if (doEvento.some((d) => d.marcos.includes('embarque'))) alertas.push('dia_do_embarque');
  if (doEvento.some((d) => d.marcos.includes('desembarque'))) alertas.push('dia_do_desembarque');
  if (doEvento.some((d) => d.categoria === 'viagem')) alertas.push('dia_de_viagem');
  if (depois[0]?.marcos.includes('embarque')) alertas.push('embarca_no_dia_seguinte');
  if (doEvento.some((d) => d.categoria === 'curso')) alertas.push('em_curso');
  if (doEvento.some((d) => d.categoria === 'afastamento')) alertas.push('afastado');

  let disponibilidade: Disponibilidade;
  if (diasABordo === totalDias) disponibilidade = 'embarcado';
  else if (diasABordo > 0) disponibilidade = 'parcial';
  else disponibilidade = alertas.length > 0 ? 'atencao' : 'livre';

  const desembarque = primeiroDia.aBordo
    ? dias.find((d) => d.marcos.includes('desembarque'))?.data
    : undefined;
  const proximoEmbarque = depois.find((d) => d.marcos.includes('embarque'))?.data;

  return {
    disponibilidade,
    alertas,
    diasABordo,
    totalDias,
    primeiroDia,
    desembarque,
    proximoEmbarque,
    diasAte: diferencaDias(hoje, evento.inicio),
  };
}
