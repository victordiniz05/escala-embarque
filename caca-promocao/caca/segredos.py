"""Leitura de segredos do ambiente e mascaramento em logs/erros.

Tokens, CEP e chat_id só existem em variáveis de ambiente (Secrets do GitHub).
Tudo que vai para log, banco ou arquivo commitado passa por `sanitizar`.
"""
from __future__ import annotations

import os

NOMES_SENSIVEIS = (
    "TELEGRAM_TOKEN",
    "TELEGRAM_CHAT_ID",
    "CEP_DESTINO",
    "MERCADOLIVRE_ACCESS_TOKEN",
    "MERCADOLIVRE_CLIENT_ID",
    "MERCADOLIVRE_CLIENT_SECRET",
    "MERCADOLIVRE_REFRESH_TOKEN",
    "AMAZON_CREDENTIAL_ID",
    "AMAZON_CREDENTIAL_SECRET",
    "AMAZON_PARTNER_TAG",
    "KABUM_FEED_URL",
)

_extras: set[str] = set()


def obter(nome: str) -> str:
    return (os.environ.get(nome) or "").strip()


def registrar_valor_sensivel(valor: str) -> None:
    """Para valores obtidos em tempo de execução (ex.: token renovado)."""
    if valor and len(valor) >= 4:
        _extras.add(valor)


def sanitizar(texto: object) -> str:
    s = str(texto)
    valores = {obter(n) for n in NOMES_SENSIVEIS} | _extras
    cep = obter("CEP_DESTINO")
    if cep:
        valores.add(cep.replace("-", ""))
    for v in sorted((v for v in valores if v and len(v) >= 4), key=len, reverse=True):
        s = s.replace(v, "***")
    return s
