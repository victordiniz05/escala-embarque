"""Lojas disponíveis. Para adicionar uma loja, crie lojas/<nome>.py com uma subclasse de Loja.

A descoberta é automática: qualquer subclasse de `Loja` com `nome` definido em um
módulo deste pacote é registrada.
"""
from __future__ import annotations

import importlib
import pkgutil

from .base import Loja


def carregar_lojas() -> dict[str, Loja]:
    lojas: dict[str, Loja] = {}
    for mod in pkgutil.iter_modules(__path__):
        if mod.name.startswith("_") or mod.name == "base":
            continue
        modulo = importlib.import_module(f"{__name__}.{mod.name}")
        for obj in vars(modulo).values():
            if isinstance(obj, type) and issubclass(obj, Loja) and obj is not Loja and getattr(obj, "nome", ""):
                lojas[obj.nome] = obj()
    return lojas
