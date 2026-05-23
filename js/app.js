(function () {
  const ROOT = window.Amazul = window.Amazul || {};
  const U = () => ROOT.utils;
  const DL = () => ROOT.dataLoader;
  const T = () => ROOT.transforms;
  const C = () => ROOT.charts;
  const M = () => ROOT.maps;

  const state = {
    rows: [],
    territorial: null,
    manifest: null,
    diagnostics: [],
    activeTab: 'overview',
    tableSort: { key: null, dir: 1 },
    currentTableRows: []
  };

  const filterIds = {
    month: 'filterMonth', window: 'filterWindow', indicator: 'indicatorSelect',
    fundo: 'filterFund', macro: 'filterMacro', uf: 'filterUf', municipio: 'filterMunicipio', tipologia: 'filterTipologia',
    atividadeAzul: 'filterAtividadeAzul', setor: 'filterSetor', programa: 'filterPrograma', linha: 'filterLinha',
    atividade: 'filterAtividade', cnae: 'filterCnae', porte: 'filterPorte', finalidade: 'filterFinalidade',
    pfPj: 'filterPfPj', sexo: 'filterSexo', instituicao: 'filterInstituicao', valorFaixa: 'filterValorFaixa', jurosFaixa: 'filterJurosFaixa'
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    try {
      U().showLoading(true);
      U().setLoadingStep('Carregando manifesto de dados');
      const loaded = await DL().loadAllData();
      state.rows = loaded.rows;
      state.territorial = loaded.territorial;
      state.manifest = loaded.manifest;
      state.diagnostics = loaded.diagnostics;
      populateFilters();
      bindEvents();
      await loadMethodology();
      renderAll();
      U().showLoading(false);
    } catch (err) {
      console.error(err);
      U().showLoading(false);
      showAlert(`Erro ao inicializar o dashboard: ${err.message}`, 'error');
    }
  }

  function populateFilters() {
    const rows = state.rows;
    const periods = U().uniqueSorted(rows, r => r.anoMes).sort((a, b) => U().periodIndex(a) - U().periodIndex(b));
    const monthSel = el('filterMonth');
    monthSel.innerHTML = '';
    periods.forEach(p => monthSel.appendChild(U().makeOption(p, U().formatMonth(p))));
    if (periods.length) monthSel.value = periods[periods.length - 1];

    fillSelect('filterFund', U().uniqueSorted(rows, r => r.fundo), 'Todos');
    fillSelect('filterMacro', ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'].filter(m => rows.some(r => r.macro === m)), 'Todas');
    fillSelect('filterUf', U().uniqueSorted(rows, r => r.uf), 'Todas');
    fillMunicipioSelect();
    fillSelect('highlightUf', U().uniqueSorted(rows, r => r.uf), 'Nenhuma', '__none__');
    fillMunicipioSelect('highlightMun', '__none__', 'Nenhum');
    fillSelect('filterTipologia', U().uniqueSorted(rows, r => r.tipologiaTerritorial), 'Todas');
    fillSelect('filterSetor', U().uniqueSorted(rows, r => r.setor), 'Todos');
    fillSelect('filterPrograma', U().uniqueSorted(rows, r => r.programa), 'Todos');
    fillSelect('filterLinha', U().uniqueSorted(rows, r => r.linha), 'Todas');
    fillSelect('filterAtividade', U().uniqueSorted(rows, r => r.atividade), 'Todas');
    fillSelect('filterCnae', U().uniqueSorted(rows, r => r.cnae), 'Todas');
    fillSelect('filterPorte', U().uniqueSorted(rows, r => r.porte), 'Todos');
    fillSelect('filterFinalidade', U().uniqueSorted(rows, r => r.finalidade), 'Todas');
    fillSelect('filterPfPj', U().uniqueSorted(rows, r => r.pfPj), 'Todas');
    fillSelect('filterSexo', U().uniqueSorted(rows, r => r.sexo), 'Todos');
    fillSelect('filterInstituicao', U().uniqueSorted(rows, r => r.instituicao), 'Todas');
    fillSelect('filterJurosFaixa', U().uniqueSorted(rows, r => r.taxaJurosFaixa), 'Todas');
  }

  function fillSelect(id, values, allLabel = 'Todos', allValue = '__all__') {
    const s = el(id);
    if (!s) return;
    const current = s.value;
    s.innerHTML = '';
    s.appendChild(U().makeOption(allValue, allLabel));
    values.forEach(v => s.appendChild(U().makeOption(v, v)));
    if ([...s.options].some(o => o.value === current)) s.value = current;
  }

  function fillMunicipioSelect(id = 'filterMunicipio', allValue = '__all__', allLabel = 'Todos') {
    const s = el(id);
    if (!s) return;
    const rows = state.rows;
    const current = s.value;
    const items = Array.from(new Map(rows.map(r => [r.codMun, `${r.municipio} (${r.uf})`])).entries()).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
    s.innerHTML = '';
    s.appendChild(U().makeOption(allValue, allLabel));
    items.forEach(([code, label]) => s.appendChild(U().makeOption(code, label)));
    if ([...s.options].some(o => o.value === current)) s.value = current;
  }

  function bindEvents() {
    Object.values(filterIds).forEach(id => el(id)?.addEventListener('change', U().debounce(renderAll, 160)));
    ['topNSelect','rankingDimension','scatterColor','boxGroup','mapMode','mapGrowthWindow','tableLevel'].forEach(id => el(id)?.addEventListener('change', U().debounce(renderAll, 160)));
    el('tableSearch')?.addEventListener('input', U().debounce(renderTable, 180));
    el('downloadTable')?.addEventListener('click', () => exportTable());
    el('btnExportSelection')?.addEventListener('click', () => exportSelection());
    el('btnRefresh')?.addEventListener('click', () => renderAll());
    el('clearFilters')?.addEventListener('click', clearFilters);
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        state.activeTab = btn.dataset.tab;
        el(state.activeTab)?.classList.add('active');
        setTimeout(() => renderAll(), 80);
      });
    });
  }

  function clearFilters() {
    Object.entries(filterIds).forEach(([key, id]) => {
      const s = el(id);
      if (!s) return;
      if (key === 'month') {
        if (s.options.length) s.selectedIndex = s.options.length - 1;
      } else if (key === 'window') s.value = '1';
      else if (key === 'indicator') s.value = 'valor';
      else s.selectedIndex = 0;
    });
    ['highlightUf','highlightMun'].forEach(id => { if (el(id)) el(id).selectedIndex = 0; });
    el('topNSelect').value = '20';
    el('rankingDimension').value = 'setor';
    el('scatterColor').value = 'setor';
    el('boxGroup').value = 'macro';
    el('mapMode').value = 'total';
    el('mapGrowthWindow').value = '3';
    el('tableLevel').value = 'municipio';
    el('tableSearch').value = '';
    renderAll();
  }

  function filters() {
    const obj = {};
    Object.entries(filterIds).forEach(([key, id]) => obj[key] = el(id)?.value || '__all__');
    obj.months = Number(obj.window || 1);
    obj.highlightUf = el('highlightUf')?.value || '__none__';
    obj.highlightMun = el('highlightMun')?.value || '__none__';
    obj.topN = Number(el('topNSelect')?.value || 20);
    obj.rankingDimension = el('rankingDimension')?.value || 'setor';
    obj.scatterColor = el('scatterColor')?.value || 'setor';
    obj.boxGroup = el('boxGroup')?.value || 'macro';
    obj.mapMode = el('mapMode')?.value || 'total';
    obj.mapGrowthWindow = Number(el('mapGrowthWindow')?.value || 3);
    obj.tableLevel = el('tableLevel')?.value || 'municipio';
    return obj;
  }

  function currentData() {
    const f = filters();
    const noTime = T().applyNonTimeFilters(state.rows, f);
    const current = T().applyTimeWindow(noTime, f.month, f.months);
    const previous = T().applyPreviousTimeWindow(noTime, f.month, f.months);
    return { f, noTime, current, previous, summary: T().summarize(current), previousSummary: T().summarize(previous) };
  }

  function renderAll() {
    clearAlerts();
    if (!state.rows.length) {
      showAlert('Nenhuma linha agregada elegível foi carregada. Verifique se os códigos municipais da base financeira correspondem à tipologia territorial.', 'error');
      return;
    }
    state.diagnostics.forEach(d => {
      if (d.registrosForaDaTipologia > 0) showAlert(`${d.fundo}: ${U().formatNumber(d.registrosForaDaTipologia)} registros do arquivo original ficaram fora do universo de municípios elegíveis na etapa de pré-processamento e foram excluídos da base pública agregada.`, 'info');
    });
    const data = currentData();
    updateSelectionPill(data);
    renderCards(data);
    if (state.activeTab === 'overview') renderOverview(data);
    if (state.activeTab === 'rankings') renderRankings(data);
    if (state.activeTab === 'scatter') renderScatter(data);
    if (state.activeTab === 'maps') renderMaps(data);
    if (state.activeTab === 'table') renderTable();
  }

  function renderCards({ f, summary, previousSummary }) {
    const metric = f.indicator;
    const g = T().growth(summary, previousSummary, metric);
    const cards = [
      { label: 'Valor contratado', value: U().formatBRL(summary.valor), sub: growthText(T().growth(summary, previousSummary, 'valor')) },
      { label: 'Beneficiários', value: U().formatNumber(summary.beneficiarios), sub: growthText(T().growth(summary, previousSummary, 'beneficiarios')) },
      { label: 'Contratos', value: U().formatNumber(summary.contratos), sub: growthText(T().growth(summary, previousSummary, 'contratos')) },
      { label: 'Métrica selecionada', value: formatMetricValue(T().getMetric(summary, metric), metric), sub: growthText(g) },
      { label: 'Part. Amazônia Azul no valor', value: U().formatPercent(summary.shareAzulValor), sub: `${U().formatBRL(summary.valorAzul)} em atividades vinculadas` },
      { label: 'Part. Amazônia Azul nos beneficiários', value: U().formatPercent(summary.shareAzulBeneficiarios), sub: `${U().formatNumber(summary.beneficiariosAzul)} beneficiários` },
      { label: 'Part. feminina no valor', value: U().formatPercent(summary.shareMulheresValor), sub: `${U().formatBRL(summary.valorMulheres)} associados a mulheres` },
      { label: 'Part. feminina nos contratos', value: U().formatPercent(summary.shareMulheresContratos), sub: `${U().formatNumber(summary.contratosMulheres)} contratos` }
    ];
    const container = el('cards');
    container.innerHTML = cards.map(c => `<article class="card ${cardClass(c.sub)}"><div class="card-label">${c.label}</div><div class="card-value">${c.value}</div><div class="card-sub">${c.sub}</div></article>`).join('');
  }

  function cardClass(text) {
    if (String(text).includes('+')) return 'positive';
    if (String(text).includes('-')) return 'negative';
    return 'neutral';
  }

  function growthText(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Comparação anterior indisponível';
    const sign = value > 0 ? '+' : '';
    return `${sign}${U().formatPercent(value)} frente à janela anterior`;
  }

  function formatMetricValue(value, metric) {
    if (metric === 'valor' || metric === 'ticketContrato' || metric === 'ticketBeneficiario') return U().formatBRL(value);
    return U().formatNumber(value);
  }

  function renderOverview(data) {
    const { f, noTime, current, summary } = data;
    C().drawOverviewTrend(noTime, f.indicator);
    C().drawComparison(noTime, f.indicator, f.highlightUf, f.highlightMun);
    C().drawComposition(summary);
    renderNarrative(data);
  }

  function renderNarrative({ f, summary }) {
    const ref = U().formatMonth(f.month);
    const windowLabel = windowLabelFromMonths(f.months);
    const terr = activeTerritoryText(f);
    el('autoNarrative').innerHTML = `No período de referência <strong>${ref}</strong>, considerando a janela <strong>${windowLabel}</strong>, ${terr} registrou <strong>${U().formatBRLFull(summary.valor)}</strong> em financiamentos, distribuídos em <strong>${U().formatNumber(summary.contratos)}</strong> contratos e <strong>${U().formatNumber(summary.beneficiarios)}</strong> beneficiários. As atividades classificadas como vinculadas à Amazônia Azul responderam por <strong>${U().formatPercent(summary.shareAzulValor)}</strong> do valor contratado. A participação feminina foi de <strong>${U().formatPercent(summary.shareMulheresValor)}</strong> no valor e de <strong>${U().formatPercent(summary.shareMulheresContratos)}</strong> nos contratos.`;
    el('windowSummary').innerHTML = [
      ['Valor médio por contrato', U().formatBRLFull(summary.ticketContrato || 0)],
      ['Valor médio por beneficiário', U().formatBRLFull(summary.ticketBeneficiario || 0)],
      ['Beneficiários por contrato', U().formatNumber(summary.beneficiariosPorContrato || 0, 2)],
      ['Linhas agregadas analisadas', U().formatNumber(summary.n)]
    ].map(([a,b]) => `<div class="mini-stat"><strong>${b}</strong><span>${a}</span></div>`).join('');
  }

  function activeTerritoryText(f) {
    if (f.municipio !== '__all__') {
      const r = state.rows.find(x => x.codMun === f.municipio);
      return `o município de ${r ? `${r.municipio} (${r.uf})` : f.municipio}`;
    }
    if (f.uf !== '__all__') return `a UF ${f.uf}`;
    if (f.macro !== '__all__') return `a macrorregião ${f.macro}`;
    return 'os municípios elegíveis ao Programa Amazônia Azul';
  }

  function windowLabelFromMonths(n) {
    return ({ 1: 'mês', 3: 'trimestre', 6: 'semestre', 12: 'últimos 12 meses' })[Number(n)] || `${n} meses`;
  }

  function renderRankings({ f, current }) {
    C().drawTreemapCnae(current, f.indicator);
    C().drawTreemapTerritory(current, f.indicator);
    C().drawRanking(current, f.rankingDimension, f.indicator, f.topN);
  }

  function renderScatter({ f, current }) {
    C().drawScatterCnae(current, f.scatterColor);
    C().drawBoxplot(current, f.boxGroup, f.indicator);
  }

  function renderMaps({ f, current, noTime }) {
    M().drawMunicipalMap(current, noTime, f.month, f.indicator, f.mapMode, f.mapGrowthWindow, state.manifest);
  }

  function renderTable() {
    const data = currentData();
    const { f, current } = data;
    const level = f.tableLevel;
    const search = U().norm(el('tableSearch')?.value || '');
    let rows = T().tableRows(current, level);
    if (search) rows = rows.filter(r => U().norm(Object.values(r).join(' ')).includes(search));
    if (state.tableSort.key) {
      const { key, dir } = state.tableSort;
      rows = rows.slice().sort((a, b) => compareValues(a[key], b[key]) * dir);
    }
    state.currentTableRows = rows;
    drawTable(rows, level);
  }

  function compareValues(a, b) {
    const na = Number(a), nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return String(a ?? '').localeCompare(String(b ?? ''), 'pt-BR');
  }

  function drawTable(rows, level) {
    const table = el('analyticTable');
    const limit = level === 'registro' ? 1000 : 2000;
    const displayRows = rows.slice(0, limit);
    el('tableInfo').innerHTML = `${U().formatNumber(rows.length)} linhas na seleção. ${rows.length > limit ? `Exibindo as primeiras ${U().formatNumber(limit)} linhas; a exportação inclui todas.` : 'A tabela exibida corresponde à seleção atual.'}`;
    if (!displayRows.length) {
      table.innerHTML = '<tbody><tr><td>Nenhuma linha agregada para os filtros selecionados.</td></tr></tbody>';
      return;
    }
    const headers = Object.keys(displayRows[0]);
    table.innerHTML = `<thead><tr>${headers.map(h => `<th data-key="${escapeHtml(h)}">${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${displayRows.map(r => `<tr>${headers.map(h => `<td>${formatTableCell(r[h], h)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    table.querySelectorAll('th').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (state.tableSort.key === key) state.tableSort.dir *= -1;
        else state.tableSort = { key, dir: 1 };
        renderTable();
      });
    });
  }

  function formatTableCell(value, key) {
    if (value === null || value === undefined) return '';
    const lower = U().norm(key);
    if (lower.includes('participacao')) return U().formatPercent(value);
    if (lower.includes('valor')) return U().formatBRLFull(value);
    if (['Beneficiários','Contratos'].includes(key)) return U().formatNumber(value);
    return escapeHtml(value);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  function exportTable() {
    const rows = state.currentTableRows.length ? state.currentTableRows : T().tableRows(currentData().current, filters().tableLevel);
    U().download(`tabela_amazonia_azul_${Date.now()}.csv`, U().toCsv(rows), 'text/csv;charset=utf-8');
  }

  function exportSelection() {
    const rows = currentData().current.map(r => ({
      fundo: r.fundo, ano_mes: r.anoMes, uf: r.uf, cod_mun: r.codMun, municipio: r.municipio,
      macrorregiao: r.macro, tipologia_territorial: r.tipologiaTerritorial, atividade_amazonia_azul: r.atividadeAzul,
      setor: r.setor, programa: r.programa, linha: r.linha, atividade: r.atividade, cnae: r.cnae, porte: r.porte,
      finalidade: r.finalidade, beneficiarios: r.beneficiarios, contratos: r.contratos, valor: r.valor,
      sexo: r.sexo, faixa_taxa_juros: r.taxaJurosFaixa, registros_agregados: r.registrosAgregados, instituicao: r.instituicao
    }));
    U().download(`selecao_amazonia_azul_${Date.now()}.csv`, U().toCsv(rows), 'text/csv;charset=utf-8');
  }

  function updateSelectionPill({ f, current }) {
    const parts = [U().formatMonth(f.month), windowLabelFromMonths(f.months), U().LABELS[f.indicator] || f.indicator];
    if (f.macro !== '__all__') parts.push(f.macro);
    if (f.uf !== '__all__') parts.push(f.uf);
    if (f.municipio !== '__all__') {
      const r = state.rows.find(x => x.codMun === f.municipio);
      parts.push(r ? r.municipio : f.municipio);
    }
    el('selectionPill').textContent = `${parts.join(' • ')} • ${U().formatNumber(current.length)} linhas agregadas`;
  }

  async function loadMethodology() {
    try {
      const res = await fetch('metodologia/metodologia.md');
      if (!res.ok) throw new Error(`${res.status}`);
      const md = await res.text();
      el('methodologyContent').innerHTML = marked.parse(md);
    } catch (err) {
      el('methodologyContent').innerHTML = '<p>Não foi possível carregar <code>metodologia/metodologia.md</code>. O dashboard continua funcional, mas a aba de metodologia precisa do arquivo Markdown no repositório.</p>';
    }
  }

  function showAlert(message, type = 'info') {
    const container = el('alerts');
    const div = document.createElement('div');
    div.className = `alert ${type}`;
    div.textContent = message;
    container.appendChild(div);
  }

  function clearAlerts() {
    el('alerts').innerHTML = '';
  }

  function el(id) { return document.getElementById(id); }
})();
