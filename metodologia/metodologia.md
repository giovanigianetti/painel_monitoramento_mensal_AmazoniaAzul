# Metodologia do dashboard

## Objetivo

O dashboard monitora a execução mensal de financiamentos dos Fundos Constitucionais e instrumentos associados ao Programa Amazônia Azul, com foco em municípios elegíveis, atividades vinculadas ao Programa, participação feminina e evolução territorial da execução.

## Fontes de dados

A base inicial de operações corresponde ao arquivo do FNE com contratações de janeiro a março de 2026. O arquivo bruto não é publicado no dashboard. Ele é usado apenas localmente pelo script de pré-processamento para gerar arquivos públicos agregados e codificados.

A tipologia territorial é extraída do arquivo `Tipologia Amazônia Azul (v5).xlsx`, utilizando o código do município, nome, UF e a coluna `Tipologia Amazônia Azul`.

## Município elegível e atividade vinculada à Amazônia Azul

O dashboard diferencia duas dimensões:

1. **Município elegível ao Programa Amazônia Azul**: município presente na base territorial de tipologia do Programa.
2. **Atividade vinculada à Amazônia Azul**: variável `TIPOLOGIA AMAZÔNIA AZUL` da base de financiamentos, com valores `Sim` ou `Não`, indicando se a atividade financiada é classificada como vinculada ao Programa.

Essa distinção é essencial: um município pode ser elegível, mas nem toda operação localizada nele necessariamente financia atividade vinculada à Amazônia Azul.

## Dados públicos agregados

A base bruta é transformada em `data/processed/operacoes_agregadas_publicas.json`. Esse arquivo contém apenas combinações agregadas por mês, território e dimensões analíticas. Os valores publicados são somas agregadas de:

- valor contratado;
- beneficiários;
- contratos;
- número de registros agregados.

O arquivo é codificado por dicionários de categorias para reduzir tamanho e evitar a disponibilização da base original.

## Denominadores gerais

Diferentemente da primeira versão, o pré-processamento preserva agregações de municípios elegíveis e não elegíveis. Isso permite calcular:

- participação dos municípios elegíveis no total geral da base;
- participação das atividades vinculadas à Amazônia Azul no total geral da base;
- participação das atividades vinculadas à Amazônia Azul dentro dos municípios elegíveis.

As fórmulas centrais são:

```text
Participação dos municípios elegíveis = indicador nos municípios elegíveis / indicador total da base
```

```text
Participação das atividades Amazônia Azul no total geral = indicador em atividades Amazônia Azul / indicador total da base
```

```text
Participação das atividades Amazônia Azul nos municípios elegíveis = indicador em atividades Amazônia Azul nos municípios elegíveis / indicador total nos municípios elegíveis
```

## Indicadores

Os indicadores absolutos são calculados por soma:

```text
Valor contratado = soma do valor contratado
Beneficiários = soma da quantidade de beneficiários
Contratos = soma da quantidade de contratos
```

Os indicadores de participação das atividades vinculadas à Amazônia Azul são:

```text
% valor Amazônia Azul = valor das atividades Amazônia Azul / valor total
% beneficiários Amazônia Azul = beneficiários das atividades Amazônia Azul / beneficiários totais
% contratos Amazônia Azul = contratos das atividades Amazônia Azul / contratos totais
```

A participação feminina é calculada com registros identificados como sexo feminino no numerador. Pessoas jurídicas, registros sem informação de sexo ou categorias não informadas permanecem no denominador quando compõem o total da execução.

```text
% valor mulheres = valor contratado por mulheres / valor contratado total
% beneficiários mulheres = beneficiários mulheres / beneficiários totais
% contratos mulheres = contratos mulheres / contratos totais
```

## Janelas temporais

O usuário seleciona um mês de referência e uma janela:

- mês;
- trimestre;
- semestre;
- últimos 12 meses.

A janela é construída como o mês selecionado e os meses anteriores necessários para completar o intervalo. A variação é calculada contra a janela imediatamente anterior de mesmo tamanho.

```text
Crescimento = (indicador da janela atual - indicador da janela anterior) / indicador da janela anterior
```

Para participações, também é calculada a variação em pontos percentuais.

## Visão geral

A Visão geral apresenta:

- totais nos municípios elegíveis;
- valores absolutos das atividades vinculadas à Amazônia Azul;
- participação dessas atividades no total dos municípios elegíveis;
- participação dos municípios elegíveis no total geral da base;
- participação das atividades vinculadas à Amazônia Azul no total geral;
- evolução temporal separada para valor, beneficiários e contratos;
- comparação territorial com Brasil, macrorregiões e território selecionado;
- leitura automática da seleção atual.

## Visão detalhada

A aba Visão detalhada substitui os treemaps por rankings Top 10 e Bottom 10. As dimensões incluem setor, programa, linha de financiamento, atividade, CNAE, porte, finalidade, UF, município, macrorregião, tipologia territorial, instituição operadora, natureza do contratante e sexo.

Os rankings podem ser ordenados por valores absolutos, participações das atividades Amazônia Azul, participação feminina e crescimento.

## Indicadores chave

A aba Indicadores chave substitui a antiga aba de dispersão. Ela inclui:

- participação por tipologia territorial da Amazônia Azul;
- contagem de territórios que aumentaram em termos absolutos nas atividades vinculadas à Amazônia Azul;
- contagem de territórios que aumentaram a participação relativa das atividades vinculadas à Amazônia Azul;
- evolução das tipologias territoriais ao longo do tempo;
- comparação entre território selecionado e benchmark territorial.

O benchmarking compara o território selecionado com Brasil, macrorregião, UF, município ou tipologia territorial em valores absolutos, diferenças relativas e pontos percentuais quando o indicador é percentual.

## Mapas

A aba Mapas usa arquivos locais em `data/geo/`:

- `municipios_ibge_topo.json`;
- `ufs_ibge_topo.json`;
- `manifest_malhas.json`.

O carregador aceita GeoJSON ou TopoJSON. Para uso cartográfico oficial, esses arquivos podem ser substituídos pelos arquivos homônimos da pasta `maps/` do repositório PNDR_4. O mapa municipal apresenta os municípios elegíveis, com contorno estadual sobreposto.

## Tabela analítica

A tabela analítica apresenta dados agregados e indicadores derivados, com alternância de nível de agregação. A exportação CSV exporta apenas a seleção agregada filtrada, nunca a base bruta.

## Limitações

Os resultados medem execução financeira e distribuição de contratos/beneficiários. Eles não medem, isoladamente, efetividade, adicionalidade, impacto causal, permanência do investimento ou qualidade da implementação. A participação feminina depende da qualidade do preenchimento da variável sexo. As comparações de crescimento exigem base anterior suficiente; quando o denominador é nulo ou inexistente, o indicador é apresentado como não disponível.


## Ajuste de performance

Nesta versão, a tabela analítica foi removida da interface para reduzir a carga de renderização no navegador. Os indicadores continuam sendo calculados a partir de dados públicos agregados, sem publicação da base bruta ou de registros individuais.
