"""Cliente mínimo da Bot API do Telegram.

Sem TELEGRAM_TOKEN/TELEGRAM_CHAT_ID, roda em modo seco: só registra no log.
A URL da API contém o token, então todo erro passa por `sanitizar`.
"""
from __future__ import annotations

import logging

import requests

from . import segredos
from .http import TIMEOUT, nova_sessao

log = logging.getLogger(__name__)
LIMITE = 4000


class Telegram:
    def __init__(self, token: str | None = None, chat_id: str | None = None):
        self.token = token if token is not None else segredos.obter("TELEGRAM_TOKEN")
        self.chat_id = chat_id if chat_id is not None else segredos.obter("TELEGRAM_CHAT_ID")
        self.sessao = nova_sessao()

    @property
    def ativo(self) -> bool:
        return bool(self.token and self.chat_id)

    def _chamar(self, metodo: str, **kw) -> dict | None:
        if not self.ativo:
            return None
        try:
            r = self.sessao.post(f"https://api.telegram.org/bot{self.token}/{metodo}", timeout=TIMEOUT + 10, **kw)
            dados = r.json()
        except (requests.RequestException, ValueError) as e:
            raise RuntimeError(segredos.sanitizar(f"Telegram {metodo}: {e}")) from None
        if not dados.get("ok"):
            raise RuntimeError(segredos.sanitizar(f"Telegram {metodo}: {dados.get('description')}"))
        return dados

    def enviar(self, texto: str) -> bool:
        """Envia texto (HTML). Retorna True se enviou de fato."""
        if not self.ativo:
            log.info("[modo seco] Telegram:\n%s", texto)
            return False
        partes, atual = [], ""
        for linha in texto.split("\n"):
            if len(atual) + len(linha) + 1 > LIMITE:
                partes.append(atual)
                atual = ""
            atual += linha + "\n"
        partes.append(atual)
        for p in partes:
            if p.strip():
                self._chamar("sendMessage", data={"chat_id": self.chat_id, "text": p, "parse_mode": "HTML",
                                                   "disable_web_page_preview": "true"})
        return True

    def enviar_foto(self, png: bytes, legenda: str = "") -> bool:
        if not self.ativo:
            log.info("[modo seco] Telegram foto (%d bytes): %s", len(png), legenda)
            return False
        self._chamar("sendPhoto", data={"chat_id": self.chat_id, "caption": legenda[:1000], "parse_mode": "HTML"},
                     files={"photo": ("grafico.png", png, "image/png")})
        return True

    def atualizacoes(self, offset: int | None) -> list[dict]:
        if not self.ativo:
            return []
        params = {"timeout": 0, "allowed_updates": '["message"]'}
        if offset is not None:
            params["offset"] = offset
        dados = self._chamar("getUpdates", data=params)
        return (dados or {}).get("result", [])
