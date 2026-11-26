"""Painel estático para o GitHub Pages (pasta site/, publicada pelo workflow).

Mostra só dados públicos: produto, preços, lojas e links. Nada de CEP ou chat_id.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from html import escape
from pathlib import Path
from zoneinfo import ZoneInfo

from .analise import de_iso, iso
from .db.base import Repositorio
from .graficos import grafico_produto
from .mensagens import brl
from .modelos import Produto
from .texto import normalizar


def _slug(nome: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", normalizar(nome)).strip("-") or "produto"


CSS = """
:root{--bg:#f6f6f4;--card:#ffffff;--text:#191919;--muted:#666666;--line:#e3e3e0;--accent:#257de0;--good:#008a17}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#121212;--card:#1d1d1d;--text:#efefef;--muted:#9c9c9c;--line:#333333;--accent:#338ced;--good:#0aac23}}
:root[data-theme="dark"]{--bg:#121212;--card:#1d1d1d;--text:#efefef;--muted:#9c9c9c;--line:#333333;--accent:#338ced;--good:#0aac23}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:960px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:1.6rem;margin:0 0 4px}
.sub{color:var(--muted);margin:0 0 24px;font-size:.9rem}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:20px}
.card h2{margin:0 0 8px;font-size:1.2rem}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:12px 0}
.tile .k{color:var(--muted);font-size:.8rem}
.tile .v{font-size:1.25rem;font-weight:600;font-variant-numeric:tabular-nums}
.tile .v.good{color:var(--good)}
.chart{display:block;background:#fff;border-radius:8px;overflow:hidden;margin:8px 0}
.chart img{display:block;width:100%;height:auto}
.wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:.9rem;font-variant-numeric:tabular-nums}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
th{color:var(--muted);font-weight:500}
td.num,th.num{text-align:right}
a{color:var(--accent)}
.pill{display:inline-block;font-size:.75rem;padding:1px 8px;border-radius:99px;border:1px solid var(--line);color:var(--muted)}
"""


def gerar_painel(repo: Repositorio, produtos: list[Produto], nomes_lojas: dict[str, str], cfg: dict,
                 destino: Path, agora: datetime | None = None) -> None:
    agora = agora or datetime.now(timezone.utc)
    tz = ZoneInfo(cfg["fuso"])
    (destino / "graficos").mkdir(parents=True, exist_ok=True)
    desde = iso(agora - timedelta(days=int(cfg["historico"]["dias"])))
    cartoes, dados = [], []
    for p in produtos:
        atuais = sorted(repo.atuais(p.nome), key=lambda a: a.preco_final)
        menor = repo.menor_preco(p.nome)
        melhor = atuais[0] if atuais else None
        slug = _slug(p.nome)
        png = grafico_produto(p.nome, repo.historico(p.nome, desde), nomes_lojas, p.preco_alvo, cfg["fuso"])
        if png:
            (destino / "graficos" / f"{slug}.png").write_bytes(png)
        dados.append({
            "produto": p.nome, "ativo": p.ativo, "preco_alvo": p.preco_alvo or None,
            "menor_preco_registrado": menor,
            "melhor_atual": None if not melhor else {
                "loja": melhor.loja, "preco_final": melhor.preco_final, "frete": melhor.frete, "link": melhor.link},
        })
        linhas = "".join(
            f"<tr><td>{escape(nomes_lojas.get(a.loja, a.loja))}</td><td>{escape(a.titulo[:70])}</td>"
            f"<td class=num>{brl(a.preco)}</td><td class=num>{'grátis' if a.frete == 0 else brl(a.frete)}</td>"
            f"<td class=num><b>{brl(a.preco_final)}</b></td>"
            f"<td><a href=\"{escape(a.link, quote=True)}\" rel=\"noopener nofollow\" target=\"_blank\">abrir</a></td></tr>"
            for a in atuais[:10])
        tabela = (f"<div class=wrap><table><thead><tr><th>Loja</th><th>Anúncio</th><th class=num>Preço</th>"
                  f"<th class=num>Frete</th><th class=num>Final</th><th></th></tr></thead><tbody>{linhas}"
                  f"</tbody></table></div>") if atuais else "<p class=sub>Nenhum anúncio encontrado ainda.</p>"
        grafico = (f'<a class=chart href="graficos/{slug}.png"><img src="graficos/{slug}.png" '
                   f'alt="Histórico de preços de {escape(p.nome)}" loading="lazy"></a>') if png else ""
        bom = melhor is not None and menor is not None and melhor.preco_final <= menor + 0.005
        cartoes.append(f"""
<section class=card>
  <h2>{escape(p.nome)} {'' if p.ativo else '<span class=pill>pausado</span>'}</h2>
  <div class=tiles>
    <div class=tile><div class=k>Melhor preço agora</div><div class="v{' good' if bom else ''}">{brl(melhor.preco_final) if melhor else '—'}</div>
      <div class=k>{escape(nomes_lojas.get(melhor.loja, melhor.loja)) if melhor else ''}</div></div>
    <div class=tile><div class=k>Menor preço registrado</div><div class=v>{brl(menor) if menor is not None else '—'}</div></div>
    <div class=tile><div class=k>Preço-alvo</div><div class=v>{brl(p.preco_alvo) if p.preco_alvo else 'sem alvo'}</div></div>
  </div>
  {grafico}
  {tabela}
</section>""")
    atualizado = agora.astimezone(tz).strftime("%d/%m/%Y %H:%M")
    ultima = repo.estado("ultima_busca")
    ultima_txt = de_iso(ultima).astimezone(tz).strftime("%d/%m/%Y %H:%M") if ultima else "—"
    html = f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Caça-promoção</title>
<style>{CSS}</style></head>
<body><main>
<h1>Caça-promoção</h1>
<p class=sub>Última busca: {ultima_txt} · página gerada em {atualizado} (horário de Brasília). Preço final = preço (PIX quando informado) + frete; frete “a confirmar” quando a loja não informa.</p>
{''.join(cartoes) or '<p>Nenhum produto cadastrado.</p>'}
</main></body></html>
"""
    (destino / "index.html").write_text(html, encoding="utf-8")
    (destino / "dados.json").write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")
