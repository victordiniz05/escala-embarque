"""Camada de dados. Use `abrir_repositorio(cfg)`; o resto do código não sabe qual banco é."""
from __future__ import annotations

from pathlib import Path

from .base import Repositorio


def abrir_repositorio(cfg: dict, raiz: Path) -> Repositorio:
    tipo = (cfg.get("banco") or {}).get("tipo", "sqlite")
    if tipo == "sqlite":
        from .sqlite import RepositorioSQLite

        return RepositorioSQLite(raiz / cfg["banco"]["caminho"])
    raise ValueError(f"Banco não suportado: {tipo}. Implemente caca/db/{tipo}.py seguindo base.py.")
