from __future__ import annotations

from typing import Any


def pegar(d: Any, caminho: str, padrao: Any = None) -> Any:
    """pegar(d, "a.b.0.c") sem quebrar se algo faltar."""
    atual = d
    for parte in caminho.split("."):
        if isinstance(atual, dict):
            atual = atual.get(parte)
        elif isinstance(atual, list) and parte.isdigit() and int(parte) < len(atual):
            atual = atual[int(parte)]
        else:
            return padrao
        if atual is None:
            return padrao
    return atual


def para_float(v: Any) -> float | None:
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace("R$", "").replace(" ", "")
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None
