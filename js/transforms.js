(function () {
  const ROOT = window.Amazul = window.Amazul || {};
  const U = () => ROOT.utils;

  const DIMENSIONS = {
    fundo: { label: 'Fundo / instrumento', field: 'fundo' },
    macro: { label: 'Macrorregião', field: 'macro' },
    uf: { label: 'UF', field: 'uf' },
    municipio: { label: 'Município', field: 'municipio' },
    tipologiaTerritorial: { label: 'Tipologia territorial', field: 'tipologiaTerritorial' },
    setor: { label: 'Setor', field: 'setor' },
    programa: { label: 'Programa', field: 'programa' },
    linha: { label: 'Linha de financiamento', field: 'linha' },
    atividade: { label: 'Atividade', field: 'atividade' },
    cnae: { label: 'CNAE', field: 'cnae' },
    porte: { label: 'Porte', field: 'porte' },
    finalidade: { label: 'Finalidade', field: 'finalidade' },
    pfPj: { label: 'Natureza do contratante', field: 'pfPj' },
    sexo: { label: 'Sexo', field: 'sexo' },
    instituicao: { label: 'Instituição operadora', field: 'instituicao' }
  };

  function getMetric(rowOrAgg, metric) {
    if (metric === 'valor') return Number(rowOrAgg.valor || 0);
    if (metric === 'beneficiarios') return Number(rowOrAgg.beneficiarios || 0);
    if (metric === 'contratos') return Number(rowOrAgg.contratos || 0);
    if (metric === 'ticketContrato') return U().safeDivide(rowOrAgg.valor, rowOrAgg.contratos) || 0;
    if (metric === 'ticketBeneficiario') return U().safeDivide(rowOrAgg.valor, rowOrAgg.beneficiarios) || 0;
    return Number(rowOrAgg[metric] || 0);
  }

  function applyNonTimeFilters(rows, filters) {
    return rows.filter(r => {
      if (filters.fundo !== '__all__' && r.fundo !== filters.fundo) return false;
      if (filters.macro !== '__all__' && r.macro !== filters.macro) return false;
      if (filters.uf !== '__all__' && r.uf !== filters.uf) return false;
      if (filters.municipio !== '__all__' && r.codMun !== filters.municipio) return false;
      if (filters.tipologia !== '__all__' && r.tipologiaTerritorial !== filters.tipologia) return false;
      if (filters.atividadeAzul !== '__all__' && r.atividadeAzul !== filters.atividadeAzul) return false;
      if (filters.setor !== '__all__' && r.setor !== filters.setor) return false;
      if (filters.programa !== '__all__' && r.programa !== filters.programa) return false;
      if (filters.linha !== '__all__' && r.linha !== filters.linha) return false;
      if (filters.atividade !== '__all__' && r.atividade !== filters.atividade) return false;
      if (filters.cnae !== '__all__' && r.cnae !== filters.cnae) return false;
      if (filters.porte !== '__all__' && r.porte !== filters.porte) return false;
      if (filters.finalidade !== '__all__' && r.finalidade !== filters.finalidade) return false;
      if (filters.pfPj !== '__all__' && r.pfPj !== filters.pfPj) return false;
      if (filters.sexo !== '__all__' && r.sexo !== filters.sexo) return false;
      if (filters.instituicao !== '__all__' && r.instituicao !== filters.instituicao) return false;
      if (!rangePass(r.valor, filters.valorFaixa)) return false;
      if (filters.jurosFaixa !== '__all__' && r.taxaJurosFaixa !== filters.jurosFaixa) return false;
      return true;
    });
  }

  function rangePass(value, range) {
    if (!range || range === '__all__') return true;
    const [min, max] = range.split(':').map(x => x === 'Infinity' ? Infinity : Number(x));
    const v = Number(value || 0);
    return v >= min && v < max;
  }

  function applyTimeWindow(rows, refPeriod, months) {
    const periods = U().periodRange(refPeriod, Number(months));
    return rows.filter(r => periods.has(r.anoMes));
  }

  function applyPreviousTimeWindow(rows, refPeriod, months) {
    const periods = U().previousPeriodRange(refPeriod, Number(months));
    return rows.filter(r => periods.has(r.anoMes));
  }

  function summarize(rows) {
    const s = {
      n: rows.length,
      valor: 0,
      beneficiarios: 0,
      contratos: 0,
      valorAzul: 0,
      beneficiariosAzul: 0,
      contratosAzul: 0,
      valorMulheres: 0,
      beneficiariosMulheres: 0,
      contratosMulheres: 0
    };
    rows.forEach(r => {
      s.valor += r.valor;
      s.beneficiarios += r.beneficiarios;
      s.contratos += r.contratos;
      if (r.atividadeAzul === 'Sim') {
        s.valorAzul += r.valor;
        s.beneficiariosAzul += r.beneficiarios;
        s.contratosAzul += r.contratos;
      }
      if (r.sexo === 'Mulheres') {
        s.valorMulheres += r.valor;
        s.beneficiariosMulheres += r.beneficiarios;
        s.contratosMulheres += r.contratos;
      }
    });
    s.shareAzulValor = U().safeDivide(s.valorAzul, s.valor);
    s.shareAzulBeneficiarios = U().safeDivide(s.beneficiariosAzul, s.beneficiarios);
    s.shareAzulContratos = U().safeDivide(s.contratosAzul, s.contratos);
    s.shareMulheresValor = U().safeDivide(s.valorMulheres, s.valor);
    s.shareMulheresBeneficiarios = U().safeDivide(s.beneficiariosMulheres, s.beneficiarios);
    s.shareMulheresContratos = U().safeDivide(s.contratosMulheres, s.contratos);
    s.ticketContrato = U().safeDivide(s.valor, s.contratos);
    s.ticketBeneficiario = U().safeDivide(s.valor, s.beneficiarios);
    s.beneficiariosPorContrato = U().safeDivide(s.beneficiarios, s.contratos);
    return s;
  }

  function growth(current, previous, metric) {
    const c = getMetric(current, metric);
    const p = getMetric(previous, metric);
    return p ? (c - p) / p : null;
  }

  function groupBy(rows, keyFn) {
    const m = new Map();
    rows.forEach(r => {
      const key = keyFn(r);
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(r);
    });
    return m;
  }

  function aggregateBy(rows, dimKey) {
    const cfg = DIMENSIONS[dimKey] || { field: dimKey, label: dimKey };
    const map = new Map();
    rows.forEach(r => {
      const value = cfg.field === 'municipio' ? `${r.municipio} (${r.uf})` : r[cfg.field];
      const id = cfg.field === 'municipio' ? r.codMun : value;
      if (!map.has(id)) map.set(id, { id, label: value, rows: [], uf: r.uf, codMun: r.codMun, macro: r.macro, tipologiaTerritorial: r.tipologiaTerritorial });
      map.get(id).rows.push(r);
    });
    return Array.from(map.values()).map(g => Object.assign(g, summarize(g.rows))).sort((a, b) => b.valor - a.valor);
  }

  function aggregateMunicipios(rows) {
    const map = new Map();
    rows.forEach(r => {
      if (!map.has(r.codMun)) map.set(r.codMun, { id: r.codMun, codMun: r.codMun, municipio: r.municipio, uf: r.uf, macro: r.macro, tipologiaTerritorial: r.tipologiaTerritorial, rows: [] });
      map.get(r.codMun).rows.push(r);
    });
    return Array.from(map.values()).map(g => Object.assign(g, summarize(g.rows))).sort((a, b) => b.valor - a.valor);
  }

  function aggregatePeriods(rows, metric = 'valor') {
    const map = new Map();
    rows.forEach(r => {
      if (!map.has(r.anoMes)) map.set(r.anoMes, []);
      map.get(r.anoMes).push(r);
    });
    return Array.from(map.entries()).map(([period, rs]) => {
      const s = summarize(rs);
      return { period, label: U().formatMonth(period), value: getMetric(s, metric), summary: s };
    }).sort((a, b) => U().periodIndex(a.period) - U().periodIndex(b.period));
  }

  function cnaeAgg(rows) {
    const map = new Map();
    rows.forEach(r => {
      const id = `${r.setor}||${r.atividade}||${r.cnae}`;
      if (!map.has(id)) map.set(id, { id, setor: r.setor, atividade: r.atividade, cnae: r.cnae, rows: [] });
      map.get(id).rows.push(r);
    });
    return Array.from(map.values()).map(g => Object.assign(g, summarize(g.rows))).sort((a, b) => b.valor - a.valor);
  }

  function hierarchyCnae(rows, metric) {
    const labels = ['Total'];
    const parents = [''];
    const ids = ['root'];
    const values = [Math.max(0.01, getMetric(summarize(rows), metric))];
    const colorValues = [0];
    const setorMap = new Map();
    rows.forEach(r => {
      const keys = [r.setor, `${r.setor}||${r.atividade}`, `${r.setor}||${r.atividade}||${r.cnae}`];
      if (!setorMap.has(keys[0])) setorMap.set(keys[0], []);
      setorMap.get(keys[0]).push(r);
      if (!setorMap.has(keys[1])) setorMap.set(keys[1], []);
      setorMap.get(keys[1]).push(r);
      if (!setorMap.has(keys[2])) setorMap.set(keys[2], []);
      setorMap.get(keys[2]).push(r);
    });
    Array.from(setorMap.keys()).forEach(key => {
      const parts = key.split('||');
      const rs = setorMap.get(key);
      const s = summarize(rs);
      ids.push(key);
      labels.push(parts[parts.length - 1]);
      parents.push(parts.length === 1 ? 'root' : parts.slice(0, -1).join('||'));
      values.push(Math.max(0.01, getMetric(s, metric)));
      colorValues.push(s.shareAzulValor ?? 0);
    });
    return { labels, parents, ids, values, colorValues };
  }

  function hierarchyTerritory(rows, metric) {
    const labels = ['Total'];
    const parents = [''];
    const ids = ['root'];
    const values = [Math.max(0.01, getMetric(summarize(rows), metric))];
    const colorValues = [0];
    const map = new Map();
    rows.forEach(r => {
      const keys = [r.macro, `${r.macro}||${r.uf}`, `${r.macro}||${r.uf}||${r.codMun}`];
      const labelsByKey = { [keys[0]]: r.macro, [keys[1]]: r.uf, [keys[2]]: `${r.municipio} (${r.uf})` };
      keys.forEach(k => {
        if (!map.has(k)) map.set(k, { label: labelsByKey[k], rows: [] });
        map.get(k).rows.push(r);
      });
    });
    Array.from(map.keys()).forEach(key => {
      const parts = key.split('||');
      const rs = map.get(key).rows;
      const s = summarize(rs);
      ids.push(key);
      labels.push(map.get(key).label);
      parents.push(parts.length === 1 ? 'root' : parts.slice(0, -1).join('||'));
      values.push(Math.max(0.01, getMetric(s, metric)));
      colorValues.push(s.shareAzulValor ?? 0);
    });
    return { labels, parents, ids, values, colorValues };
  }

  function tableRows(rows, level) {
    if (level === 'registro') {
      return rows.map(r => ({
        Fundo: r.fundo,
        Mês: U().formatMonth(r.anoMes),
        UF: r.uf,
        Município: `${r.municipio} (${r.codMun})`,
        'Registros agregados': r.registrosAgregados,
        'Tipologia territorial': r.tipologiaTerritorial,
        'Atividade Amazônia Azul': r.atividadeAzul,
        Setor: r.setor,
        Programa: r.programa,
        'Linha de financiamento': r.linha,
        Atividade: r.atividade,
        CNAE: r.cnae,
        Porte: r.porte,
        Finalidade: r.finalidade,
        Beneficiários: r.beneficiarios,
        Contratos: r.contratos,
        'Valor contratado': r.valor,
        Sexo: r.sexo,
        'Instituição operadora': r.instituicao
      }));
    }
    return aggregateBy(rows, level).map(g => ({
      [DIMENSIONS[level]?.label || 'Dimensão']: g.label,
      'Valor contratado': g.valor,
      Beneficiários: g.beneficiarios,
      Contratos: g.contratos,
      'Valor médio por contrato': g.ticketContrato,
      'Valor médio por beneficiário': g.ticketBeneficiario,
      'Participação Amazônia Azul - valor': g.shareAzulValor,
      'Participação feminina - valor': g.shareMulheresValor,
      'Tipologia territorial': g.tipologiaTerritorial || '',
      UF: g.uf || '',
      Município: g.codMun ? `${g.codMun}` : ''
    }));
  }

  function enrichGrowth(rows, allFilteredNoTime, refPeriod, months, dimKey, metric) {
    const current = aggregateBy(applyTimeWindow(allFilteredNoTime, refPeriod, months), dimKey);
    const previous = aggregateBy(applyPreviousTimeWindow(allFilteredNoTime, refPeriod, months), dimKey);
    const prevMap = new Map(previous.map(x => [x.id, x]));
    return current.map(x => ({ ...x, growth: growth(x, prevMap.get(x.id) || {}, metric) }));
  }

  ROOT.transforms = {
    DIMENSIONS, getMetric, applyNonTimeFilters, applyTimeWindow, applyPreviousTimeWindow,
    summarize, growth, groupBy, aggregateBy, aggregateMunicipios, aggregatePeriods, cnaeAgg,
    hierarchyCnae, hierarchyTerritory, tableRows, enrichGrowth
  };
})();
