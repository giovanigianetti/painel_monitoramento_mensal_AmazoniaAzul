const MapController = (() => {
  let map, muniLayer, ufLayer, legend, tileLayer;
  let cachedMuniGeo = null, cachedUfGeo = null, lastBounds = null;
  let lastSource = {municipios:null, ufs:null};
  let lastStats = {municipios:null, ufs:null};

  const seq = ['#edf8e9','#d9f0d3','#c7e9c0','#a1d99b','#74c476','#41ab5d','#238b45','#006d2c','#005a32','#00441b'];
  const neg = ['#fee5d9','#fcbba1','#fc9272','#fb6a4a','#ef3b2c','#cb181d','#a50f15','#7f0000','#67000d','#4a0008'];

  const IBGE_MUNI = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application%2Fjson&intrarregiao=municipio&qualidade=minima';
  const IBGE_UF = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application%2Fjson&intrarregiao=UF&qualidade=minima';

  const MAP_SOURCES = {
    municipios: [
      {path:IBGE_MUNI, type:'topo', source:'IBGE API de Malhas Geográficas'},
      {path:'maps/municipios_ibge_topo.json', type:'topo', source:'maps/municipios_ibge_topo.json'},
      {path:'data/geo/municipios_ibge_topo.json', type:'topo', source:'data/geo/municipios_ibge_topo.json'},
      {path:'maps/municipios.geojson', type:'geo', source:'maps/municipios.geojson'},
      {path:'data/geo/municipios.geojson', type:'geo', source:'data/geo/municipios.geojson'},
      {path:'https://raw.githubusercontent.com/giovanigianetti/PNDR_4/main/maps/municipios_ibge_topo.json', type:'topo', source:'PNDR_4 remoto'},
      {path:'https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-100-mun.json', type:'geo', source:'geodata-br remoto'}
    ],
    ufs: [
      {path:IBGE_UF, type:'topo', source:'IBGE API de Malhas Geográficas'},
      {path:'maps/ufs_ibge_topo.json', type:'topo', source:'maps/ufs_ibge_topo.json'},
      {path:'data/geo/ufs_ibge_topo.json', type:'topo', source:'data/geo/ufs_ibge_topo.json'},
      {path:'maps/ufs.geojson', type:'geo', source:'maps/ufs.geojson'},
      {path:'data/geo/ufs.geojson', type:'geo', source:'data/geo/ufs.geojson'},
      {path:'https://raw.githubusercontent.com/giovanigianetti/PNDR_4/main/maps/ufs_ibge_topo.json', type:'topo', source:'PNDR_4 remoto'},
      {path:'https://raw.githubusercontent.com/giuliano-macedo/geodata-br-states/master/geojson/br_states.json', type:'geo', source:'geodata-br-states remoto'}
    ]
  };

  const preferredObjects = {
    municipios:['BR_Municipios_2022','BRMU','municipios','municipio','malha_municipal','geojs-100-mun','objects'],
    ufs:['BR_UF_2022','BRUF','ufs','UF','estados','br_states']
  };

  function cleanDigits(v){
    if(v===null || v===undefined || v==='') return '';
    return String(v).replace(/\.0$/,'').replace(/\D/g,'');
  }

  function codesFromProps(props={}){
    const raw = props.cod_mun7 || props.cod_mun6 || props.codarea || props.CD_MUN || props.cd_mun || props.CD_GEOCMU || props.codigo_municipio || props.codigo_ibge || props.code_muni || props.CD_MUN_7 || props.id || props.geocodigo || props.CD_MUNICIP || props.cod_mun || props.codigo || props.GEOCODIGO || props.CD_GEOCODI;
    const s = cleanDigits(raw);
    if(!s) return {cod6:'',cod7:''};
    return {
      cod6: s.length>=7 ? s.slice(0,6) : s.padStart(6,'0'),
      cod7: s.length>=7 ? s.slice(0,7) : s.padStart(7,'0')
    };
  }

  function normalizeMunicipalGeo(geo){
    if(!geo || !Array.isArray(geo.features)) return geo;
    geo.features.forEach(f=>{
      f.properties = f.properties || {};
      const c = codesFromProps(f.properties);
      if(c.cod6) f.properties.cod_mun6 = c.cod6;
      if(c.cod7) f.properties.cod_mun7 = c.cod7;
    });
    return geo;
  }

  function geoFromAny(obj, kind){
    if(obj?.type === 'FeatureCollection') return obj;
    if(obj?.objects){
      const objects = obj.objects;
      const keys = Object.keys(objects);
      let key = (preferredObjects[kind] || []).find(k => objects[k]);
      if(!key && kind==='municipios') key = keys.find(k=>/mun|MU|BRMU/i.test(k));
      if(!key && kind==='ufs') key = keys.find(k=>/uf|estado|BRUF/i.test(k));
      key = key || keys[0];
      if(!key) throw new Error('TopoJSON sem objetos geográficos.');
      if(!window.topojson) throw new Error('Biblioteca topojson-client não carregada.');
      return topojson.feature(obj, objects[key]);
    }
    throw new Error('Formato de malha não reconhecido.');
  }

  async function fetchJSON(path){
    const res = await fetch(path, {cache:'force-cache'});
    if(!res.ok) throw new Error(`${res.status} ao carregar ${path}`);
    return res.json();
  }

  function getCoordinateSamples(geometry, out, limit=1200){
    if(!geometry || out.length>=limit) return;
    const t = geometry.type;
    const coords = geometry.coordinates;
    function walk(c){
      if(out.length>=limit || !Array.isArray(c)) return;
      if(typeof c[0] === 'number' && typeof c[1] === 'number'){
        out.push([Number(c[0]), Number(c[1])]);
      } else {
        for(const item of c){ walk(item); if(out.length>=limit) break; }
      }
    }
    if(t==='Polygon' || t==='MultiPolygon' || t==='LineString' || t==='MultiLineString') walk(coords);
  }

  function swapCoordinatesGeometry(geometry){
    if(!geometry || !geometry.coordinates) return geometry;
    function walk(c){
      if(!Array.isArray(c)) return c;
      if(typeof c[0] === 'number' && typeof c[1] === 'number') return [c[1], c[0]];
      return c.map(walk);
    }
    return {...geometry, coordinates: walk(geometry.coordinates)};
  }

  function maybeFixCoordinateOrder(geo){
    const samples = [];
    for(const f of (geo.features || []).slice(0, 200)) getCoordinateSamples(f.geometry, samples, 1200);
    if(!samples.length) return geo;
    const xs = samples.map(d=>d[0]), ys = samples.map(d=>d[1]);
    const xMin = Math.min(...xs), xMax = Math.max(...xs), yMin = Math.min(...ys), yMax = Math.max(...ys);
    const looksSwapped = xMin > -40 && xMax < 15 && yMin > -80 && yMax < -25;
    if(!looksSwapped) return geo;
    return {...geo, features: geo.features.map(f => ({...f, geometry: swapCoordinatesGeometry(f.geometry)}))};
  }

  function validateGeoJSON(geo, kind){
    if(!geo || geo.type !== 'FeatureCollection' || !Array.isArray(geo.features) || !geo.features.length){
      throw new Error('malha sem FeatureCollection válida');
    }
    const types = new Map();
    let polygonCount = 0, pointCount = 0, coded = 0;
    for(const f of geo.features){
      const type = f?.geometry?.type || 'null';
      types.set(type, (types.get(type)||0)+1);
      if(type === 'Polygon' || type === 'MultiPolygon') polygonCount++;
      if(type === 'Point' || type === 'MultiPoint') pointCount++;
      if(kind === 'municipios' && codesFromProps(f.properties || {}).cod6) coded++;
    }
    if(pointCount > polygonCount) throw new Error('malha contém pontos, não polígonos');
    if(kind === 'municipios' && polygonCount < 1000) throw new Error(`malha municipal incompleta (${polygonCount} polígonos)`);
    if(kind === 'ufs' && polygonCount < 20) throw new Error(`malha de UFs incompleta (${polygonCount} polígonos)`);

    const samples = [];
    for(const f of geo.features.slice(0, 350)) getCoordinateSamples(f.geometry, samples, 1500);
    if(!samples.length) throw new Error('malha sem coordenadas amostrais');
    const xs = samples.map(d=>d[0]), ys = samples.map(d=>d[1]);
    const xMin = Math.min(...xs), xMax = Math.max(...xs), yMin = Math.min(...ys), yMax = Math.max(...ys);
    const plausibleLonLat = xMin >= -90 && xMax <= -25 && yMin >= -40 && yMax <= 15;
    if(!plausibleLonLat){
      throw new Error(`coordenadas fora de longitude/latitude do Brasil (${xMin.toFixed(2)}, ${yMin.toFixed(2)}, ${xMax.toFixed(2)}, ${yMax.toFixed(2)})`);
    }
    if(kind === 'municipios' && coded < 500){
      throw new Error(`malha municipal sem códigos suficientes (${coded} feições codificadas)`);
    }
    return {features:geo.features.length, polygonCount, pointCount, coded, bbox:[xMin,yMin,xMax,yMax], types:Object.fromEntries(types)};
  }

  async function loadGeoJSON(kind){
    if(kind==='municipios' && cachedMuniGeo) return cachedMuniGeo;
    if(kind==='ufs' && cachedUfGeo) return cachedUfGeo;
    const errors = [];
    for(const src of MAP_SOURCES[kind]){
      try{
        const obj = await fetchJSON(src.path);
        let geo = geoFromAny(obj, kind);
        geo = maybeFixCoordinateOrder(geo);
        if(kind==='municipios') geo = normalizeMunicipalGeo(geo);
        const stats = validateGeoJSON(geo, kind);
        if(kind==='municipios') { cachedMuniGeo = geo; lastStats.municipios = stats; }
        else { cachedUfGeo = geo; lastStats.ufs = stats; }
        lastSource[kind] = src.source;
        return geo;
      } catch(e){
        errors.push(`${src.source}: ${e.message}`);
      }
    }
    throw new Error(`Falha ao carregar malha de ${kind}. ${errors.join(' | ')}`);
  }

  function init(){
    if(map) return;
    const node = document.getElementById('map');
    if(!node) return;
    map = L.map('map', {
      preferCanvas:false,
      zoomControl:true,
      attributionControl:false,
      minZoom:3,
      maxZoom:10,
      worldCopyJump:false
    }).setView([-14.2, -51.9], 4);

    map.createPane('tilesPane');
    map.getPane('tilesPane').style.zIndex = 190;
    map.createPane('municipiosPane');
    map.getPane('municipiosPane').style.zIndex = 410;
    map.createPane('ufsPane');
    map.getPane('ufsPane').style.zIndex = 430;

    tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:12,
      opacity:0.50,
      pane:'tilesPane',
      attribution:'© OpenStreetMap'
    }).addTo(map);
    L.control.attribution({prefix:false})
      .addAttribution('© OpenStreetMap')
      .addAttribution('Malhas: IBGE API/PNDR_4')
      .addTo(map);

    legend = L.control({position:'bottomright'});
    legend.onAdd = () => {
      const div = L.DomUtil.create('div','legend');
      div.innerHTML = 'Carregando legenda...';
      return div;
    };
    legend.addTo(map);
    setTimeout(()=>invalidate(), 150);
  }

  function computeMapData(state){
    const ref = document.getElementById('f_mes').value;
    const n = Number(document.getElementById('f_janela').value || 1);
    const {current, previous, previousComplete} = Transforms.getWindowMonths(state.months, ref, n);
    const filters = Transforms.getActiveFilters(state);
    const cur = Transforms.aggregateBy(state, Transforms.indices(state, filters, current), 'cod_mun');
    const prev = Transforms.aggregateBy(state, Transforms.indices(state, filters, previous), 'cod_mun');
    const metric = document.getElementById('mapIndicator').value;
    const data = new Map();
    for(const m of state.meta.municipios){
      const a = cur.get(m.cod_mun) || Utils.empty();
      const b = prev.get(m.cod_mun) || Utils.empty();
      let val = null;
      if(metric.startsWith('var_')){
        val = previousComplete ? ((Transforms.derived(a, metric.replace('var_','')) || 0) - (Transforms.derived(b, metric.replace('var_','')) || 0)) : null;
      } else if(metric.startsWith('growth_')){
        const base = Transforms.derived(b, metric.replace('growth_',''));
        val = (previousComplete && base) ? (((Transforms.derived(a, metric.replace('growth_','')) || 0) - base) / base) : null;
      } else {
        val = Transforms.derived(a, metric);
      }
      const rec = {value:val, current:a, previous:b, meta:m};
      data.set(String(m.cod_mun), rec);
      data.set(String(m.cod_mun).slice(0,6), rec);
    }
    return {data, metric, previousComplete, filters};
  }

  function cleanValues(values){
    return values.filter(x => x!==null && x!==undefined && Number.isFinite(x)).sort((a,b)=>a-b);
  }

  function percentileBreaks(values, steps=10){
    const v = cleanValues(values);
    if(!v.length) return [];
    function q(p){
      const pos = (v.length - 1) * p;
      const lo = Math.floor(pos), hi = Math.ceil(pos);
      return lo === hi ? v[lo] : v[lo] + (v[hi]-v[lo]) * (pos-lo);
    }
    const out = [];
    for(let i=1; i<steps; i++){
      const val = q(i/steps);
      if(!out.length || Math.abs(val - out[out.length-1]) > 1e-12) out.push(val);
    }
    return out;
  }

  function binIndex(value, breaks){
    let idx = 0;
    while(idx < breaks.length && value > breaks[idx]) idx++;
    return idx;
  }

  function paletteColor(palette, idx, classes){
    if(classes <= 1) return palette[Math.floor(palette.length/2)];
    const p = Math.max(0, Math.min(palette.length-1, Math.round(idx * (palette.length-1) / (classes-1))));
    return palette[p];
  }

  function percentileLabel(idx, classes){
    const lo = Math.round(idx * 100 / classes), hi = Math.round((idx+1) * 100 / classes);
    return `P${lo}–P${hi}`;
  }

  function classify(metric, data){
    const vals = [];
    data.forEach(d => {
      if(d.meta.elegivel_amazonia_azul === 'Sim' && Number.isFinite(d.value)) vals.push(d.value);
    });
    const hasPos = vals.some(v=>v>0), hasNeg = vals.some(v=>v<0);
    const signed = metric.startsWith('var_') || metric.startsWith('growth_') || (hasPos && hasNeg);
    if(!signed){
      const breaks = percentileBreaks(vals, 10);
      return {signed:false, breaks, classes:Math.max(1, breaks.length+1), validCount:vals.length, posCount:vals.filter(v=>v>0).length, negCount:0, zeroCount:vals.filter(v=>v===0).length};
    }
    const pos = vals.filter(v=>v>0), negAbs = vals.filter(v=>v<0).map(v=>Math.abs(v));
    const posBreaks = percentileBreaks(pos, 10), negBreaks = percentileBreaks(negAbs, 10);
    return {signed:true, posBreaks, negBreaks, posClasses:Math.max(1,posBreaks.length+1), negClasses:Math.max(1,negBreaks.length+1), validCount:vals.length, posCount:pos.length, negCount:negAbs.length, zeroCount:vals.filter(v=>v===0).length};
  }

  function colorFor(d, cls){
    if(!d) return '#edf3f7';
    if(d.meta.elegivel_amazonia_azul !== 'Sim') return '#d9e1e8';
    const v = d.value;
    if(!Number.isFinite(v)) return '#e5e7eb';
    if(!cls.signed){
      const idx = binIndex(v, cls.breaks);
      return paletteColor(seq, idx, cls.classes);
    }
    if(v === 0) return '#cbd5e1';
    if(v > 0){
      const idx = binIndex(v, cls.posBreaks);
      return paletteColor(seq, idx, cls.posClasses);
    }
    const idx = binIndex(Math.abs(v), cls.negBreaks);
    return paletteColor(neg, idx, cls.negClasses);
  }

  function fillOpacityFor(d){
    if(!d) return 0.52;
    if(d.meta.elegivel_amazonia_azul !== 'Sim') return 0.58;
    if(!Number.isFinite(d.value)) return 0.62;
    return 0.88;
  }

  function outlineFor(d){
    if(!d) return {color:'#cfd8df', weight:0.28};
    if(d.meta.elegivel_amazonia_azul !== 'Sim') return {color:'#c3ccd4', weight:0.30};
    return {color:'#ffffff', weight:0.34};
  }

  function classLabel(d, cls){
    if(!d) return 'Sem registro na base agregada';
    if(d.meta.elegivel_amazonia_azul !== 'Sim') return 'Não elegível';
    const v = d.value;
    if(!Number.isFinite(v)) return 'Sem dado';
    if(!cls.signed){
      const idx = binIndex(v, cls.breaks);
      return percentileLabel(idx, cls.classes);
    }
    if(v === 0) return 'Estável';
    if(v > 0){
      const idx = binIndex(v, cls.posBreaks);
      return `Crescimento ${percentileLabel(idx, cls.posClasses)}`;
    }
    const idx = binIndex(Math.abs(v), cls.negBreaks);
    return `Queda ${percentileLabel(idx, cls.negClasses)}`;
  }

  function legendRows(palette, classes, labelPrefix='', reverse=false){
    if(!classes) return '';
    const idxs = Array.from({length:classes}, (_,i)=>i);
    if(reverse) idxs.reverse();
    return idxs.map(i => `<i style="background:${paletteColor(palette,i,classes)}"></i>${labelPrefix}${percentileLabel(i,classes)}`).join('<br>');
  }

  function updateLegend(cls, metric){
    const div = document.querySelector('.legend');
    if(!div) return;
    const title = metricName(metric);
    if(!cls.signed){
      div.innerHTML = `<strong>${title}</strong><br><span>Percentis do indicador</span><br>${legendRows(seq, cls.classes)}<br><i style="background:#d9e1e8"></i>Não elegível<br><i style="background:#edf3f7"></i>Sem registro<br><i style="background:#e5e7eb"></i>Sem dado`;
    } else {
      const negRows = cls.negCount ? legendRows(neg, cls.negClasses, 'Queda ', true) : '';
      const posRows = cls.posCount ? legendRows(seq, cls.posClasses, 'Crescimento ') : '';
      div.innerHTML = `<strong>${title}</strong><br><span>Percentis separados</span><br>${negRows}${negRows?'<br>':''}<i style="background:#cbd5e1"></i>Estável${posRows?'<br>'+posRows:''}<br><i style="background:#d9e1e8"></i>Não elegível<br><i style="background:#edf3f7"></i>Sem registro<br><i style="background:#e5e7eb"></i>Sem dado`;
    }
  }

  function metricValueText(metric, v){
    if(metric.includes('share') || metric.includes('growth')) return Utils.formatPercent(v);
    if(metric.includes('valor')) return Utils.formatBRLFull(v);
    return Utils.formatNumber(v);
  }

  function metricName(metric){
    const select = document.getElementById('mapIndicator');
    const opt = select ? Array.from(select.options).find(o => o.value === metric) : null;
    return opt ? opt.textContent : metric;
  }

  function featureRecord(data, feature){
    const c = codesFromProps(feature.properties || {});
    return data.get(c.cod7) || data.get(c.cod6) || null;
  }

  function featureStyle(data, cls, feature){
    const d = featureRecord(data, feature);
    const outline = outlineFor(d);
    return {
      pane:'municipiosPane',
      color:outline.color,
      weight:outline.weight,
      fillColor:colorFor(d, cls),
      fillOpacity:fillOpacityFor(d),
      opacity:1
    };
  }

  function bindTooltipFactory(data, metric, cls){
    return (feature, layer) => {
      const d = featureRecord(data, feature), m = d?.meta || {}, p = feature.properties || {}, v = d?.value;
      const name = m.nome_mun || p.nome || p.name || p.NM_MUN || p.description || p.name_muni || p.nome_municipio || p.NM_MUNICIP || 'Município';
      const uf = m.uf || p.uf || p.UF || p.sigla_uf || '';
      layer.bindTooltip(`<strong>${name}</strong><br>UF: ${uf}<br>${metricName(metric)}: ${metricValueText(metric,v)}<br>Classe: ${classLabel(d,cls)}`, {sticky:true});
      layer.on('mouseover', () => layer.setStyle({weight:1.15,color:'#102a43'}));
      layer.on('mouseout', () => { if(muniLayer) muniLayer.resetStyle(layer); });
    };
  }

  function describeStatus(metric, cls, matchInfo, previousComplete){
    const variation = metric.startsWith('var_') || metric.startsWith('growth_');
    const base = variation && !previousComplete ? 'Variações dependem de janela anterior completa; registros sem base aparecem como sem dado.' : 'Mapa coroplético municipal carregado com escala em percentis.';
    const signed = cls.signed ? ` Positivos: ${cls.posCount}; negativos: ${cls.negCount}; estáveis: ${cls.zeroCount}.` : ` Válidos elegíveis: ${cls.validCount}.`;
    const src = ` Fonte da malha: municípios — ${lastSource.municipios || 'não identificada'} (${lastStats.municipios?.polygonCount || 0} polígonos); UFs — ${lastSource.ufs || 'não identificada'} (${lastStats.ufs?.polygonCount || 0} polígonos).`;
    const match = ` Geometrias municipais associadas à base: ${matchInfo.matched}; sem registro agregado: ${matchInfo.unmatched}.`;
    return base + signed + match + src;
  }

  function countMatches(geo, data){
    let matched = 0, unmatched = 0;
    (geo.features || []).forEach(f => { featureRecord(data,f) ? matched++ : unmatched++; });
    return {matched, unmatched};
  }

  async function render(state){
    init();
    const status = document.getElementById('mapStatus');
    if(status) status.textContent = 'Carregando malha municipal de polígonos e calculando percentis...';
    try{
      const mapData = computeMapData(state);
      const [muniGeo, ufGeo] = await Promise.all([loadGeoJSON('municipios'), loadGeoJSON('ufs')]);
      const {data, metric, previousComplete} = mapData;
      const cls = classify(metric, data);
      updateLegend(cls, metric);

      if(muniLayer){ try{ map.removeLayer(muniLayer); } catch(e){} }
      if(ufLayer){ try{ map.removeLayer(ufLayer); } catch(e){} }

      muniLayer = L.geoJSON(muniGeo, {
        pane:'municipiosPane',
        smoothFactor:0.6,
        style: feature => featureStyle(data, cls, feature),
        onEachFeature: bindTooltipFactory(data, metric, cls)
      }).addTo(map);

      ufLayer = L.geoJSON(ufGeo, {
        pane:'ufsPane',
        smoothFactor:0.8,
        style:{color:'#102a43',weight:1.35,fillOpacity:0,opacity:.95,interactive:false}
      }).addTo(map);

      try{
        lastBounds = ufLayer && ufLayer.getBounds && ufLayer.getBounds().isValid() ? ufLayer.getBounds() : muniLayer.getBounds();
      } catch(e){ lastBounds = null; }

      invalidate();
      if(lastBounds && lastBounds.isValid()){
        setTimeout(() => map.fitBounds(lastBounds, {padding:[6,6], animate:false}), 180);
      }
      const matchInfo = countMatches(muniGeo, data);
      if(status) status.textContent = describeStatus(metric, cls, matchInfo, previousComplete);
    } catch(e){
      console.error(e);
      if(status) status.textContent = `Não foi possível carregar o mapa: ${e.message}`;
    }
  }

  function reset(){
    if(map && lastBounds && lastBounds.isValid()){
      invalidate();
      setTimeout(() => map.fitBounds(lastBounds, {padding:[6,6], animate:false}), 120);
    }
  }

  function invalidate(){
    if(map) setTimeout(() => map.invalidateSize({animate:false}), 120);
  }

  return {render, reset, invalidate};
})();
