(function () {
  const ROOT = window.Amazul = window.Amazul || {};
  const U = () => ROOT.utils;

  async function fetchJson(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Não foi possível carregar ${path}: ${res.status}`);
    return await res.json();
  }

  async function loadManifest() {
    const res = await fetch('data/manifest.json');
    if (!res.ok) throw new Error('Não foi possível carregar data/manifest.json. Verifique a publicação no GitHub Pages ou execute via servidor local.');
    return await res.json();
  }

  async function loadTerritorial(path) {
    U().setLoadingStep('Carregando tipologia territorial Amazônia Azul');
    const json = await fetchJson(path);
    const rows = json.municipios || [];
    const map = new Map();
    rows.forEach(r => {
      const code = U().padMunicipioCode(r.codMun || r['Código de município']);
      if (!code) return;
      map.set(code, {
        codMun: code,
        municipioTipologia: U().nonEmpty(r.municipioTipologia || r['Nome de município']),
        ufTipologia: U().nonEmpty(r.ufTipologia || r.UF),
        macroTipologia: U().nonEmpty(r.macroTipologia || r.Macrorregião),
        tipologiaTerritorial: U().nonEmpty(r.tipologiaTerritorial || r['Tipologia Amazônia Azul'])
      });
    });
    return { rows, map, metadata: json.metadata || {} };
  }

  function inflateRows(compact) {
    const schema = compact.schema || [];
    const rows = (compact.rows || []).map(arr => {
      const r = {};
      schema.forEach((name, i) => { r[name] = arr[i]; });
      r.valor = Number(r.valor || 0);
      r.beneficiarios = Number(r.beneficiarios || 0);
      r.contratos = Number(r.contratos || 0);
      r.registrosAgregados = Number(r.registrosAgregados || 0);
      r.atividadeAzulBinaria = r.atividadeAzul === 'Sim' ? 1 : 0;
      return r;
    });
    return rows;
  }

  async function loadAggregatedDataset(item) {
    U().setLoadingStep(`Carregando dados agregados: ${item.fundo || item.arquivo}`);
    const json = await fetchJson(item.arquivo);
    const rows = inflateRows(json);
    const md = json.metadata || {};
    return {
      rows,
      diagnostics: {
        fundo: item.fundo || md.fundo || 'Fundo',
        arquivo: item.arquivo,
        registrosOriginais: md.registrosOriginais ?? null,
        registrosElegiveis: md.registrosElegiveis ?? null,
        registrosForaDaTipologia: md.registrosForaDaTipologia ?? 0,
        municipiosForaDaTipologia: md.municipiosForaDaTipologia ?? null,
        linhasAgregadas: md.linhasAgregadas ?? rows.length,
        arquivoPublico: 'agregado/compactado'
      },
      metadata: md
    };
  }

  async function loadAllData() {
    const manifest = await loadManifest();
    const territorial = await loadTerritorial(manifest.territorial);
    const allRows = [];
    const diagnostics = [];
    const datasets = manifest.agregados || manifest.datasets || [];
    if (!datasets.length) throw new Error('O manifest.json não contém arquivos agregados em `agregados`.');
    for (const item of datasets) {
      const loaded = await loadAggregatedDataset(item);
      allRows.push(...loaded.rows);
      diagnostics.push(loaded.diagnostics);
    }
    return { manifest, territorial, rows: allRows, diagnostics };
  }

  ROOT.dataLoader = { loadAllData };
})();
