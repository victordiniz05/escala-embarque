"""Normalização de texto e busca de palavras inteiras."""
from __future__ import annotations

import re
import unicodedata


def normalizar(texto: str) -> str:
    """Minúsculas, sem acentos e com espaços simples."""
    sem_acento = unicodedata.normalize("NFKD", texto or "")
    sem_acento = "".join(c for c in sem_acento if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", sem_acento.lower()).strip()


def contem_termo(titulo: str, termo: str) -> bool:
    """Procura o termo como palavra (ou frase) inteira, aceitando plural simples.

    "capa" casa com "capa" e "capas", mas não com "capacidade".
    """
    termo_n = normalizar(termo)
    if not termo_n:
        return False
    padrao = r"\b" + re.escape(termo_n).replace(r"\ ", r"\s+") + r"(?:s|es)?\b"
    return re.search(padrao, normalizar(titulo)) is not None


def mesmo_nome(a: str, b: str) -> bool:
    return normalizar(a) == normalizar(b)
