# Malhas geográficas

A aba Mapas tenta carregar, em ordem, malhas locais, malhas da pasta `maps/`, malhas remotas do PNDR_4 e fallbacks públicos. Para operação mais robusta em GitHub Pages, recomenda-se copiar para esta pasta:

- `municipios_ibge_topo.json`
- `ufs_ibge_topo.json`

Os arquivos podem ser copiados do repositório PNDR_4 ou baixados com `python scripts/baixar_malhas_pndr4.py` quando houver acesso à internet. O código também aceita `municipios.geojson` e `ufs.geojson`.
