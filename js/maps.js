(function () {
  const ROOT = window.Amazul = window.Amazul || {};
  const U = () => ROOT.utils;
  const T = () => ROOT.transforms;

  let map = null;
  let geoLayer = null;
  let geojsonCache = null;

  async function initMap(manifest) {
    if (!map) {
      map = L.map('municipalMap', { zoomControl: true, preferCanvas: true }).setView([-14.2, -51.9], 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
    }
    if (!geojsonCache) geojsonCache = await loadGeojson(manifest);
    setTimeout(() => map.invalidateSize(), 200);
    return geojsonCache;
  }

  async function loadGeojson(manifest) {
    const status = document.getElementById('mapStatus');
    const src = manifest.geojson;
    if (!src) throw new Error('GeoJSON não informado no manifest.json.');
    if (status) status.textContent = `Carregando geografia municipal local: ${src}`;
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Não foi possível carregar ${src}: ${res.status}`);
    const json = await res.json();
    if (!json.features || !json.features.length) throw new Error('GeoJSON sem feições.');
    if (status) {
      status.classList.remove('error');
      const geomType = json.features[0]?.geometry?.type || 'geometria';
      status.textContent = `Geografia local carregada com ${json.features.length.toLocaleString('pt-BR')} feições municipais (${geomType}).`;
    }
    return json;
  }

  function normalizeFeatureCode(feature) {
    const p = feature.properties || {};
    const candidates = [feature.id, p.id, p.CD_MUN, p.CD_MUN7, p.CD_GEOCMU, p.codarea, p.geocodigo, p.codigo_ibge, p.COD_MUN, p.CODMUN, p.IBGE, p.CD_IBGE];
    for (const c of candidates) {
      const code = U().padMunicipioCode(c);
      if (code) return code;
    }
    return '';
  }

  function drawMunicipalMap(rows, allNoTimeRows, refPeriod, metric, mode, growthWindow, manifest) {
    initMap(manifest).then(geojson => {
      const currentAgg = T().aggregateMunicipios(rows);
      const currentMap = new Map(currentAgg.map(d => [d.codMun, d]));
      const totalSummary = T().summarize(rows);
      let valueMap = new Map();
      let values = [];
      if (mode === 'growth') {
        const curr = T().aggregateMunicipios(T().applyTimeWindow(allNoTimeRows, refPeriod, Number(growthWindow)));
        const prev = T().aggregateMunicipios(T().applyPreviousTimeWindow(allNoTimeRows, refPeriod, Number(growthWindow)));
        const prevMap = new Map(prev.map(d => [d.codMun, d]));
        curr.forEach(d => {
          const val = T().growth(d, prevMap.get(d.codMun) || {}, metric);
          valueMap.set(d.codMun, val);
          if (val !== null) values.push(val);
        });
      } else {
        currentAgg.forEach(d => {
          let val = T().getMetric(d, metric);
          if (mode === 'shareMunicipio') val = U().safeDivide(T().getMetric(d, metric), T().getMetric(totalSummary, metric));
          if (mode === 'shareAzul') val = metric === 'valor' ? d.shareAzulValor : metric === 'beneficiarios' ? d.shareAzulBeneficiarios : d.shareAzulContratos;
          if (mode === 'shareMulheres') val = metric === 'valor' ? d.shareMulheresValor : metric === 'beneficiarios' ? d.shareMulheresBeneficiarios : d.shareMulheresContratos;
          valueMap.set(d.codMun, val);
          if (val !== null && Number.isFinite(Number(val))) values.push(Number(val));
        });
      }

      const breaks = mode === 'growth' ? [] : U().quantiles(values.filter(v => v > 0), 4);
      const maxAbs = Math.max(...values.map(v => Math.abs(Number(v) || 0)), 0);
      if (geoLayer) geoLayer.remove();
      geoLayer = L.geoJSON(geojson, {
        filter: feature => currentMap.has(normalizeFeatureCode(feature)),
        pointToLayer: (feature, latlng) => {
          const code = normalizeFeatureCode(feature);
          const val = valueMap.get(code);
          const radius = pointRadius(val, maxAbs, mode);
          return L.circleMarker(latlng, {
            radius,
            color: '#ffffff',
            weight: 0.9,
            opacity: 1,
            fillColor: getColor(val, breaks, mode),
            fillOpacity: val === null || val === undefined ? 0.35 : 0.82
          });
        },
        style: feature => {
          const code = normalizeFeatureCode(feature);
          const val = valueMap.get(code);
          return {
            color: '#ffffff',
            weight: 0.55,
            opacity: 1,
            fillColor: getColor(val, breaks, mode),
            fillOpacity: val === null || val === undefined ? 0.18 : 0.78
          };
        },
        onEachFeature: (feature, layer) => {
          const code = normalizeFeatureCode(feature);
          const d = currentMap.get(code);
          if (!d) return;
          const val = valueMap.get(code);
          const valueFormatted = formatMapValue(val, metric, mode);
          layer.bindTooltip(`${d.municipio} (${d.uf})<br>${valueFormatted}`, { sticky: true });
          layer.bindPopup(`
            <strong>${d.municipio} (${d.uf})</strong><br>
            Macrorregião: ${d.macro}<br>
            Tipologia territorial: ${d.tipologiaTerritorial}<br>
            Valor contratado: ${U().formatBRLFull(d.valor)}<br>
            Beneficiários: ${U().formatNumber(d.beneficiarios)}<br>
            Contratos: ${U().formatNumber(d.contratos)}<br>
            Part. Amazônia Azul: ${U().formatPercent(d.shareAzulValor)}<br>
            Part. feminina: ${U().formatPercent(d.shareMulheresValor)}<br>
            Indicador do mapa: ${valueFormatted}
          `);
        }
      }).addTo(map);
      try {
        const bounds = geoLayer.getBounds();
        if (bounds.isValid()) map.fitBounds(bounds.pad(0.08));
      } catch (_) {}
      renderLegend(breaks, mode, metric, values, geojson.features[0]?.geometry?.type);
    }).catch((err) => {
      console.error(err);
      const status = document.getElementById('mapStatus');
      if (status) {
        status.classList.add('error');
        status.textContent = 'Mapa indisponível. Verifique se data/geo/municipios_amazonia_azul.geojson está no repositório.';
      }
    });
  }

  function pointRadius(val, maxAbs, mode) {
    if (val === null || val === undefined || !Number.isFinite(Number(val))) return 4;
    if (!maxAbs) return 7;
    const v = Math.abs(Number(val));
    const scaled = Math.sqrt(v / maxAbs);
    return Math.max(4, Math.min(18, 4 + scaled * 14));
  }

  function getColor(val, breaks, mode) {
    if (val === null || val === undefined || !Number.isFinite(Number(val))) return '#d7dde2';
    const v = Number(val);
    if (mode === 'growth') {
      if (v < -0.25) return '#b33c2e';
      if (v < -0.05) return '#e08b4f';
      if (v <= 0.05) return '#e5e9ed';
      if (v <= 0.25) return '#5ca6d1';
      return '#0e5f8f';
    }
    const idx = U().bucketByBreaks(v, breaks);
    return ['#dceef8', '#9fd0e9', '#5aa9d6', '#1f78ad', '#084b73'][idx + (breaks.length === 0 ? 1 : 0)] || '#084b73';
  }

  function formatMapValue(val, metric, mode) {
    if (val === null || val === undefined || !Number.isFinite(Number(val))) return 'N.D.';
    if (mode === 'shareMunicipio' || mode === 'shareAzul' || mode === 'shareMulheres' || mode === 'growth') return U().formatPercent(val);
    if (metric === 'valor') return U().formatBRLFull(val);
    return U().formatNumber(val);
  }

  function renderLegend(breaks, mode, metric, values, geomType) {
    const legend = document.getElementById('mapLegend');
    if (!legend) return;
    const geomNote = geomType === 'Point' ? '<span class="legend-note">Círculos representam centroides municipais.</span>' : '';
    if (mode === 'growth') {
      const labels = [
        ['#b33c2e', 'Queda forte'], ['#e08b4f', 'Queda moderada'], ['#e5e9ed', 'Estabilidade'], ['#5ca6d1', 'Crescimento moderado'], ['#0e5f8f', 'Crescimento forte']
      ];
      legend.innerHTML = labels.map(([c, t]) => `<span class="legend-item"><span class="legend-swatch" style="background:${c}"></span>${t}</span>`).join('') + geomNote;
      return;
    }
    const colors = ['#dceef8', '#9fd0e9', '#5aa9d6', '#1f78ad', '#084b73'];
    const sorted = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
    if (!sorted.length) {
      legend.innerHTML = '<span class="legend-item"><span class="legend-swatch" style="background:#d7dde2"></span>Sem dados</span>' + geomNote;
      return;
    }
    const ranges = [];
    let lower = sorted[0];
    breaks.forEach(b => { ranges.push([lower, b]); lower = b; });
    ranges.push([lower, sorted[sorted.length - 1]]);
    legend.innerHTML = ranges.map((r, i) => `<span class="legend-item"><span class="legend-swatch" style="background:${colors[i]}"></span>${formatMapValue(r[0], metric, mode)}–${formatMapValue(r[1], metric, mode)}</span>`).join('') + '<span class="legend-item"><span class="legend-swatch" style="background:#d7dde2"></span>Sem dado</span>' + geomNote;
  }

  ROOT.maps = { drawMunicipalMap, initMap };
})();
