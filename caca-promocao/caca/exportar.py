"""data/precos_atuais.csv: formato estável para o histórico de commits virar histórico de preços.

- Ordenado por produto, loja, preço final e link.
- A coluna "data" é quando aquele preço começou a valer (não a hora da execução),
  então o arquivo só muda quando algum preço muda.
- Frete desconhecido fica vazio (nunca zero inventado).
- Não contém CEP, chat_id nem qualquer dado pessoal.
"""
from __future__ import annotations

import csv
from pathlib import Path

from .db.base import Repositorio

COLUNAS = ["produto", "loja", "preco", "frete", "preco_final", "data", "link"]


def _f(v: float | None) -> str:
    return "" if v is None else f"{v:.2f}"


def exportar_csv(repo: Repositorio, caminho: Path) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    linhas = sorted(repo.atuais(), key=lambda a: (a.produto, a.loja, a.preco_final, a.link))
    tmp = caminho.with_suffix(".csv.tmp")
    with tmp.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(COLUNAS)
        for a in linhas:
            w.writerow([a.produto, a.loja, _f(a.preco), _f(a.frete), _f(a.preco_final), a.desde, a.link])
    tmp.replace(caminho)
