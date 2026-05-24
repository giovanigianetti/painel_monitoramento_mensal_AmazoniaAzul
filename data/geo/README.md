# Malhas geográficas

A aba **Mapas** carrega, em tempo de execução, malhas de polígonos municipais e estaduais. A ordem de carregamento foi ajustada para priorizar a API de Malhas Geográficas do IBGE e, somente em caso de falha, usar arquivos locais ou remotos do padrão PNDR_4/geodata-br.

O carregador valida cada fonte antes de renderizar: rejeita malhas de pontos, geometrias não poligonais, arquivos com poucos polígonos, coordenadas fora do padrão longitude/latitude do Brasil e arquivos municipais sem códigos suficientes para associação aos dados agregados.

Arquivos locais opcionais podem ser colocados nesta pasta, desde que estejam em GeoJSON ou TopoJSON com polígonos municipais/UFs válidos:

- `municipios_ibge_topo.json`
- `ufs_ibge_topo.json`
- `municipios.geojson`
- `ufs.geojson`
