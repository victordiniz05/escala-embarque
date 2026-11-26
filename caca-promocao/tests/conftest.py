import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

SENSIVEIS = ["TELEGRAM_TOKEN", "TELEGRAM_CHAT_ID", "CEP_DESTINO", "MERCADOLIVRE_ACCESS_TOKEN",
             "MERCADOLIVRE_CLIENT_ID", "MERCADOLIVRE_CLIENT_SECRET", "MERCADOLIVRE_REFRESH_TOKEN",
             "AMAZON_CREDENTIAL_ID", "AMAZON_CREDENTIAL_SECRET", "AMAZON_PARTNER_TAG", "KABUM_FEED_URL"]


@pytest.fixture(autouse=True)
def ambiente_limpo(monkeypatch):
    for n in SENSIVEIS:
        monkeypatch.delenv(n, raising=False)
