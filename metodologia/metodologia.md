# Metodologia

## 1. Objetivo do painel

Este dashboard acompanha a execução mensal de financiamentos dos fundos constitucionais e de instrumentos de crédito associados ao Programa Amazônia Azul, considerando apenas os municípios elegíveis ao Programa.

O painel foi estruturado para uso público. Por isso, a versão publicada no GitHub Pages utiliza dados agregados e compactados, sem disponibilizar o Excel bruto de financiamentos.

## 2. Fontes de dados

A construção da versão pública utiliza três conjuntos de dados:

1. **Base financeira agregada**: arquivo JSON gerado a partir da base original dos fundos. Nesta versão inicial, a fonte é o arquivo FNE de janeiro a março de 2026, pré-processado antes da publicação.
2. **Tipologia territorial Amazônia Azul**: arquivo JSON mínimo derivado da planilha `Tipologia Amazônia Azul (v5).xlsx`, preservando apenas código do município, nome, UF, macrorregião e tipologia territorial.
3. **GeoJSON local**: arquivo `data/geo/municipios_amazonia_azul.geojson`, com centroides municipais dos municípios elegíveis.

## 3. Proteção da base bruta

A base original de operações não é publicada no repositório. O arquivo público contém somente linhas agregadas por combinações de variáveis analíticas. Isso permite manter o painel leve, compatível com GitHub Pages e sem disponibilizar registros individuais para download.

A base agregada preserva as medidas necessárias ao monitoramento:

- valor contratado;
- quantidade de beneficiários;
- quantidade de contratos;
- quantidade de registros originais agregados em cada linha compacta.

## 4. Universo territorial

O universo do painel é formado pelos municípios presentes na tipologia territorial do Programa Amazônia Azul.

O procedimento é:

1. Ler a lista de municípios elegíveis da tipologia territorial.
2. Padronizar o código IBGE municipal com sete dígitos.
3. Manter apenas operações financeiras cujo município esteja presente nesse universo elegível.
4. Associar cada operação à sua tipologia territorial.
5. Agregar os registros antes da publicação.

## 5. Diferença entre atividade Amazônia Azul e tipologia territorial

O painel diferencia duas variáveis conceitualmente distintas:

| Variável | Origem | Interpretação |
|---|---|---|
| Atividade vinculada à Amazônia Azul | Base financeira original | Indica se a atividade/CNAE financiada foi classificada como vinculada ao Programa |
| Tipologia territorial Amazônia Azul | Arquivo de tipologia territorial | Classifica a prioridade territorial do município elegível |

Essa distinção evita confundir a natureza da operação financiada com a prioridade territorial do município.

## 6. Agregação pública

A base pública foi agregada por:

- fundo;
- mês de contratação;
- UF;
- município;
- macrorregião geográfica;
- tipologia PNDR;
- tipologia territorial Amazônia Azul;
- atividade vinculada à Amazônia Azul;
- setor;
- programa;
- linha de financiamento;
- atividade;
- CNAE;
- porte;
- finalidade da operação;
- natureza do contratante;
- sexo;
- instituição operadora;
- faixa de taxa de juros.

A taxa de juros é publicada em faixas, e não como valor individual de cada operação.

## 7. Indicadores absolutos

Os indicadores absolutos são calculados por soma simples dentro da seleção atual:

```text
Valor contratado = soma dos valores contratados
Beneficiários = soma da quantidade de beneficiários
Contratos = soma da quantidade de contratos
```

## 8. Participação das atividades vinculadas à Amazônia Azul

A participação das atividades vinculadas à Amazônia Azul é calculada dentro do universo de municípios elegíveis:

```text
Participação Amazônia Azul no valor =
valor das operações classificadas como Amazônia Azul / valor total das operações nos municípios elegíveis
```

A mesma lógica é aplicada para beneficiários e contratos.

## 9. Participação feminina

A participação feminina é calculada a partir das linhas classificadas como `Mulheres` no campo sexo:

```text
Participação feminina no valor =
valor associado a mulheres / valor total da seleção
```

A mesma lógica é aplicada para beneficiários e contratos.

Registros sem sexo informado, pessoas jurídicas ou situações não aplicáveis não entram no numerador feminino.

## 10. Janelas temporais

O usuário seleciona um mês de referência. A partir dele, o dashboard calcula quatro janelas:

- mês selecionado;
- trimestre: mês selecionado e dois meses anteriores;
- semestre: mês selecionado e cinco meses anteriores;
- últimos 12 meses: mês selecionado e onze meses anteriores.

## 11. Crescimento ou redução

O crescimento é calculado comparando a janela selecionada com a janela imediatamente anterior de mesmo tamanho:

```text
Crescimento = (indicador da janela atual - indicador da janela anterior) / indicador da janela anterior
```

Se a janela anterior estiver incompleta ou sem valor, o painel exibe `N.D.`.

## 12. Rankings e treemaps

Os rankings e treemaps são recalculados conforme os filtros ativos e podem usar como medida principal:

- valor contratado;
- beneficiários;
- contratos.

Os treemaps setoriais usam hierarquia:

```text
Setor > Atividade > CNAE
```

Os treemaps territoriais usam hierarquia:

```text
Macrorregião > UF > Município
```

## 13. Dispersão e boxplot

A dispersão CNAE relaciona:

- eixo X: quantidade de contratos;
- eixo Y: valor contratado;
- tamanho da bolha: beneficiários;
- cor: dimensão selecionada.

O boxplot compara distribuições por grupos, como macrorregião, UF, tipologia territorial, setor, programa, porte ou finalidade.

## 14. Mapas

A versão pública inclui um GeoJSON local com centroides municipais dos 757 municípios elegíveis.

O arquivo usado é:

```text
data/geo/municipios_amazonia_azul.geojson
```

O mapa exibe círculos proporcionais e coloridos por indicador. As cores representam intensidade, participação ou crescimento/redução, conforme a opção selecionada.

Caso seja necessário um mapa coroplético poligonal, o arquivo de pontos pode ser substituído por um GeoJSON municipal simplificado com polígonos. Para isso, a geometria deve conter código IBGE municipal de sete dígitos em uma das propriedades reconhecidas pelo dashboard, como `codigo_ibge` ou `CD_MUN`.

## 15. Tabela analítica

A opção mais desagregada da tabela exibe linhas agregadas compactas, não registros individuais da base original.

Essa decisão é necessária para:

- manter o arquivo público abaixo do limite prático de tamanho;
- evitar disponibilizar a base bruta;
- preservar a capacidade de filtros, rankings e exportação da seleção agregada.

## 16. Atualização mensal

A atualização mensal deve ser feita fora do GitHub Pages:

1. Manter os Excel brutos em ambiente local ou privado.
2. Executar o script `scripts/preprocessar_dados.py`.
3. Gerar novo arquivo JSON agregado em `data/processed/`.
4. Atualizar `data/manifest.json`.
5. Publicar apenas os arquivos processados.

## 17. Limitações

- A versão pública não permite reconstruir operações individuais do Excel original.
- A taxa de juros é publicada em faixas.
- O mapa local usa centroides municipais; não substitui uma malha poligonal oficial quando o objetivo for análise cartográfica fina de área.
- Crescimentos de trimestre, semestre e 12 meses exigem série histórica suficiente; nos primeiros meses, alguns indicadores podem aparecer como indisponíveis.
