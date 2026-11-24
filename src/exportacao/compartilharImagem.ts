import { enviarArquivo, type ResultadoEnvio } from '../compartilhar';
import { canvasParaPng } from './imagem';

/** Gera o PNG e abre a folha de compartilhar (WhatsApp, Fotos…). */
export async function compartilharImagem(canvas: HTMLCanvasElement, nome: string): Promise<ResultadoEnvio> {
  return enviarArquivo(nome, await canvasParaPng(canvas), 'image/png');
}
