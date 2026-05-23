(function () {
  const ROOT = window.Amazul = window.Amazul || {};
  const U = () => ROOT.utils;
  const T = () => ROOT.transforms;

  const plotConfig = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] };
  const baseLayout = {
    margin: { l: 62, r: 24, t: 36, b: 54 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Inter, system-ui, sans-serif', size: 12, color: '#26313a' },
    hoverlabel: { bgcolor: '#06243b', font: { color: '#fff' } }
  };

  function metricFormat(metric) {
    if (metric === 'valor' || metric === 'ticketContrato' || metric === 'ticketBeneficiario') return v => U().formatBRLFull(v);
    return v => U().formatNumber(v, 0);
  }

  function drawOverviewTrend(rows, metric) {
    const series = T().aggregatePeriods(rows, metric);
    const fmt = metricFormat(metric);
    const trace = {
      type: 'scatter', mode: 'lines+markers',
      x: series.map(d => d.label), y: series.map(d => d.value),
      text: series.map(d => fmt(d.value)),
      hovertemplate: '<b>%{x}</b><br>%{text}<extra></extra>',
      line: { width: 3 }, marker: { size: 7 }
    };
    Plotly.react('overviewTrend', [trace], {
      ...baseLayout,
      yaxis: { title: U().LABELS[metric] || metric, rangemode: 'tozero' },
      xaxis: { title: 'Mês' }
    }, plotConfig);
  }

  function drawComparison(rows, metric, highlightUf, highlightMun) {
    const groups = [
      { label: 'Brasil', fn: () => true },
      { label: 'Norte', fn: r => r.macro === 'Norte' },
      { label: 'Nordeste', fn: r => r.macro === 'Nordeste' },
      { label: 'Centro-Oeste', fn: r => r.macro === 'Centro-Oeste' },
      { label: 'Sudeste', fn: r => r.macro === 'Sudeste' },
      { label: 'Sul', fn: r => r.macro === 'Sul' }
    ];
    if (highlightUf && highlightUf !== '__none__') groups.push({ label: `UF: ${highlightUf}`, fn: r => r.uf === highlightUf });
    if (highlightMun && highlightMun !== '__none__') {
      const one = rows.find(r => r.codMun === highlightMun);
      groups.push({ label: `Município: ${one ? one.municipio : highlightMun}`, fn: r => r.codMun === highlightMun });
    }
    const allPeriods = Array.from(new Set(rows.map(r => r.anoMes))).sort((a, b) => U().periodIndex(a) - U().periodIndex(b));
    const traces = groups.map(g => {
      const byPeriod = T().groupBy(rows.filter(g.fn), r => r.anoMes);
      return {
        type: 'scatter', mode: 'lines',
        name: g.label,
        x: allPeriods.map(U().formatMonth),
        y: allPeriods.map(p => T().getMetric(T().summarize(byPeriod.get(p) || []), metric)),
        hovertemplate: `<b>${g.label}</b><br>%{x}<br>%{y:,.2f}<extra></extra>`,
        line: { width: g.label === 'Brasil' ? 4 : 2 }
      };
    });
    Plotly.react('comparisonChart', traces, {
      ...baseLayout,
      yaxis: { title: U().LABELS[metric] || metric, rangemode: 'tozero' },
      xaxis: { title: 'Mês' },
      legend: { orientation: 'h', y: -0.24 }
    }, plotConfig);
  }

  function drawComposition(summary) {
    const data = [
      {
        type: 'bar', orientation: 'h', name: 'Amazônia Azul',
        x: [summary.shareAzulValor || 0, summary.shareAzulBeneficiarios || 0, summary.shareAzulContratos || 0].map(v => v * 100),
        y: ['Valor', 'Beneficiários', 'Contratos'],
        text: [summary.shareAzulValor, summary.shareAzulBeneficiarios, summary.shareAzulContratos].map(v => U().formatPercent(v)),
        textposition: 'auto', hovertemplate: '<b>Atividades Amazônia Azul</b><br>%{y}: %{text}<extra></extra>'
      },
      {
        type: 'bar', orientation: 'h', name: 'Mulheres',
        x: [summary.shareMulheresValor || 0, summary.shareMulheresBeneficiarios || 0, summary.shareMulheresContratos || 0].map(v => v * 100),
        y: ['Valor', 'Beneficiários', 'Contratos'],
        text: [summary.shareMulheresValor, summary.shareMulheresBeneficiarios, summary.shareMulheresContratos].map(v => U().formatPercent(v)),
        textposition: 'auto', hovertemplate: '<b>Participação feminina</b><br>%{y}: %{text}<extra></extra>'
      }
    ];
    Plotly.react('compositionChart', data, {
      ...baseLayout,
      barmode: 'group',
      xaxis: { title: '%', range: [0, 100] },
      yaxis: { automargin: true },
      legend: { orientation: 'h', y: -0.25 }
    }, plotConfig);
  }

  function drawTreemapCnae(rows, metric) {
    if (!rows.length) return emptyPlot('treemapCnae', 'Sem dados para a seleção atual.');
    const h = T().hierarchyCnae(rows, metric);
    const trace = {
      type: 'treemap', labels: h.labels, parents: h.parents, ids: h.ids, values: h.values,
      branchvalues: 'total',
      marker: { colors: h.colorValues, colorscale: 'Blues', cmin: 0, cmax: 1 },
      customdata: h.colorValues.map(v => U().formatPercent(v)),
      hovertemplate: '<b>%{label}</b><br>Indicador: %{value:,.2f}<br>Part. Amazônia Azul: %{customdata}<extra></extra>',
      textinfo: 'label+value'
    };
    Plotly.react('treemapCnae', [trace], { ...baseLayout, margin: { l: 8, r: 8, t: 10, b: 8 } }, plotConfig);
  }

  function drawTreemapTerritory(rows, metric) {
    if (!rows.length) return emptyPlot('treemapTerritory', 'Sem dados para a seleção atual.');
    const h = T().hierarchyTerritory(rows, metric);
    const trace = {
      type: 'treemap', labels: h.labels, parents: h.parents, ids: h.ids, values: h.values,
      branchvalues: 'total',
      marker: { colors: h.colorValues, colorscale: 'Blues', cmin: 0, cmax: 1 },
      customdata: h.colorValues.map(v => U().formatPercent(v)),
      hovertemplate: '<b>%{label}</b><br>Indicador: %{value:,.2f}<br>Part. Amazônia Azul: %{customdata}<extra></extra>',
      textinfo: 'label+value'
    };
    Plotly.react('treemapTerritory', [trace], { ...baseLayout, margin: { l: 8, r: 8, t: 10, b: 8 } }, plotConfig);
  }

  function drawRanking(rows, dim, metric, topN) {
    const agg = T().aggregateBy(rows, dim).sort((a, b) => T().getMetric(b, metric) - T().getMetric(a, metric)).slice(0, Number(topN));
    if (!agg.length) return emptyPlot('rankingChart', 'Sem dados para a seleção atual.');
    const labels = agg.map(d => d.label).reverse();
    const values = agg.map(d => T().getMetric(d, metric)).reverse();
    const fmt = metricFormat(metric);
    const trace = {
      type: 'bar', orientation: 'h',
      y: labels, x: values,
      text: values.map(fmt), textposition: 'auto',
      customdata: agg.map(d => [U().formatPercent(d.shareAzulValor), U().formatPercent(d.shareMulheresValor)]).reverse(),
      hovertemplate: '<b>%{y}</b><br>%{text}<br>Part. Amazônia Azul: %{customdata[0]}<br>Part. feminina: %{customdata[1]}<extra></extra>'
    };
    Plotly.react('rankingChart', [trace], {
      ...baseLayout,
      margin: { l: 210, r: 20, t: 20, b: 46 },
      xaxis: { title: U().LABELS[metric] || metric, rangemode: 'tozero' },
      yaxis: { automargin: true }
    }, plotConfig);
  }

  function drawScatterCnae(rows, colorField) {
    const agg = T().cnaeAgg(rows).filter(d => d.contratos > 0 || d.valor > 0);
    if (!agg.length) return emptyPlot('scatterCnae', 'Sem dados para a seleção atual.');
    const colorValues = agg.map(d => {
      if (colorField === 'atividadeAzul') return (d.shareAzulValor || 0) >= 0.5 ? 'Predominância Amazônia Azul' : 'Demais atividades';
      if (colorField === 'tipologiaTerritorial') return d.rows[0]?.tipologiaTerritorial || 'Não informado';
      if (colorField === 'sexo') return (d.shareMulheresValor || 0) >= 0.5 ? 'Predominância feminina' : 'Demais / não informado';
      return d.setor;
    });
    const trace = {
      type: 'scatter', mode: 'markers',
      x: agg.map(d => d.contratos),
      y: agg.map(d => d.valor),
      text: agg.map(d => d.cnae),
      marker: {
        size: agg.map(d => Math.max(8, Math.sqrt(d.beneficiarios || 1) * 2.6)),
        sizemode: 'diameter', opacity: 0.78,
        color: colorValues.map((v, i) => colorIndex(v, colorValues))
      },
      customdata: agg.map((d, i) => [colorValues[i], U().formatNumber(d.beneficiarios), U().formatPercent(d.shareAzulValor), U().formatPercent(d.shareMulheresValor)]),
      hovertemplate: '<b>%{text}</b><br>Contratos: %{x}<br>Valor: R$ %{y:,.2f}<br>Beneficiários: %{customdata[1]}<br>Grupo: %{customdata[0]}<br>Part. Amazônia Azul: %{customdata[2]}<br>Part. feminina: %{customdata[3]}<extra></extra>'
    };
    Plotly.react('scatterCnae', [trace], {
      ...baseLayout,
      xaxis: { title: 'Quantidade de contratos', rangemode: 'tozero' },
      yaxis: { title: 'Valor contratado', rangemode: 'tozero' }
    }, plotConfig);
  }

  function colorIndex(v, all) {
    const uniques = Array.from(new Set(all));
    return uniques.indexOf(v);
  }

  function drawBoxplot(rows, groupKey, metric) {
    if (!rows.length) return emptyPlot('boxplotChart', 'Sem dados para a seleção atual.');
    const dim = T().DIMENSIONS[groupKey] || T().DIMENSIONS.macro;
    const groups = T().groupBy(rows, r => r[dim.field] || 'Não informado');
    const traces = Array.from(groups.entries()).slice(0, 30).map(([label, rs]) => ({
      type: 'box', name: label,
      y: rs.map(r => T().getMetric(r, metric)),
      boxpoints: 'outliers',
      hovertemplate: `<b>${label}</b><br>%{y}<extra></extra>`
    }));
    Plotly.react('boxplotChart', traces, {
      ...baseLayout,
      yaxis: { title: U().LABELS[metric] || metric, rangemode: 'tozero' },
      xaxis: { tickangle: -35, automargin: true },
      showlegend: false
    }, plotConfig);
  }

  function emptyPlot(id, message) {
    Plotly.react(id, [], { ...baseLayout, annotations: [{ text: message, x: 0.5, y: 0.5, xref: 'paper', yref: 'paper', showarrow: false, font: { size: 16 } }] }, plotConfig);
  }

  ROOT.charts = {
    drawOverviewTrend, drawComparison, drawComposition,
    drawTreemapCnae, drawTreemapTerritory, drawRanking,
    drawScatterCnae, drawBoxplot, emptyPlot
  };
})();
