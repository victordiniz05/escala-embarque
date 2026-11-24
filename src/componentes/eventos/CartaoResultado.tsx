import { CircleCheck, Ship, TriangleAlert } from 'lucide-react';
import type { Disponibilidade, ResultadoEvento } from '../../dominio/eventos';
import { COR_DISPONIBILIDADE, ROTULO_DISPONIBILIDADE, descreverResultado } from './textoEvento';

const ICONE: Record<Disponibilidade, typeof Ship> = {
  livre: CircleCheck,
  atencao: TriangleAlert,
  parcial: Ship,
  embarcado: Ship,
};

/** A resposta completa: "Você estará de folga…" com os avisos. */
export function CartaoResultado({ resultado }: { resultado: ResultadoEvento }) {
  const { frase, linhas } = descreverResultado(resultado);
  const Icone = ICONE[resultado.disponibilidade];
  return (
    <div className={`rounded-2xl p-4 ring-1 ${COR_DISPONIBILIDADE[resultado.disponibilidade].cartao}`} aria-live="polite">
      <p className="flex items-center gap-2 text-lg font-bold">
        <Icone size={22} aria-hidden />
        {ROTULO_DISPONIBILIDADE[resultado.disponibilidade]}
      </p>
      <p className="mt-1">{frase}</p>
      {linhas.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-sm opacity-85">
          {linhas.map((l) => (
            <li key={l}>• {l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Selo curto para listas. */
export function SeloDisponibilidade({ disponibilidade }: { disponibilidade: Disponibilidade }) {
  const curto: Record<Disponibilidade, string> = {
    livre: 'Folga',
    atencao: 'Folga ⚠',
    parcial: 'Parcial',
    embarcado: 'Embarcado',
  };
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${COR_DISPONIBILIDADE[disponibilidade].selo}`}>
      {curto[disponibilidade]}
    </span>
  );
}
