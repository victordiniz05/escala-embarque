"""Sessão HTTP com timeout e novas tentativas em erros temporários."""
from __future__ import annotations

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

TIMEOUT = 20


def nova_sessao() -> requests.Session:
    s = requests.Session()
    retry = Retry(total=3, backoff_factor=1.5, status_forcelist=(429, 500, 502, 503, 504),
                  allowed_methods=("GET", "POST"), respect_retry_after_header=True)
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.headers["User-Agent"] = "caca-promocao/1.0 (+monitor pessoal de precos)"
    return s
