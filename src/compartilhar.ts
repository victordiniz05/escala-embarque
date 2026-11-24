export type ResultadoEnvio = 'compartilhado' | 'baixado' | 'cancelado' | 'indisponivel';

/**
 * Entrega um arquivo ao usuário. No iPhone abre a folha de compartilhar
 * (Salvar em Arquivos, WhatsApp, Calendário…); no computador, baixa o arquivo.
 */
export async function enviarArquivo(nome: string, conteudo: string | Blob, tipo: string): Promise<ResultadoEnvio> {
  const blob = typeof conteudo === 'string' ? new Blob([conteudo], { type: tipo }) : conteudo;
  try {
    const arquivo = new File([blob], nome, { type: tipo });
    if (navigator.canShare?.({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], title: nome });
      return 'compartilhado';
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado';
    // Compartilhar falhou: tenta baixar.
  }
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'baixado';
  } catch {
    return 'indisponivel';
  }
}

/** Copia texto; deve ser chamada dentro do toque do usuário. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
