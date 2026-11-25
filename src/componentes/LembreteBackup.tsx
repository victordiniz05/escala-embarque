import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { adiarLembreteBackup, salvarBackupAgora } from '../dados/backup';
import { useEventos, useHoje, useLembreteBackupAdiadoAte, useUltimoBackup } from '../dados/hooks';
import { lembreteDeBackup } from '../dominio/backup';
import type { EntradaEscala } from '../dominio/escala';

/** Aviso discreto na tela Início quando falta backup. */
export function LembreteBackup({ entrada }: { entrada: EntradaEscala }) {
  const hojeSP = useHoje();
  const ultimoBackup = useUltimoBackup();
  const adiadoAte = useLembreteBackupAdiadoAte();
  const eventos = useEventos();
  const [aviso, setAviso] = useState<string | null>(null);

  const lembrete = lembreteDeBackup({
    hoje: hojeSP,
    ultimoBackup,
    adiadoAte,
    inicioEscala: entrada.inicio,
    temDadosProprios: (entrada.ajustes?.length ?? 0) > 0 || eventos.length > 0,
  });
  if (!lembrete) return null;

  return (
    <section className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900">
      <p className="flex items-center gap-2 font-semibold text-amber-950 dark:text-amber-50">
        <ShieldAlert size={20} aria-hidden /> Faça um backup
      </p>
      <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">
        {lembrete.tipo === 'nunca_fez'
          ? 'Você ainda não fez backup. Se trocar ou perder o celular, seus ajustes, eventos e histórico se perdem.'
          : `Seu último backup foi há ${lembrete.dias} dias.`}
      </p>
      {aviso && <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">{aviso}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={async () => {
            const r = await salvarBackupAgora(hojeSP);
            if (r === 'indisponivel') setAviso('Não deu para salvar aqui. Use Config. → Backup → Copiar texto.');
          }}
          className="h-11 flex-[2] rounded-xl bg-amber-600 font-semibold text-white active:bg-amber-700"
        >
          Fazer backup agora
        </button>
        <button
          onClick={() => adiarLembreteBackup(hojeSP)}
          className="h-11 flex-1 rounded-xl bg-white font-semibold text-amber-900 ring-1 ring-amber-300 active:bg-amber-100 dark:bg-transparent dark:text-amber-100 dark:ring-amber-800"
        >
          Depois
        </button>
      </div>
    </section>
  );
}
