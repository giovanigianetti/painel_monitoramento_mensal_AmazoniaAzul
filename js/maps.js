const MapController = (() => {
  let map, muniLayer, ufLayer, legend, geoCache = {}; 
  const seq = ['#d7eff9','#9dd5ea','#4fa4ca','#176b93'];
  const neg = ['#fee2c5','#f59e0b','#dc6b19','#b91c1c'];
  function codeFromProps(props){
    const c = props?.codarea || props?.CD_MUN || props?.CD_GEOCMU || props?.code_muni || props?.id || props?.geocodigo || props?.codigo_ibge || props?.CD_MUNICIP;
    return c ? String(c).replace(/\D/g,'').padStart(7,'0') : '';
  }
  function ufCodeFromProps(props){ return props?.SIGLA_UF || props?.sigla || props?.UF || props?.NM_UF || ''; }
  async function loadGeoJSON(kind){
    if(geoCache[kind]) return geoCache[kind];
    const manifest = await DataLoader.getJSON('data/geo/manifest_malhas.json');
    const local = kind==='municipios' ? 'data/geo/municipios_ibge_topo.json' : 'data/geo/ufs_ibge_topo.json';
    let geo;
    try{
      const topo = await DataLoader.getJSON(local);
      const objectName = Object.keys(topo.objects)[0];
      geo = topojson.feature(topo, topo.objects[objectName]);
    }catch(e){
      const remote = manifest.maps.remote_fallback[kind];
      geo = await DataLoader.getJSON(remote);
    }
    if(geo && geo.features){
      geo.features = geo.features.map(f=>({type:'Feature',properties:f.properties,geometry:f.geometry}));
    }
    geoCache[kind]=geo;
    return geo;
  }
  function init(){
    if(map) return;
    map = L.map('map', {preferCanvas:true, zoomControl:true}).setView([-14.2,-51.9],4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:10, attribution:'&copy; OpenStreetMap'}).addTo(map);
    legend = L.control({position:'bottomright'}); legend.onAdd = () => { const div=L.DomUtil.create('div','legend'); div.innerHTML='Carregando legenda...'; return div; }; legend.addTo(map);
  }
  function computeMapData(state){
    const ref=document.getElementById('f_mes').value; const n=Number(document.getElementById('f_janela').value||1); const {current,previous,previousComplete}=Transforms.getWindowMonths(state.months, ref, n);
    const filters=Transforms.getActiveFilters(state); const cur=Transforms.aggregateBy(state, Transforms.indices(state,filters,current), 'cod_mun');
    const prev=Transforms.aggregateBy(state, Transforms.indices(state,filters,previous), 'cod_mun');
    const metric=document.getElementById('mapIndicator').value; const data=new Map();
    for(const m of state.meta.municipios){
      const a=cur.get(m.cod_mun)||Utils.empty(); const b=prev.get(m.cod_mun)||Utils.empty(); let val=null;
      if(metric.startsWith('var_')){ val=previousComplete ? (Transforms.derived(a, metric.replace('var_','')) - Transforms.derived(b, metric.replace('var_',''))) : null; }
      else if(metric.startsWith('growth_')){ const base=Transforms.derived(b, metric.replace('growth_','')); val=(previousComplete && base) ? ((Transforms.derived(a, metric.replace('growth_',''))-base)/base) : null; }
      else { val=Transforms.derived(a, metric); }
      data.set(m.cod_mun, {value:val, current:a, previous:b, meta:m});
    }
    return {data, metric, previousComplete};
  }
  function quantiles(values){
    const v=values.filter(x=>x!==null && x!==undefined && !Number.isNaN(x)).sort((a,b)=>a-b);
    if(!v.length) return [];
    function q(p){ const pos=(v.length-1)*p, lo=Math.floor(pos), hi=Math.ceil(pos); return lo===hi?v[lo]:v[lo]+(v[hi]-v[lo])*(pos-lo); }
    return [q(.25),q(.5),q(.75)];
  }
  function classify(metric, data){
    const vals=[]; data.forEach(d=>{ if(d.meta.elegivel_amazonia_azul==='Sim' && d.value!==null && d.value!==undefined && !Number.isNaN(d.value)) vals.push(d.value); });
    const variation = metric.startsWith('var_') || metric.startsWith('growth_');
    if(!variation){ const qs=quantiles(vals); return {variation:false, qs}; }
    const pos=vals.filter(v=>v>0), negv=vals.filter(v=>v<0).map(v=>Math.abs(v));
    return {variation:true, pos:quantiles(pos), neg:quantiles(negv)};
  }
  function colorFor(d, cls){
    if(!d) return '#eef2f4';
    if(d.meta.elegivel_amazonia_azul!=='Sim') return '#f1f3f4';
    const v=d.value;
    if(v===null||v===undefined||Number.isNaN(v)) return '#e5e7eb';
    if(!cls.variation){ const q=cls.qs; if(!q.length) return seq[1]; return v<=q[0]?seq[0]:v<=q[1]?seq[1]:v<=q[2]?seq[2]:seq[3]; }
    if(v===0) return '#cbd5e1';
    if(v>0){ const q=cls.pos; if(!q.length) return seq[1]; return v<=q[0]?seq[0]:v<=q[1]?seq[1]:v<=q[2]?seq[2]:seq[3]; }
    const a=Math.abs(v), q=cls.neg; if(!q.length) return neg[1]; return a<=q[0]?neg[0]:a<=q[1]?neg[1]:a<=q[2]?neg[2]:neg[3];
  }
  function classLabel(d, cls){
    if(!d) return 'Sem dado'; if(d.meta.elegivel_amazonia_azul!=='Sim') return 'Não elegível';
    const v=d.value; if(v===null||v===undefined||Number.isNaN(v)) return 'Sem dado'; if(!cls.variation) return 'Quartil da distribuição'; if(v===0) return 'Estável'; return v>0?'Crescimento':'Queda';
  }
  function updateLegend(cls){
    const div=document.querySelector('.legend'); if(!div) return;
    if(!cls.variation){ div.innerHTML = `<strong>Quartis</strong><br>${seq.map((c,i)=>`<i style="background:${c}"></i>Q${i+1}`).join('<br>')}<br><i style="background:#f1f3f4"></i>Não elegível<br><i style="background:#e5e7eb"></i>Sem dado`; }
    else { div.innerHTML = `<strong>Variação</strong><br><i style="background:${neg[3]}"></i>Queda forte<br><i style="background:${neg[1]}"></i>Queda baixa/moderada<br><i style="background:#cbd5e1"></i>Estável<br><i style="background:${seq[1]}"></i>Crescimento baixo/moderado<br><i style="background:${seq[3]}"></i>Crescimento forte<br><i style="background:#e5e7eb"></i>Sem dado`; }
  }
  async function render(state){
    init(); document.getElementById('mapStatus').textContent='Carregando ou atualizando mapa...';
    setTimeout(()=>{ if(map) map.invalidateSize(); }, 60);
    const [{data, metric, previousComplete}, muniGeo, ufGeo] = await Promise.all([Promise.resolve(computeMapData(state)), loadGeoJSON('municipios'), loadGeoJSON('ufs')]);
    const cls=classify(metric, data); updateLegend(cls);
    if(muniLayer) muniLayer.remove(); if(ufLayer) ufLayer.remove();
    muniLayer = L.geoJSON(muniGeo, {style: feature => { const d=data.get(codeFromProps(feature.properties)); return {color:'#9aa7b0',weight:.35,fillColor:colorFor(d,cls),fillOpacity:.86}; }, onEachFeature: (feature, layer)=>{
      const cod=codeFromProps(feature.properties), d=data.get(cod), m=d?.meta || {}; const a=d?.current || Utils.empty();
      const v=d?.value; const valtxt = metric.includes('share')||metric.includes('growth') ? Utils.formatPercent(v) : metric.includes('valor') ? Utils.formatBRLFull(v) : Utils.formatNumber(v);
      layer.bindTooltip(`<strong>${m.nome_mun||feature.properties?.nome||'Município'}</strong><br>UF: ${m.uf||''}<br>Macrorregião: ${m.macrorregiao_geografica||''}<br>Tipologia territorial: ${m.tipologia_territorial_amazonia_azul||'—'}<br>Elegível ao Programa: ${m.elegivel_amazonia_azul||'—'}<br>Valor contratado: ${Utils.formatBRLFull(a.valor)}<br>Beneficiários: ${Utils.formatNumber(a.beneficiarios)}<br>Contratos: ${Utils.formatNumber(a.contratos)}<br>Participação Amazônia Azul: ${Utils.formatPercent(Utils.pct(a.valor_azul,a.valor))}<br>Participação feminina: ${Utils.formatPercent(Utils.pct(a.valor_mulheres,a.valor))}<br>Indicador do mapa: ${valtxt}<br>Classe: ${classLabel(d,cls)}`);
    }}).addTo(map);
    ufLayer = L.geoJSON(ufGeo, {style:{color:'#1f2937',weight:1.2,fillOpacity:0,interactive:false}}).addTo(map);
    try{ if(!state.mapLoaded) map.fitBounds(muniLayer.getBounds(), {padding:[8,8]}); }catch(e){}
    setTimeout(()=>{ if(map) map.invalidateSize(); }, 120);
    document.getElementById('mapStatus').textContent = previousComplete || !(metric.startsWith('var_')||metric.startsWith('growth_')) ? 'Mapa carregado.' : 'Mapa carregado; variações dependem de janela anterior completa e podem aparecer como sem dado.';
  }
  function reset(){ if(map && muniLayer) map.fitBounds(muniLayer.getBounds(), {padding:[8,8]}); }
  return {render, reset};
})();
