import { enviarArquivo, type ResultadoEnvio } from '../compartilhar';
import { DIAS_ADIAMENTO, montarBackup, nomeArquivoBackup, type Backup, type DadosBackup } from '../dominio/backup';
import { somarDias, type DiaISO } from '../dominio/datas';
import { db } from './db';

const CHAVE_ULTIMO = 'ultimoBackup';

/** Junta tudo o que está no aparelho num backup. */
export async function gerarBackup(): Promise<Backup> {
  const [configuracao, ancoras, ajustes, eventos, realizados] = await Promise.all([
    db.configuracao.get('atual'),
    db.ancoras.toArray(),
    db.ajustes.toArray(),
    db.eventos.toArray(),
    db.realizados.toArray(),
  ]);
  if (!configuracao) throw new Error('Configure a escala antes de fazer backup.');
  const { regime, regraDesembarque, diasViagemAntes, diasViagemDepois, embarcacao, empresa, tema, inicioEscala } =
    configuracao;
  const dados: DadosBackup = {
    configuracao: {
      regime,
      regraDesembarque,
      diasViagemAntes,
      diasViagemDepois,
      embarcacao,
      empresa,
      tema,
      ...(inicioEscala ? { inicioEscala } : {}),
    },
    ancoras: ancoras.map(({ dataEmbarque, vigenteDesde, origem }) => ({ dataEmbarque, vigenteDesde, origem })),
    // Os ajustes mantêm o id: o histórico aponta para eles.
    ajustes,
    eventos: eventos.map(({ id: _id, ...e }) => e),
    realizados,
  };
  return montarBackup(dados, new Date().toISOString());
}

export async function marcarBackupFeito(): Promise<void> {
  await db.meta.put({ chave: CHAVE_ULTIMO, valor: new Date().toISOString() });
}

/** Substitui todos os dados do aparelho pelos do backup. */
export async function restaurarBackup(backup: Backup): Promise<void> {
  const d = backup.dados;
  await db.transaction('rw', [db.configuracao, db.ancoras, db.ajustes, db.eventos, db.realizados, db.meta], async () => {
    await Promise.all([
      db.configuracao.clear(),
      db.ancoras.clear(),
      db.ajustes.clear(),
      db.eventos.clear(),
      db.realizados.clear(),
    ]);
    // Backups antigos não têm o início da escala: usa o do histórico ou o primeiro embarque.
    const inicioEscala =
      d.configuracao.inicioEscala ??
      d.inicioHistorico ??
      d.ancoras.map((a) => a.dataEmbarque).sort()[0];
    await db.configuracao.put({ ...d.configuracao, inicioEscala, id: 'atual', atualizadoEm: new Date().toISOString() });
    await db.ancoras.bulkAdd(d.ancoras);
    const agora = new Date().toISOString();
    await db.ajustes.bulkPut(d.ajustes.map((a) => ({ ...a, criadoEm: a.criadoEm ?? agora })));
    await db.eventos.bulkAdd(d.eventos.map((e) => ({ ...e, criadoEm: e.criadoEm ?? agora })));
    await db.realizados.bulkPut(d.realizados);
  });
}

/** Gera o backup e entrega pela folha de compartilhar (ou download). */
export async function salvarBackupAgora(hoje: DiaISO): Promise<ResultadoEnvio> {
  const backup = await gerarBackup();
  const r = await enviarArquivo(nomeArquivoBackup(hoje), JSON.stringify(backup), 'application/json');
  if (r === 'compartilhado' || r === 'baixado') await marcarBackupFeito();
  return r;
}

/** "Depois": esconde o lembrete por alguns dias. */
export async function adiarLembreteBackup(hoje: DiaISO): Promise<void> {
  await db.meta.put({ chave: 'lembreteBackupAdiadoAte', valor: somarDias(hoje, DIAS_ADIAMENTO) });
}
