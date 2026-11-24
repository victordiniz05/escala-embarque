import { Share } from 'lucide-react';
import { useState } from 'react';

/** Botão redondo de compartilhar; mostra um aviso curto se der errado. */
export function BotaoCompartilhar({ aoCompartilhar, rotulo }: { aoCompartilhar: () => Promise<unknown>; rotulo: string }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <span className="relative">
      <button
        onClick={async () => {
          setOcupado(true);
          setErro(null);
          try {
            await aoCompartilhar();
          } catch {
            setErro('Não foi possível gerar a imagem.');
          } finally {
            setOcupado(false);
          }
        }}
        disabled={ocupado}
        aria-label={rotulo}
        title={rotulo}
        className="grid size-11 place-items-center rounded-full bg-white text-embarcado ring-1 ring-slate-200 active:bg-slate-100 disabled:opacity-50 dark:bg-slate-900 dark:text-blue-300 dark:ring-slate-800"
      >
        <Share size={20} />
      </button>
      {erro && (
        <span className="absolute top-12 right-0 z-10 w-48 rounded-lg bg-red-50 p-2 text-xs text-red-700 shadow dark:bg-red-950 dark:text-red-200">
          {erro}
        </span>
      )}
    </span>
  );
}
