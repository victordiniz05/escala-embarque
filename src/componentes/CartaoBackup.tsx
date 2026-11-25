import { ClipboardPaste, Copy, FileUp, Save, ShieldCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { copiarTexto, enviarArquivo } from '../compartilhar';
import { gerarBackup, marcarBackupFeito, restaurarBackup } from '../dados/backup';
import { useHoje, useUltimoBackup } from '../dados/hooks';
import { lerBackup, nomeArquivoBackup, type Backup, type ResumoBackup } from '../dominio/backup';
import { Cartao } from './Cartao';

const BOTAO =
  'flex h-12 items-center justify-center gap-2 rounded-xl font-semibold ring-1 ring-slate-300 bg-white active:bg-slate-100 dark:bg-slate-900 dark:ring-slate-700';

function dataHora(iso: string): string {
  // datas-ok: instante ISO completo (com hora e fuso), mostrado no fuso de São Paulo
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
}

/** Cartão de backup da tela de configurações. */
export function CartaoBackup() {
  const hojeSP = useHoje();
  const ultimo = useUltimoBackup();
  const [aviso, setAviso] = useState<string | null>(null);

  async function salvar() {
    setAviso(null);
    const backup = await gerarBackup();
    const r = await enviarArquivo(nomeArquivoBackup(hojeSP), JSON.stringify(backup), 'application/json');
    if (r === 'compartilhado' || r === 'baixado') {
      await marcarBackupFeito();
      setAviso(r === 'baixado' ? 'Backup salvo na pasta de downloads.' : 'Backup pronto.');
    } else if (r === 'indisponivel') {
      setAviso('Este navegador não deixou salvar o arquivo. Use "Copiar como texto".');
    }
  }

  async function copiar() {
    setAviso(null);
    // A cópia precisa acontecer logo após o toque: gera o texto antes de copiar.
    const texto = JSON.stringify(await gerarBackup());
    if (await copiarTexto(texto)) {
      await marcarBackupFeito();
      setAviso('Backup copiado. Cole numa conversa com você mesmo no WhatsApp ou numa nota.');
    } else {
      setAviso('Não foi possível copiar neste navegador.');
    }
  }

  return (
    <Cartao>
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <ShieldCheck size={18} aria-hidden /> Backup
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {ultimo ? `Último backup: ${dataHora(ultimo)}.` : 'Você ainda não fez backup.'}
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Seus dados ficam só neste aparelho. Guarde um backup no iCloud Drive, no WhatsApp ou no e-mail para não
        perder nada se trocar ou perder o celular.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={salvar} className={`${BOTAO} !bg-embarcado !text-white !ring-embarcado active:!bg-blue-700`}>
          <Save size={18} /> Salvar backup
        </button>
        <button onClick={copiar} className={BOTAO}>
          <Copy size={18} /> Copiar texto
        </button>
      </div>
      {aviso && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{aviso}</p>}

      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
        <RestaurarBackup />
      </div>
    </Cartao>
  );
}

/** Escolher arquivo ou colar texto → resumo → confirmar. Usado também na primeira tela. */
export function RestaurarBackup({ aoRestaurar }: { aoRestaurar?: () => void }) {
  const entradaArquivo = useRef<HTMLInputElement>(null);
  const [colando, setColando] = useState(false);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [lido, setLido] = useState<{ backup: Backup; resumo: ResumoBackup } | null>(null);
  const [feito, setFeito] = useState(false);

  function ler(conteudo: string) {
    setFeito(false);
    const r = lerBackup(conteudo.trim());
    if (r.ok) {
      setLido({ backup: r.backup, resumo: r.resumo });
      setErro(null);
    } else {
      setLido(null);
      setErro(r.erro);
    }
  }

  async function confirmar() {
    if (!lido) return;
    await restaurarBackup(lido.backup);
    setLido(null);
    setColando(false);
    setTexto('');
    setFeito(true);
    aoRestaurar?.();
  }

  return (
    <div>
      <p className="mb-2 font-semibold">Restaurar backup</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => entradaArquivo.current?.click()} className={BOTAO}>
          <FileUp size={18} /> Escolher arquivo
        </button>
        <button onClick={() => setColando((c) => !c)} className={BOTAO} aria-expanded={colando}>
          <ClipboardPaste size={18} /> Colar texto
        </button>
      </div>
      <input
        ref={entradaArquivo}
        id="backup-arquivo"
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={async (e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = '';
          if (arquivo) ler(await arquivo.text());
        }}
      />
      {colando && (
        <div className="mt-2 space-y-2">
          <textarea
            id="backup-texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Cole aqui o texto do backup"
            rows={4}
            className="w-full rounded-xl bg-white p-3 font-mono text-xs ring-1 ring-slate-300 dark:bg-slate-950 dark:ring-slate-700"
          />
          <button onClick={() => ler(texto)} disabled={!texto.trim()} className={`${BOTAO} w-full disabled:opacity-40`}>
            Ler backup
          </button>
        </div>
      )}

      {erro && (
        <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">{erro}</p>
      )}
      {feito && <p className="mt-2 text-sm font-medium text-folga">Backup restaurado.</p>}

      {lido && (
        <div className="mt-3 space-y-2 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/40">
          <p className="text-sm text-amber-950 dark:text-amber-50">
            Backup de <strong>{dataHora(lido.resumo.exportadoEm)}</strong>: regime {lido.resumo.regime},{' '}
            {lido.resumo.ajustes} ajuste(s), {lido.resumo.eventos} evento(s) e {lido.resumo.diasHistorico} dia(s) de
            histórico.
          </p>
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-50">
            Isto substitui todos os dados deste aparelho.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setLido(null)} className={`${BOTAO} flex-1`}>
              Cancelar
            </button>
            <button
              onClick={confirmar}
              className="h-12 flex-1 rounded-xl bg-amber-600 font-semibold text-white active:bg-amber-700"
            >
              Substituir meus dados
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
