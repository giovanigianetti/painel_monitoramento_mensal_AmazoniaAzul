"""Baixa malhas TopoJSON do repositório PNDR_4 para uso local no dashboard.
Execute a partir da raiz do repositório: python scripts/baixar_malhas_pndr4.py
"""
from pathlib import Path
from urllib.request import urlretrieve

BASE = "https://raw.githubusercontent.com/giovanigianetti/PNDR_4/main/maps/"
FILES = ["municipios_ibge_topo.json", "ufs_ibge_topo.json", "manifest_malhas.json"]
out = Path("data/geo")
out.mkdir(parents=True, exist_ok=True)
for f in FILES:
    url = BASE + f
    dest = out / f
    print(f"Baixando {url} -> {dest}")
    urlretrieve(url, dest)
print("Concluído.")
