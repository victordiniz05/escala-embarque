import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

interface Props {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
}

/** Painel que sobe de baixo (padrão iOS). */
export function FolhaInferior({ aberta, aoFechar, titulo, children }: Props) {
  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aberta, aoFechar]);

  if (!aberta) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={titulo}>
      <button className="absolute inset-0 bg-black/40" aria-label="Fechar" onClick={aoFechar} />
      <div className="pb-seguro relative max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl bg-white px-5 pt-3 shadow-2xl dark:bg-slate-900">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button
            onClick={aoFechar}
            className="-mr-2 rounded-full p-2 text-slate-500 active:bg-slate-100 dark:active:bg-slate-800"
            aria-label="Fechar"
          >
            <X size={22} />
          </button>
        </div>
        <div className="pb-4">{children}</div>
      </div>
    </div>
  );
}
