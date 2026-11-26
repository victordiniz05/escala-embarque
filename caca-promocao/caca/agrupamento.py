"""Agrupa anúncios do mesmo produto entre lojas: pelo EAN, ou por semelhança de título."""
from __future__ import annotations

from difflib import SequenceMatcher

from .modelos import Oferta
from .texto import normalizar


def _chave_titulo(titulo: str) -> str:
    return " ".join(sorted(set(normalizar(titulo).split())))


def agrupar(ofertas: list[Oferta], limiar: float = 0.8) -> list[list[Oferta]]:
    """Retorna grupos ordenados pelo melhor preço final; dentro do grupo, o mais barato primeiro."""
    n = len(ofertas)
    pai = list(range(n))

    def raiz(i: int) -> int:
        while pai[i] != i:
            pai[i] = pai[pai[i]]
            i = pai[i]
        return i

    chaves = [_chave_titulo(o.titulo) for o in ofertas]
    for i in range(n):
        for j in range(i + 1, n):
            a, b = ofertas[i], ofertas[j]
            if a.ean and b.ean:
                mesmo = a.ean == b.ean
            else:
                mesmo = SequenceMatcher(None, chaves[i], chaves[j]).ratio() >= limiar
            if mesmo:
                pai[raiz(i)] = raiz(j)

    grupos: dict[int, list[Oferta]] = {}
    for i, o in enumerate(ofertas):
        grupos.setdefault(raiz(i), []).append(o)
    saida = [sorted(g, key=lambda o: (o.preco_final, o.loja)) for g in grupos.values()]
    return sorted(saida, key=lambda g: g[0].preco_final)
