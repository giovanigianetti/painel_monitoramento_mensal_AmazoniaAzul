const MapController = (() => {
  let map, muniLayer, ufLayer, legend, mapRenderer;
  let cachedMuniGeo=null, cachedUfGeo=null, lastBounds=null, lastSource={municipios:null,ufs:null};
  const seq = ['#eaf6fb','#d7eff9','#c3e4f3','#abd9ed','#9ccfe5','#7bbddb','#5ca9cf','#3f91bd','#2a7da8','#176b93'];
  const neg = ['#fff1df','#fee2c5','#fbd0a2','#f9bd7c','#f59e0b','#ee8428','#dc6b19','#c85514','#b94018','#b91c1c'];
  const MAP_SOURCES = {
    municipios: [
      {path:'data/geo/municipios_ibge_topo.json', type:'topo', source:'local PNDR_4'},
      {path:'maps/municipios_ibge_topo.json', type:'topo', source:'local maps/'},
      {path:'data/geo/municipios.geojson', type:'geo', source:'local GeoJSON'},
      {path:'maps/municipios.geojson', type:'geo', source:'local maps/ GeoJSON'},
      {path:'https://raw.githubusercontent.com/giovanigianetti/PNDR_4/main/maps/municipios_ibge_topo.json', type:'topo', source:'PNDR_4 remoto'},
      {path:'https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-100-mun.json', type:'geo', source:'geodata-br remoto'},
      {path:'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application%2Fjson&intrarregiao=municipio&qualidade=minima', type:'topo', source:'IBGE API'}
    ],
    ufs: [
      {path:'data/geo/ufs_ibge_topo.json', type:'topo', source:'local PNDR_4'},
      {path:'maps/ufs_ibge_topo.json', type:'topo', source:'local maps/'},
      {path:'data/geo/ufs.geojson', type:'geo', source:'local GeoJSON'},
      {path:'maps/ufs.geojson', type:'geo', source:'local maps/ GeoJSON'},
      {path:'https://raw.githubusercontent.com/giovanigianetti/PNDR_4/main/maps/ufs_ibge_topo.json', type:'topo', source:'PNDR_4 remoto'},
      {path:'https://raw.githubusercontent.com/giuliano-macedo/geodata-br-states/master/geojson/br_states.json', type:'geo', source:'geodata-br-states remoto'},
      {path:'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application%2Fjson&intrarregiao=UF&qualidade=minima', type:'topo', source:'IBGE API'}
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
    const raw = props.cod_mun7 || props.cod_mun6 || props.codarea || props.CD_MUN || props.cd_mun || props.CD_GEOCMU || props.codigo_municipio || props.codigo_ibge || props.code_muni || props.CD_MUN_7 || props.id || props.geocodigo || props.CD_MUNICIP || props.cod_mun || props.codigo;
    const s=cleanDigits(raw);
    if(!s) return {cod6:'',cod7:''};
    return {
      cod6: s.length>=7 ? s.slice(0,6) : s.padStart(6,'0'),
      cod7: s.length>=7 ? s.slice(0,7) : s
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
    if(obj?.type==='FeatureCollection') return obj;
    if(obj?.objects){
      const objects=obj.objects; const keys=Object.keys(objects);
      let key=(preferredObjects[kind]||[]).find(k=>objects[k]);
      if(!key){
        if(kind==='municipios') key=keys.find(k=>/mun|MU|BRMU/i.test(k));
        if(kind==='ufs') key=keys.find(k=>/uf|estado|BRUF/i.test(k));
      }
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
  async function loadGeoJSON(kind){
    if(kind==='municipios' && cachedMuniGeo) return cachedMuniGeo;
    if(kind==='ufs' && cachedUfGeo) return cachedUfGeo;
    const errors=[];
    for(const src of MAP_SOURCES[kind]){
      try{
        const obj = await fetchJSON(src.path);
        let geo = geoFromAny(obj, kind);
        if(kind==='municipios') geo=normalizeMunicipalGeo(geo);
        if(!geo || !geo.features || !geo.features.length) throw new Error('malha sem feições');
        if(kind==='municipios') cachedMuniGeo=geo; else cachedUfGeo=geo;
        lastSource[kind]=src.source;
        return geo;
      }catch(e){ errors.push(`${src.source}: ${e.message}`); }
    }
    throw new Error(`Falha ao carregar malha de ${kind}. ${errors.join(' | ')}`);
  }
  function init(){
    if(map) return;
    const node=document.getElementById('map');
    if(!node) return;
    mapRenderer = L.canvas({padding:0.5, tolerance:8});
    map = L.map('map', {preferCanvas:true, zoomControl:true, attributionControl:false, renderer:mapRenderer, minZoom:3, maxZoom:10, worldCopyJump:false}).setView([-14.2,-51.9],4);
    L.control.attribution({prefix:false}).addAttribution('Malhas: PNDR_4/IBGE/geodata-br').addTo(map);
    legend = L.control({position:'bottomright'});
    legend.onAdd = () => { const div=L.DomUtil.create('div','legend'); div.innerHTML='Carregando legenda...'; return div; };
    legend.addTo(map);
    setTimeout(()=>invalidate(),120);
  }
  function computeMapData(state){
    const ref=document.getElementById('f_mes').value;
    const n=Number(document.getElementById('f_janela').value||1);
    const {current,previous,previousComplete}=Transforms.getWindowMonths(state.months, ref, n);
    const filters=Transforms.getActiveFilters(state);
    const cur=Transforms.aggregateBy(state, Transforms.indices(state,filters,current), 'cod_mun');
    const prev=Transforms.aggregateBy(state, Transforms.indices(state,filters,previous), 'cod_mun');
    const metric=document.getElementById('mapIndicator').value;
    const data=new Map();
    for(const m of state.meta.municipios){
      const a=cur.get(m.cod_mun)||Utils.empty(); const b=prev.get(m.cod_mun)||Utils.empty(); let val=null;
      if(metric.startsWith('var_')){
        val=previousComplete ? ((Transforms.derived(a, metric.replace('var_',''))||0) - (Transforms.derived(b, metric.replace('var_',''))||0)) : null;
      } else if(metric.startsWith('growth_')){
        const base=Transforms.derived(b, metric.replace('growth_',''));
        val=(previousComplete && base) ? (((Transforms.derived(a, metric.replace('growth_',''))||0)-base)/base) : null;
      } else {
        val=Transforms.derived(a, metric);
      }
      const rec={value:val, current:a, previous:b, meta:m};
      data.set(String(m.cod_mun), rec);
      data.set(String(m.cod_mun).slice(0,6), rec);
    }
    return {data, metric, previousComplete, filters};
  }
  function cleanValues(values){ return values.filter(x=>x!==null && x!==undefined && Number.isFinite(x)).sort((a,b)=>a-b); }
  function percentileBreaks(values, steps=10){
    const v=cleanValues(values); if(!v.length) return [];
    function q(p){ const pos=(v.length-1)*p, lo=Math.floor(pos), hi=Math.ceil(pos); return lo===hi?v[lo]:v[lo]+(v[hi]-v[lo])*(pos-lo); }
    const out=[];
    for(let i=1;i<steps;i++){
      const val=q(i/steps);
      if(!out.length || Math.abs(val-out[out.length-1])>1e-12) out.push(val);
    }
    return out;
  }
  function binIndex(value, breaks){ let idx=0; while(idx<breaks.length && value>breaks[idx]) idx++; return idx; }
  function paletteColor(palette, idx, classes){
    if(classes<=1) return palette[Math.floor(palette.length/2)];
    const p=Math.max(0, Math.min(palette.length-1, Math.round(idx*(palette.length-1)/(classes-1))));
    return palette[p];
  }
  function percentileLabel(idx, classes){
    const lo=Math.round(idx*100/classes), hi=Math.round((idx+1)*100/classes);
    return `P${lo}–P${hi}`;
  }
  function classify(metric, data){
    const vals=[]; data.forEach(d=>{ if(d.meta.elegivel_amazonia_azul==='Sim' && Number.isFinite(d.value)) vals.push(d.value); });
    const hasPos=vals.some(v=>v>0), hasNeg=vals.some(v=>v<0);
    const signed = metric.startsWith('var_') || metric.startsWith('growth_') || (hasPos && hasNeg);
    if(!signed){ const breaks=percentileBreaks(vals, 10); return {signed:false, breaks, classes:Math.max(1,breaks.length+1), validCount:vals.length, posCount:vals.filter(v=>v>0).length, negCount:0, zeroCount:vals.filter(v=>v===0).length}; }
    const pos=vals.filter(v=>v>0), negAbs=vals.filter(v=>v<0).map(v=>Math.abs(v));
    const posBreaks=percentileBreaks(pos, 10), negBreaks=percentileBreaks(negAbs, 10);
    return {signed:true, posBreaks, negBreaks, posClasses:Math.max(1,posBreaks.length+1), negClasses:Math.max(1,negBreaks.length+1), validCount:vals.length, posCount:pos.length, negCount:negAbs.length, zeroCount:vals.filter(v=>v===0).length};
  }
  function colorFor(d, cls){
    if(!d) return '#eef2f4';
    if(d.meta.elegivel_amazonia_azul!=='Sim') return '#f1f3f4';
    const v=d.value;
    if(!Number.isFinite(v)) return '#e5e7eb';
    if(!cls.signed){ const idx=binIndex(v, cls.breaks); return paletteColor(seq, idx, cls.classes); }
    if(v===0) return '#cbd5e1';
    if(v>0){ const idx=binIndex(v, cls.posBreaks); return paletteColor(seq, idx, cls.posClasses); }
    const idx=binIndex(Math.abs(v), cls.negBreaks); return paletteColor(neg, idx, cls.negClasses);
  }
  function classLabel(d, cls){
    if(!d) return 'Sem dado';
    if(d.meta.elegivel_amazonia_azul!=='Sim') return 'Não elegível';
    const v=d.value; if(!Number.isFinite(v)) return 'Sem dado';
    if(!cls.signed){ const idx=binIndex(v, cls.breaks); return percentileLabel(idx, cls.classes); }
    if(v===0) return 'Estável';
    if(v>0){ const idx=binIndex(v, cls.posBreaks); return `Crescimento ${percentileLabel(idx, cls.posClasses)}`; }
    const idx=binIndex(Math.abs(v), cls.negBreaks); return `Queda ${percentileLabel(idx, cls.negClasses)}`;
  }
  function legendRows(palette, classes, labelPrefix='', reverse=false){
    if(!classes) return '';
    const idxs = Array.from({length:classes}, (_,i)=>i);
    if(reverse) idxs.reverse();
    return idxs.map(i=>`<i style="background:${paletteColor(palette,i,classes)}"></i>${labelPrefix}${percentileLabel(i,classes)}`).join('<br>');
  }
  function updateLegend(cls){
    const div=document.querySelector('.legend'); if(!div) return;
    if(!cls.signed){
      div.innerHTML = `<strong>Percentis</strong><br>${legendRows(seq, cls.classes)}<br><i style="background:#f1f3f4"></i>Não elegível<br><i style="background:#e5e7eb"></i>Sem dado`;
    } else {
      const negRows = cls.negCount ? legendRows(neg, cls.negClasses, 'Queda ', true) : '';
      const posRows = cls.posCount ? legendRows(seq, cls.posClasses, 'Crescimento ') : '';
      div.innerHTML = `<strong>Percentis separados</strong><br>${negRows}${negRows?'<br>':''}<i style="background:#cbd5e1"></i>Estável${posRows?'<br>'+posRows:''}<br><i style="background:#e5e7eb"></i>Sem dado`;
    }
  }
  function metricValueText(metric, v){
    if(metric.includes('share')||metric.includes('growth')) return Utils.formatPercent(v);
    if(metric.includes('valor')) return Utils.formatBRLFull(v);
    return Utils.formatNumber(v);
  }
  function featureKey(feature){
    const c=codesFromProps(feature.properties||{});
    return c.cod7 || c.cod6;
  }
  function featureRecord(data, feature){
    const c=codesFromProps(feature.properties||{});
    return data.get(c.cod7) || data.get(c.cod6) || null;
  }
  function featureStyle(data, cls, feature){
    const d=featureRecord(data, feature);
    return {color:'#ffffff',weight:.36,fillColor:colorFor(d,cls),fillOpacity:d?.meta?.elegivel_amazonia_azul==='Não'?0.28:0.86,opacity:1};
  }
  function bindTooltipFactory(data, metric, cls){
    return (feature, layer) => {
      const d=featureRecord(data, feature), m=d?.meta || {}; const a=d?.current || Utils.empty(); const p=feature.properties||{}; const v=d?.value;
      const name=m.nome_mun||p.nome||p.name||p.NM_MUN||p.description||p.name_muni||p.nome_municipio||'Município';
      layer.bindTooltip(`<strong>${name}</strong><br>UF: ${m.uf||''}<br>Macrorregião: ${m.macrorregiao_geografica||''}<br>Tipologia territorial: ${m.tipologia_territorial_amazonia_azul||'—'}<br>Elegível ao Programa: ${m.elegivel_amazonia_azul||'—'}<br>Valor contratado: ${Utils.formatBRLFull(a.valor)}<br>Beneficiários: ${Utils.formatNumber(a.beneficiarios)}<br>Contratos: ${Utils.formatNumber(a.contratos)}<br>Participação Amazônia Azul: ${Utils.formatPercent(Utils.pct(a.valor_azul,a.valor))}<br>Participação feminina: ${Utils.formatPercent(Utils.pct(a.valor_mulheres,a.valor))}<br>Indicador do mapa: ${metricValueText(metric,v)}<br>Classe: ${classLabel(d,cls)}`, {sticky:true});
      layer.on('mouseover', () => layer.setStyle({weight:1.1,color:'#102a43'}));
      layer.on('mouseout', () => { if(muniLayer) muniLayer.resetStyle(layer); });
    };
  }
  function describeStatus(metric, cls, matchInfo, previousComplete){
    const variation = metric.startsWith('var_') || metric.startsWith('growth_');
    const base = variation && !previousComplete ? 'Variações dependem de janela anterior completa; registros sem base aparecem como sem dado.' : 'Mapa carregado com escala em percentis.';
    const signed = cls.signed ? ` Positivos: ${cls.posCount}; negativos: ${cls.negCount}; estáveis: ${cls.zeroCount}.` : ` Válidos: ${cls.validCount}.`;
    const src = ` Fonte da malha: municípios — ${lastSource.municipios||'não identificada'}; UFs — ${lastSource.ufs||'não identificada'}.`;
    const match = ` Geometrias municipais: ${matchInfo.matched} associadas a dados; ${matchInfo.unmatched} sem associação direta.`;
    return base + signed + match + src;
  }
  function countMatches(geo, data){
    let matched=0, unmatched=0;
    (geo.features||[]).forEach(f=>{ featureRecord(data,f) ? matched++ : unmatched++; });
    return {matched, unmatched};
  }
  async function render(state){
    init();
    const status=document.getElementById('mapStatus');
    if(status) status.textContent='Carregando malhas municipais e calculando percentis...';
    try{
      const mapData = computeMapData(state);
      const [muniGeo, ufGeo] = await Promise.all([loadGeoJSON('municipios'), loadGeoJSON('ufs')]);
      const {data, metric, previousComplete} = mapData; const cls=classify(metric, data); updateLegend(cls);
      if(muniLayer){ try{ map.removeLayer(muniLayer); }catch(e){} }
      if(ufLayer){ try{ map.removeLayer(ufLayer); }catch(e){} }
      muniLayer = L.geoJSON(muniGeo, {
        renderer:mapRenderer,
        smoothFactor:1.5,
        style: feature => featureStyle(data, cls, feature),
        onEachFeature: bindTooltipFactory(data, metric, cls)
      }).addTo(map);
      ufLayer = L.geoJSON(ufGeo, {renderer:mapRenderer, smoothFactor:2.0, style:{color:'#1f2937',weight:1.3,fillOpacity:0,opacity:.95,interactive:false}}).addTo(map);
      try{ lastBounds=muniLayer.getBounds(); }catch(e){ lastBounds=null; }
      invalidate();
      if(lastBounds && lastBounds.isValid()) map.fitBounds(lastBounds, {padding:[8,8], animate:false});
      const matchInfo=countMatches(muniGeo, data);
      if(status) status.textContent = describeStatus(metric, cls, matchInfo, previousComplete);
    }catch(e){
      console.error(e);
      if(status) status.textContent = `Não foi possível carregar o mapa: ${e.message}`;
    }
  }
  function reset(){ if(map && lastBounds && lastBounds.isValid()) map.fitBounds(lastBounds, {padding:[8,8], animate:false}); }
  function invalidate(){ if(map) setTimeout(()=>map.invalidateSize({animate:false}), 120); }
  return {render, reset, invalidate};
})();
