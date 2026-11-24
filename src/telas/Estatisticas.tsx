import { Cartao, TituloTela } from '../componentes/Cartao';

export function Estatisticas() {
  return (
    <div>
      <TituloTela detalhe="Disponível nas próximas etapas">Estatísticas</TituloTela>
      <Cartao>
        <p className="mb-2 font-semibold">O que vai aparecer aqui</p>
        <ul className="list-disc space-y-1 pl-5 text-slate-600 dark:text-slate-300">
          <li>Dias embarcados e de folga no ano</li>
          <li>Dobras e dias extras a bordo</li>
          <li>Feriados passados a bordo (Natal, Réveillon…)</li>
          <li>Realizado × projetado</li>
        </ul>
      </Cartao>
    </div>
  );
}
