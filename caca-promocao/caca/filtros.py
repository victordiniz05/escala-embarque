"""Filtros de anúncio: palavras, condição, preço máximo, EAN e reputação."""
from __future__ import annotations

from .modelos import NIVEIS_REPUTACAO, Oferta, Produto
from .texto import contem_termo

# Indícios de produto não novo no título, independentemente do que o produto proíbe.
NAO_NOVO = ("usado", "seminovo", "recondicionado", "vitrine", "open box", "mostruario")


def motivo_rejeicao_inicial(produto: Produto, o: Oferta) -> str | None:
    """Filtros baratos, antes de consultar frete e reputação. None = passou."""
    if o.condicao is not None and o.condicao != "novo":
        return f"condição {o.condicao}"
    if any(contem_termo(o.titulo, t) for t in NAO_NOVO):
        return "não é novo"
    for t in produto.palavras_obrigatorias:
        if not contem_termo(o.titulo, t):
            return f"falta '{t}'"
    for t in produto.palavras_proibidas:
        if contem_termo(o.titulo, t):
            return f"contém '{t}'"
    if produto.ean and o.ean and o.ean != produto.ean:
        return "EAN diferente"
    if produto.preco_maximo > 0 and o.preco_base > produto.preco_maximo:
        return "acima do preço máximo"
    return None


def motivo_rejeicao_final(produto: Produto, o: Oferta) -> str | None:
    """Depois de completar frete e reputação."""
    if produto.preco_maximo > 0 and o.preco_final > produto.preco_maximo:
        return "preço final acima do máximo"
    minimo = NIVEIS_REPUTACAO.get(produto.reputacao_minima)
    # Reputação desconhecida não é motivo para descartar: aparece "a confirmar" no alerta.
    if minimo and o.reputacao in NIVEIS_REPUTACAO and NIVEIS_REPUTACAO[o.reputacao] < minimo:
        return f"reputação {o.reputacao} abaixo da mínima"
    return None
