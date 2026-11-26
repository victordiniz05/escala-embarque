"""Comandos do Telegram, lidos via getUpdates no início de cada execução.

Só mensagens do chat TELEGRAM_CHAT_ID são processadas; qualquer outro remetente é
ignorado em silêncio (sem resposta). O texto das mensagens não é gravado.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from html import escape

from . import segredos
from .analise import iso
from .db.base import Repositorio
from .graficos import grafico_produto
from .mensagens import brl
from .modelos import Produto
from .telegram import Telegram
from .texto import normalizar
from .util import para_float

log = logging.getLogger(__name__)

AJUDA = """<b>Comandos do caca-promocao</b>
/add nome | busca | preço-alvo | lojas — cadastra produto (preço 0 = só alerta de queda; lojas separadas por vírgula ou "todas")
/lista — produtos cadastrados
/pausar nome — para de monitorar
/ativar nome — volta a monitorar
/remover nome — apaga o produto e o histórico
/historico nome — gráfico do histórico
/buscar — faz uma busca agora, nesta execução
/ajuda — esta mensagem

Exemplo: <code>/add Air fryer | air fryer 5 litros | 350 | mercadolivre, amazon</code>
Palavras proibidas e outros ajustes finos: edite o produtos.yaml."""


@dataclass
class Contexto:
    produtos: list[Produto]
    repo: Repositorio
    telegram: Telegram
    lojas: dict[str, str]                 # nome -> nome de exibição
    cfg: dict
    produtos_alterados: bool = False
    forcar_busca: bool = False
    respostas: list[str] = field(default_factory=list)


def _achar(produtos: list[Produto], nome: str) -> Produto | None | str:
    alvo = normalizar(nome)
    if not alvo:
        return None
    exatos = [p for p in produtos if normalizar(p.nome) == alvo]
    if exatos:
        return exatos[0]
    parciais = [p for p in produtos if alvo in normalizar(p.nome)]
    if len(parciais) == 1:
        return parciais[0]
    if len(parciais) > 1:
        return "ambiguo"
    return None


def _resolver(ctx: Contexto, nome: str) -> Produto | None:
    p = _achar(ctx.produtos, nome)
    if p == "ambiguo":
        ctx.respostas.append(f"Mais de um produto contém “{escape(nome)}”. Use o nome completo (veja /lista).")
        return None
    if p is None:
        ctx.respostas.append(f"Não achei o produto “{escape(nome)}”. Veja /lista.")
        return None
    return p  # type: ignore[return-value]


def cmd_add(ctx: Contexto, arg: str) -> None:
    partes = [x.strip() for x in arg.split("|")]
    if len(partes) < 2 or not partes[0] or not partes[1]:
        ctx.respostas.append("Uso: /add nome | busca | preço-alvo | lojas")
        return
    nome, busca = partes[0], partes[1]
    alvo = para_float(partes[2]) if len(partes) > 2 and partes[2] else 0.0
    if alvo is None or alvo < 0:
        ctx.respostas.append("Preço-alvo inválido. Use um número, ex.: 199,90 (ou 0).")
        return
    texto_lojas = partes[3] if len(partes) > 3 else ""
    if not texto_lojas or normalizar(texto_lojas) == "todas":
        lojas = sorted(ctx.lojas)
    else:
        lojas = [normalizar(x) for x in texto_lojas.replace(";", ",").replace(" ", ",").split(",") if x.strip()]
        desconhecidas = [x for x in lojas if x not in ctx.lojas]
        if desconhecidas:
            ctx.respostas.append(f"Loja desconhecida: {escape(', '.join(desconhecidas))}. "
                                 f"Disponíveis: {', '.join(sorted(ctx.lojas))}.")
            return
    if any(normalizar(p.nome) == normalizar(nome) for p in ctx.produtos):
        ctx.respostas.append(f"Já existe “{escape(nome)}”. Use outro nome ou /remover antes.")
        return
    padrao = ctx.cfg.get("padrao_novo_produto", {})
    primeira = next((w for w in busca.split() if len(w) > 2), busca.split()[0])
    p = Produto(nome=nome, busca=busca, preco_alvo=alvo, lojas=lojas,
                preco_maximo=float(padrao.get("preco_maximo") or 0),
                palavras_obrigatorias=[primeira],
                palavras_proibidas=list(padrao.get("palavras_proibidas") or []),
                reputacao_minima=str(padrao.get("reputacao_minima") or "verde"))
    ctx.produtos.append(p)
    ctx.produtos_alterados = True
    ctx.forcar_busca = True
    ctx.respostas.append(
        f"✅ Cadastrado: <b>{escape(nome)}</b>\nBusca: {escape(busca)}\n"
        f"Preço-alvo: {brl(alvo) if alvo else 'sem alvo (só queda de preço)'}\nLojas: {', '.join(lojas)}\n"
        f"Palavra obrigatória: {escape(primeira)}. A primeira busca roda agora.")


def cmd_lista(ctx: Contexto, arg: str) -> None:
    if not ctx.produtos:
        ctx.respostas.append("Nenhum produto cadastrado. Use /add.")
        return
    linhas = ["<b>Produtos</b>"]
    for p in ctx.produtos:
        atuais = ctx.repo.atuais(p.nome)
        melhor = min(atuais, key=lambda a: a.preco_final) if atuais else None
        status = "▶️" if p.ativo else "⏸"
        preco = f"{brl(melhor.preco_final)} ({ctx.lojas.get(melhor.loja, melhor.loja)})" if melhor else "sem preço ainda"
        alvo = brl(p.preco_alvo) if p.preco_alvo else "sem alvo"
        linhas.append(f"{status} <b>{escape(p.nome)}</b> — agora {preco}; alvo {alvo}; lojas {', '.join(p.lojas)}")
    ctx.respostas.append("\n".join(linhas))


def _mudar_ativo(ctx: Contexto, arg: str, ativo: bool) -> None:
    p = _resolver(ctx, arg)
    if p is None:
        return
    p.ativo = ativo
    ctx.produtos_alterados = True
    ctx.respostas.append(f"{'▶️ Ativado' if ativo else '⏸ Pausado'}: <b>{escape(p.nome)}</b>")


def cmd_remover(ctx: Contexto, arg: str) -> None:
    p = _resolver(ctx, arg)
    if p is None:
        return
    ctx.produtos.remove(p)
    ctx.repo.remover_produto(p.nome)
    ctx.produtos_alterados = True
    ctx.respostas.append(f"🗑 Removido: <b>{escape(p.nome)}</b> (e o histórico dele).")


def cmd_historico(ctx: Contexto, arg: str) -> None:
    p = _resolver(ctx, arg)
    if p is None:
        return
    desde = iso(datetime.now(timezone.utc) - timedelta(days=int(ctx.cfg["historico"]["dias"])))
    png = grafico_produto(p.nome, ctx.repo.historico(p.nome, desde), ctx.lojas, p.preco_alvo, ctx.cfg["fuso"])
    if png is None:
        ctx.respostas.append(f"Ainda não há histórico de <b>{escape(p.nome)}</b>.")
        return
    menor = ctx.repo.menor_preco(p.nome)
    ctx.telegram.enviar_foto(png, f"<b>{escape(p.nome)}</b> — menor preço registrado: {brl(menor)}")


def cmd_buscar(ctx: Contexto, arg: str) -> None:
    ctx.forcar_busca = True
    ctx.respostas.append("🔎 Busca marcada: roda nesta execução.")


COMANDOS = {
    "/add": cmd_add,
    "/lista": cmd_lista,
    "/pausar": lambda c, a: _mudar_ativo(c, a, False),
    "/ativar": lambda c, a: _mudar_ativo(c, a, True),
    "/remover": cmd_remover,
    "/historico": cmd_historico,
    "/buscar": cmd_buscar,
    "/ajuda": lambda c, a: c.respostas.append(AJUDA),
    "/start": lambda c, a: c.respostas.append(AJUDA),
    "/help": lambda c, a: c.respostas.append(AJUDA),
}


def processar(ctx: Contexto) -> None:
    """Lê as atualizações pendentes, executa os comandos do dono e responde."""
    if not ctx.telegram.ativo:
        return
    offset = ctx.repo.estado("telegram_offset")
    atualizacoes = ctx.telegram.atualizacoes(int(offset) if offset else None)
    for upd in atualizacoes:
        ctx.repo.salvar_estado("telegram_offset", str(int(upd["update_id"]) + 1))
        msg = upd.get("message") or {}
        if str((msg.get("chat") or {}).get("id")) != ctx.telegram.chat_id:
            continue  # outro usuário: ignora sem responder
        texto = (msg.get("text") or "").strip()
        if not texto.startswith("/"):
            continue
        cabeca, _, arg = texto.partition(" ")
        cmd = cabeca.split("@")[0].lower()
        acao = COMANDOS.get(cmd)
        if acao is None:
            ctx.respostas.append("Comando desconhecido. Veja /ajuda.")
        else:
            try:
                acao(ctx, arg.strip())
            except Exception as e:  # noqa: BLE001
                log.exception("Erro no comando %s", cmd)
                ctx.respostas.append(f"Erro ao executar {escape(cmd)}: {escape(segredos.sanitizar(e))}")
        for r in ctx.respostas:
            ctx.telegram.enviar(r)
        ctx.respostas.clear()
