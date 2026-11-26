"""Formatação das mensagens do Telegram (HTML)."""
from __future__ import annotations

from html import escape

from .analise import Avaliacao
from .modelos import ROTULO_REPUTACAO, Oferta, Produto

A_CONFIRMAR = "a confirmar"


def brl(v: float | None) -> str:
    if v is None:
        return A_CONFIRMAR
    s = f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {s}"


def selos(o: Oferta) -> str:
    s = []
    if o.oficial:
        s.append("🏷 Oficial")
    if o.full:
        s.append("⚡ Full")
    return " · ".join(s)


def _frete(o: Oferta) -> str:
    if o.frete is None:
        return A_CONFIRMAR
    return "grátis" if o.frete == 0 else brl(o.frete)


def _reputacao(o: Oferta) -> str:
    return ROTULO_REPUTACAO.get(o.reputacao or "", A_CONFIRMAR)


def mensagem_alerta(produto: Produto, avaliacoes: list[Avaliacao], nomes_lojas: dict[str, str],
                    menor_registrado: float | None) -> str:
    """Uma mensagem por grupo (mesmo produto em várias lojas), melhor preço primeiro."""
    melhor = avaliacoes[0]
    o = melhor.oferta
    motivos = []
    if any(a.abaixo_alvo for a in avaliacoes):
        motivos.append("no preço-alvo ou abaixo")
    if any(a.queda for a in avaliacoes):
        motivos.append("queda forte em relação à média")
    pct = f"{melhor.pct_abaixo_media:.1f}%" if melhor.pct_abaixo_media is not None else "sem média ainda"
    if melhor.pct_abaixo_media is not None and melhor.pct_abaixo_media < 0:
        pct = f"{-melhor.pct_abaixo_media:.1f}% acima da média"
    linhas = [
        f"🔥 <b>{escape(produto.nome)}</b> — {escape(', '.join(motivos))}",
        "",
        f"🥇 <b>{escape(nomes_lojas.get(o.loja, o.loja))}</b>" + (f"  {selos(o)}" if selos(o) else ""),
        f"<i>{escape(o.titulo[:140])}</i>",
        f"Preço atual: {brl(o.preco)}" + (f" (PIX {brl(o.preco_pix)})" if o.preco_pix and o.preco_pix < o.preco else ""),
        f"Frete: {_frete(o)}",
        f"<b>Preço final: {brl(o.preco_final)}</b>" + ("" if o.frete_confirmado else " + frete a confirmar"),
        f"Preço-alvo: {brl(produto.preco_alvo) if produto.preco_alvo > 0 else 'sem alvo'}",
        f"Menor preço já registrado: {brl(menor_registrado) if menor_registrado is not None else 'primeiro registro'}",
        f"Abaixo da média de 30 dias: {pct}",
        f"Vendedor: reputação {_reputacao(o)}" + (f" · {escape(o.vendedor)}" if o.vendedor and not o.vendedor.isdigit() else ""),
        f"Estoque: {o.estoque if o.estoque is not None else A_CONFIRMAR}",
        f'🔗 <a href="{escape(o.link, quote=True)}">Ver oferta</a>',
    ]
    outros = avaliacoes[1:6]
    if outros:
        linhas += ["", "<b>Outras lojas</b> (do mais barato para o mais caro):"]
        for a in outros:
            x = a.oferta
            extra = f" {selos(x)}" if selos(x) else ""
            linhas.append(
                f"• {escape(nomes_lojas.get(x.loja, x.loja))}{extra}: <b>{brl(x.preco_final)}</b>"
                f" (frete {_frete(x)}) — <a href=\"{escape(x.link, quote=True)}\">link</a>")
        if len(avaliacoes) > 6:
            linhas.append(f"• e mais {len(avaliacoes) - 6} anúncio(s)")
    return "\n".join(linhas)


def mensagem_saude(loja: str, falhas: int, erro: str) -> str:
    return (f"⚠️ <b>{escape(loja)}</b> falhou nas últimas {falhas} execuções seguidas.\n"
            f"Último erro: <code>{escape(erro[:300])}</code>\n"
            "As outras lojas continuam funcionando.")


def mensagem_saude_ok(loja: str) -> str:
    return f"✅ <b>{escape(loja)}</b> voltou a responder normalmente."
