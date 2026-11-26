"""caca-promocao: busca preços uma vez e encerra.

    python main.py --once            # execução normal (o workflow usa esta)
    python main.py --once --forcar   # busca agora, mesmo fora do intervalo
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from caca import segredos
from caca.monitor import Opcoes, executar


class FiltroSegredos(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = segredos.sanitizar(record.getMessage())
        record.args = ()
        return True


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--once", action="store_true", help="faz uma execução e encerra (único modo suportado)")
    ap.add_argument("--forcar", action="store_true", help="busca agora, ignorando o intervalo")
    ap.add_argument("--site", type=Path, help="pasta de saída do painel (padrão: site/)")
    ap.add_argument("--refresh-ml-saida", type=Path, default=Path(".ml_refresh_token"),
                    help="onde gravar o refresh token renovado do Mercado Livre")
    a = ap.parse_args()
    if not a.once:
        ap.error("use --once: o agendamento é feito pelo GitHub Actions")

    h = logging.StreamHandler(sys.stdout)
    h.addFilter(FiltroSegredos())
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", handlers=[h])
    try:
        return executar(Opcoes(forcar=a.forcar, site=a.site, arquivo_refresh_ml=a.refresh_ml_saida))
    except Exception as e:  # noqa: BLE001
        logging.getLogger("caca").error("Erro inesperado: %s", segredos.sanitizar(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())
