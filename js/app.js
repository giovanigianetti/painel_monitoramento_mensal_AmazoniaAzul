const App = (() => {
  const state = {cube:null, meta:null, bench:null, months:[], filterDims:[
    'fundo_origem','macrorregiao_geografica','uf','cod_mun','tipologia_territorial_amazonia_azul','atividade_vinculada_amazonia_azul','setor','programa','linha_financiamento','atividade','cnae','porte','finalidade','natureza_contratante','sexo_padronizado','instituicao','faixa_valor_contratado','faixa_taxa_juros','faixa_contratos','faixa_beneficiarios'
  ], activeTab:'overview', mapLoaded:false, munLabel:new Map()};

  const labelDims = {
    setor:'Setor', programa:'Programa', atividade:'Atividade', cnae:'CNAE', porte:'Porte', finalidade:'Finalidade', uf:'UF', cod_mun:'Município', macrorregiao_geografica:'Macrorregião', tipologia_territorial_amazonia_azul:'Tipologia territorial Amazônia Azul', instituicao:'Instituição operadora', natureza_contratante:'Natureza do contratante'
  };
  const rankIndicators = {
    valor:'Valor contratado', beneficiarios:'Beneficiários', contratos:'Contratos',
    share_valor_azul:'Participação das atividades vinculadas no valor', share_beneficiarios_azul:'Participação das atividades vinculadas nos beneficiários', share_contratos_azul:'Participação das atividades vinculadas nos contratos',
    share_mulheres_valor:'Participação feminina no valor', share_mulheres_beneficiarios:'Participação feminina nos beneficiários', share_mulheres_contratos:'Participação feminina nos contratos',
    abs_growth_valor:'Crescimento absoluto do valor', abs_growth_beneficiarios:'Crescimento absoluto dos beneficiários', abs_growth_contratos:'Crescimento absoluto dos contratos',
    pct_growth_valor:'Crescimento percentual do valor', pct_growth_beneficiarios:'Crescimento percentual dos beneficiários', pct_growth_contratos:'Crescimento percentual dos contratos'
  };
  function option(label, value){ const o=document.createElement('option'); o.value=value; o.textContent=label; return o; }
  function fillSelect(id, values, opts={}){
    const el=document.getElementById(id); if(!el) return; el.innerHTML='';
    if(opts.all!==false) el.appendChild(option('Todas', '__all__'));
    values.forEach(v=>el.appendChild(option(opts.labeler?opts.labeler(v):v, v)));
    if(opts.defaultValue!==undefined) el.value=opts.defaultValue;
  }
  function initFilters(){
    state.months = state.meta.months.filter(m=>m!=='Não informado').sort();
    fillSelect('f_mes', state.months, {all:false, labeler:Utils.formatMonth, defaultValue:state.months[state.months.length-1]});
    for(const dim of state.filterDims){
      let vals = (state.cube.dicts[dim]||[]).slice().filter(Boolean);
      if(dim==='cod_mun') vals.sort((a,b)=>(state.munLabel.get(a)||a).localeCompare(state.munLabel.get(b)||b,'pt-BR'));
      else vals.sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));
      const id='f_'+dim;
      fillSelect(id, vals, {labeler: dim==='cod_mun' ? v => state.munLabel.get(v)||v : undefined});
    }
    // enforce requested Sim/Não options for activity
    fillSelect('f_atividade_vinculada_amazonia_azul', ['Sim','Não']);
    fillSelect('rankDimension', Object.keys(labelDims), {all:false, labeler:v=>labelDims[v], defaultValue:'setor'});
    fillSelect('rankIndicator', Object.keys(rankIndicators), {all:false, labeler:v=>rankIndicators[v], defaultValue:'valor'});
    buildBenchmarkOptions();
    document.querySelectorAll('select').forEach(s=>s.addEventListener('change', renderActive));
    document.getElementById('clearFilters').addEventListener('click', () => { for(const dim of state.filterDims){ const el=document.getElementById('f_'+dim); if(el) el.value='__all__'; } document.getElementById('f_janela').value='1'; document.getElementById('f_mes').value=state.months[state.months.length-1]; renderActive(); });
    document.getElementById('resetMap').addEventListener('click', MapController.reset);
  }
  function windowInfo(){ return Transforms.getWindowMonths(state.months, document.getElementById('f_mes').value, Number(document.getElementById('f_janela').value||1)); }
  function currentFilters(extra={}, opts={}){ return {...Transforms.getActiveFilters(state, opts), ...extra}; }
  function idxFor(filters, months){ return Transforms.indices(state, filters, months); }
  function agg(filters, months){ return Transforms.aggregateIndices(state, idxFor(filters, months)); }
  function renderCards(){
    const {current, previous, previousComplete}=windowInfo();
    const base=currentFilters();
    const eleg=agg({...base,elegivel_amazonia_azul:'Sim'}, current);
    const all=agg(base,current);
    const azulEleg=agg({...base,elegivel_amazonia_azul:'Sim',atividade_vinculada_amazonia_azul:'Sim'}, current);
    const fem=agg({...base,elegivel_amazonia_azul:'Sim',sexo_padronizado:'Mulheres'}, current);
    const cards=[
      Utils.makeCard('Valor contratado total nos municípios elegíveis', Utils.formatBRL(eleg.valor), 'Total da janela selecionada'),
      Utils.makeCard('Beneficiários totais nos municípios elegíveis', Utils.formatNumber(eleg.beneficiarios), 'Soma agregada da base pública'),
      Utils.makeCard('Contratos totais nos municípios elegíveis', Utils.formatNumber(eleg.contratos), 'Soma agregada da base pública'),
      Utils.makeCard('Valor contratado em atividades Amazônia Azul', Utils.formatBRL(azulEleg.valor), `${Utils.formatPercent(Utils.pct(azulEleg.valor,eleg.valor))} do total nos municípios elegíveis`),
      Utils.makeCard('Beneficiários em atividades Amazônia Azul', Utils.formatNumber(azulEleg.beneficiarios), `${Utils.formatPercent(Utils.pct(azulEleg.beneficiarios,eleg.beneficiarios))} do total nos municípios elegíveis`),
      Utils.makeCard('Contratos em atividades Amazônia Azul', Utils.formatNumber(azulEleg.contratos), `${Utils.formatPercent(Utils.pct(azulEleg.contratos,eleg.contratos))} do total nos municípios elegíveis`),
      Utils.makeCard('Participação feminina no valor', Utils.formatPercent(Utils.pct(fem.valor,eleg.valor)), 'Pessoas jurídicas e não informados permanecem no denominador'),
      Utils.makeCard('Participação feminina nos beneficiários', Utils.formatPercent(Utils.pct(fem.beneficiarios,eleg.beneficiarios)), 'Numerador: sexo padronizado como Mulheres'),
      Utils.makeCard('Participação feminina nos contratos', Utils.formatPercent(Utils.pct(fem.contratos,eleg.contratos)), 'Numerador: sexo padronizado como Mulheres')
    ];
    document.getElementById('mainCards').innerHTML=cards.join('');
    const azulAll=agg({...base,atividade_vinculada_amazonia_azul:'Sim'}, current);
    document.getElementById('shareCards').innerHTML=[
      Utils.makeCard('Municípios elegíveis no valor total', Utils.formatPercent(Utils.pct(eleg.valor,all.valor)), `${Utils.formatBRL(eleg.valor)} de ${Utils.formatBRL(all.valor)}`),
      Utils.makeCard('Municípios elegíveis nos beneficiários', Utils.formatPercent(Utils.pct(eleg.beneficiarios,all.beneficiarios)), `${Utils.formatNumber(eleg.beneficiarios)} de ${Utils.formatNumber(all.beneficiarios)}`),
      Utils.makeCard('Atividades Amazônia Azul no valor total', Utils.formatPercent(Utils.pct(azulAll.valor,all.valor)), `${Utils.formatBRL(azulAll.valor)} do total geral`),
      Utils.makeCard('Atividades Amazônia Azul nos contratos', Utils.formatPercent(Utils.pct(azulAll.contratos,all.contratos)), `${Utils.formatNumber(azulAll.contratos)} do total geral`)
    ].join('');
    const territory = document.getElementById('f_cod_mun').value!=='__all__' ? state.munLabel.get(document.getElementById('f_cod_mun').value) : (document.getElementById('f_uf').value!=='__all__'?document.getElementById('f_uf').value:'seleção atual');
    document.getElementById('selectionNarrative').innerHTML = `Na <strong>${territory}</strong>, para a janela de referência encerrada em <strong>${Utils.formatMonth(document.getElementById('f_mes').value)}</strong>, os municípios elegíveis somaram <strong>${Utils.formatBRL(eleg.valor)}</strong>, <strong>${Utils.formatNumber(eleg.beneficiarios)}</strong> beneficiários e <strong>${Utils.formatNumber(eleg.contratos)}</strong> contratos. As atividades vinculadas à Amazônia Azul responderam por <strong>${Utils.formatPercent(Utils.pct(azulEleg.valor,eleg.valor))}</strong> do valor contratado nos municípios elegíveis. Os municípios elegíveis representaram <strong>${Utils.formatPercent(Utils.pct(eleg.valor,all.valor))}</strong> do valor total da base filtrada, enquanto as atividades Amazônia Azul representaram <strong>${Utils.formatPercent(Utils.pct(azulAll.valor,all.valor))}</strong> do total geral. A participação feminina no valor contratado dos municípios elegíveis foi de <strong>${Utils.formatPercent(Utils.pct(fem.valor,eleg.valor))}</strong>.`;
    Charts.groupedBar('chart_shares', ['Valor','Beneficiários','Contratos'], [
      {name:'Municípios elegíveis / total geral', values:[Utils.pct(eleg.valor,all.valor),Utils.pct(eleg.beneficiarios,all.beneficiarios),Utils.pct(eleg.contratos,all.contratos)], color:'#176b93'},
      {name:'Atividades Amazônia Azul / total geral', values:[Utils.pct(azulAll.valor,all.valor),Utils.pct(azulAll.beneficiarios,all.beneficiarios),Utils.pct(azulAll.contratos,all.contratos)], color:'#16a6a3'}
    ], 'Participações no total geral da base filtrada', {tickformat:'.0%'});
  }
  function renderTemporal(){
    const {current}=windowInfo(); const filters=currentFilters(); const monthly=Transforms.aggregateMonthly(state, filters).filter(d=>current.includes(d.month)); const mode=document.getElementById('temporalMode').value;
    for(const m of ['valor','beneficiarios','contratos']){
      const total=monthly.reduce((s,d)=>s+(d[m]||0),0); const y=monthly.map(d=> mode==='share' ? Utils.pct(d[m],total) : d[m]);
      Charts.line('chart_ts_'+m, [{x:monthly.map(d=>Utils.formatMonth(d.month)), y, name:Utils.metricLabel(m), line:{color:'#176b93'}}], `Evolução mensal — ${Utils.metricLabel(m)}`, {tickformat: mode==='share'?'.0%':''});
    }
  }
  function renderTerritoryComparison(){
    const {current}=windowInfo(); const base=currentFilters({}, {ignoreTerritory:true}); const mode=document.getElementById('territoryMode').value;
    const territories=[['Brasil',{}],['Norte',{macrorregiao_geografica:'Norte'}],['Nordeste',{macrorregiao_geografica:'Nordeste'}],['Centro-Oeste',{macrorregiao_geografica:'Centro-Oeste'}],['Sudeste',{macrorregiao_geografica:'Sudeste'}],['Sul',{macrorregiao_geografica:'Sul'}]];
    const uf=document.getElementById('f_uf').value, mun=document.getElementById('f_cod_mun').value;
    if(uf!=='__all__') territories.push([uf,{uf}]);
    if(mun!=='__all__') territories.push([state.munLabel.get(mun)||mun,{cod_mun:mun}]);
    for(const metric of ['valor','beneficiarios','contratos']){
      const vals=territories.map(([_,extra])=>agg({...base,...extra},current)[metric]); const total=vals.reduce((a,b)=>a+b,0); const y=mode==='share'?vals.map(v=>Utils.pct(v,total)):vals;
      Charts.bar('chart_terr_'+metric, territories.map(t=>t[0]), y, `Comparação territorial — ${Utils.metricLabel(metric)}`, {tickformat:mode==='share'?'.0%':''});
    }
  }
  function renderOverview(){ renderCards(); renderTemporal(); renderTerritoryComparison(); }
  function rankValue(ind, cur, prev){
    if(ind.startsWith('abs_growth_')){ const m=ind.replace('abs_growth_',''); return (cur[m]||0)-(prev[m]||0); }
    if(ind.startsWith('pct_growth_')){ const m=ind.replace('pct_growth_',''); return prev[m] ? ((cur[m]||0)-(prev[m]||0))/prev[m] : null; }
    return Transforms.derived(cur, ind);
  }
  function renderRankings(){
    const dim=document.getElementById('rankDimension').value, ind=document.getElementById('rankIndicator').value; const {current,previous}=windowInfo(); const filters=currentFilters();
    const comps=Transforms.comparePeriodsBy(state, filters, dim, current, previous).map(d=>({label: dim==='cod_mun'?(state.munLabel.get(d.key)||d.key):d.key, value:rankValue(ind,d.current,d.previous)})).filter(d=>d.value!==null && d.value!==undefined && !Number.isNaN(d.value) && String(d.label).trim()!=='' && d.label!=='Não informado');
    const top=comps.slice().sort((a,b)=>b.value-a.value).slice(0,10).reverse(); const bottom=comps.slice().filter(d=>d.value!==0).sort((a,b)=>a.value-b.value).slice(0,10).reverse();
    const tick = ind.includes('share')||ind.includes('pct_growth') ? '.0%' : '';
    Charts.hbar('chart_rank_top', top.map(d=>d.label), top.map(d=>d.value), `Top 10 — ${rankIndicators[ind]}`, {tickformat:tick,color:'#176b93'});
    Charts.hbar('chart_rank_bottom', bottom.map(d=>d.label), bottom.map(d=>d.value), `Bottom 10 — ${rankIndicators[ind]}`, {tickformat:tick,color:'#d97706'});
  }
  function renderTipologyParticipation(){
    const mode=document.getElementById('tipologyMode').value; const {current}=windowInfo(); const map=Transforms.aggregateBy(state, idxFor(currentFilters(),current), 'tipologia_territorial_amazonia_azul'); const labels=[...map.keys()].filter(k=>k!=='Não elegível').sort(); const total=Transforms.aggregateIndices(state, idxFor(currentFilters(),current));
    for(const metric of ['valor','beneficiarios','contratos']){
      const vals=labels.map(l=>{ const a=map.get(l)||Utils.empty(); if(mode==='shareTotal') return Utils.pct(a[metric], total[metric]); if(mode==='shareTip') return Utils.pct(a[metric+'_azul'], a[metric]); return a[metric]; });
      Charts.bar('chart_tip_'+metric, labels, vals, `${Utils.metricLabel(metric)} por tipologia`, {tickformat:mode==='abs'?'':'.0%'});
    }
  }
  function renderIncrease(){
    const lvl=document.getElementById('increaseLevel').value, metric=document.getElementById('increaseMetric').value; const {current,previous,previousComplete}=windowInfo(); const filters={...currentFilters(),atividade_vinculada_amazonia_azul:'Sim'};
    const comps=Transforms.comparePeriodsBy(state, filters, lvl, current, previous); const counts={Aumentou:0,Reduziu:0,Estável:0,'Sem base anterior':0};
    for(const d of comps){ const c=d.current[metric]||0, p=d.previous[metric]||0; if(!previousComplete||p===0) counts['Sem base anterior']++; else if(c>p) counts.Aumentou++; else if(c<p) counts.Reduziu++; else counts.Estável++; }
    document.getElementById('increaseCards').innerHTML=Object.entries(counts).map(([k,v])=>Utils.makeCard(k,Utils.formatNumber(v),`${labelDims[lvl]||lvl}`)).join('');
    Charts.bar('chart_increase', Object.keys(counts), Object.values(counts), `Classificação da variação — ${Utils.metricLabel(metric)}`);
  }
  function renderEvoTipology(){
    const metric=document.getElementById('evoTipMetric').value; const filters=currentFilters(); const idxs=idxFor(filters,null); const monthlyTip=new Map();
    for(const i of idxs){ const m=Transforms.getVal(state,'ano_mes',i), tip=Transforms.getVal(state,'tipologia_territorial_amazonia_azul',i); if(tip==='Não elegível') continue; const key=m+'|'+tip; if(!monthlyTip.has(key)) monthlyTip.set(key, Utils.empty()); const a=monthlyTip.get(key), valor=Transforms.rowMetric(state,'valor',i), ben=Transforms.rowMetric(state,'beneficiarios',i), cont=Transforms.rowMetric(state,'contratos',i); a.valor+=valor; a.beneficiarios+=ben; a.contratos+=cont; if(Transforms.getVal(state,'atividade_vinculada_amazonia_azul',i)==='Sim'){a.valor_azul+=valor;a.beneficiarios_azul+=ben;a.contratos_azul+=cont;} if(Transforms.getVal(state,'sexo_padronizado',i)==='Mulheres'){a.valor_mulheres+=valor;a.beneficiarios_mulheres+=ben;a.contratos_mulheres+=cont;} }
    const tips=[...new Set([...monthlyTip.keys()].map(k=>k.split('|')[1]))].sort(); const traces=tips.map(tip=>({name:tip,x:state.months.map(Utils.formatMonth),y:state.months.map(m=>Transforms.derived(monthlyTip.get(m+'|'+tip)||Utils.empty(), metric))}));
    Charts.line('chart_evo_tipology', traces, 'Evolução por tipologia territorial', {tickformat:metric.includes('share')?'.0%':''});
  }
  function buildBenchmarkOptions(){
    const opts=[['Brasil|Brasil','Brasil'],['Total dos municípios elegíveis|Municípios elegíveis','Total dos municípios elegíveis']];
    ['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'].forEach(v=>opts.push(['Macrorregião|'+v, 'Macrorregião: '+v]));
    (state.cube.dicts.uf||[]).slice().sort().forEach(v=>opts.push(['UF|'+v, 'UF: '+v]));
    (state.cube.dicts.tipologia_territorial_amazonia_azul||[]).filter(v=>v!=='Não elegível').sort().forEach(v=>opts.push(['Tipologia territorial Amazônia Azul|'+v, 'Tipologia: '+v]));
    state.meta.municipios.filter(m=>m.elegivel_amazonia_azul==='Sim').slice(0,1500).forEach(m=>opts.push(['Município|'+m.cod_mun, 'Município: '+m.nome_mun+' ('+m.uf+')']));
    for(const id of ['benchA','benchB']){ const el=document.getElementById(id); el.innerHTML=''; opts.forEach(([v,l])=>el.appendChild(option(l,v))); }
    document.getElementById('benchB').value='Total dos municípios elegíveis|Municípios elegíveis';
  }
  function benchAgg(value){
    const [typ,val]=value.split('|'); const {current}=windowInfo(); const base=currentFilters({}, {ignoreTerritory:true}); const extra={};
    if(typ==='Total dos municípios elegíveis') extra.elegivel_amazonia_azul='Sim';
    if(typ==='Macrorregião') extra.macrorregiao_geografica=val; if(typ==='UF') extra.uf=val; if(typ==='Tipologia territorial Amazônia Azul') extra.tipologia_territorial_amazonia_azul=val; if(typ==='Município') extra.cod_mun=val;
    return agg({...base,...extra},current);
  }
  function renderBenchmark(){
    const a=benchAgg(document.getElementById('benchA').value), b=benchAgg(document.getElementById('benchB').value);
    const rows=[['Valor total','valor',Utils.formatBRLFull],['Valor Amazônia Azul','valor_azul',Utils.formatBRLFull],['Beneficiários totais','beneficiarios',Utils.formatNumber],['Beneficiários Amazônia Azul','beneficiarios_azul',Utils.formatNumber],['Contratos totais','contratos',Utils.formatNumber],['Contratos Amazônia Azul','contratos_azul',Utils.formatNumber],['Part. Amazônia Azul no valor','share_valor_azul',Utils.formatPercent],['Part. Amazônia Azul nos beneficiários','share_beneficiarios_azul',Utils.formatPercent],['Part. Amazônia Azul nos contratos','share_contratos_azul',Utils.formatPercent],['Part. feminina no valor','share_mulheres_valor',Utils.formatPercent],['Part. feminina nos beneficiários','share_mulheres_beneficiarios',Utils.formatPercent],['Part. feminina nos contratos','share_mulheres_contratos',Utils.formatPercent]];
    const body=document.querySelector('#benchTable tbody'); body.innerHTML='';
    rows.forEach(([label,key,fmt])=>{ const va=Transforms.derived(a,key), vb=Transforms.derived(b,key); const abs=(va??0)-(vb??0); const pp=key.includes('share')?abs:null; const rel=vb?abs/vb:null; const tr=document.createElement('tr'); tr.innerHTML=`<td>${label}</td><td>${fmt(va)}</td><td>${fmt(vb)}</td><td>${key.includes('share')?Utils.formatPP(abs):key.includes('valor')?Utils.formatBRLFull(abs):Utils.formatNumber(abs)}</td><td>${pp===null?'—':Utils.formatPP(pp)}</td><td>${Utils.formatPercent(rel)}</td>`; body.appendChild(tr); });
    document.getElementById('benchCards').innerHTML=[Utils.makeCard('Valor total — território',Utils.formatBRL(a.valor),'Comparação selecionada'),Utils.makeCard('Valor total — benchmark',Utils.formatBRL(b.valor),'Base comparativa'),Utils.makeCard('Part. Amazônia Azul — território',Utils.formatPercent(Utils.pct(a.valor_azul,a.valor)),'No valor contratado'),Utils.makeCard('Part. feminina — território',Utils.formatPercent(Utils.pct(a.valor_mulheres,a.valor)),'No valor contratado')].join('');
    Charts.groupedBar('chart_benchmark', ['Valor total','Valor Amazônia Azul','Contratos'], [{name:'Território',values:[a.valor,a.valor_azul,a.contratos],color:'#176b93'},{name:'Benchmark',values:[b.valor,b.valor_azul,b.contratos],color:'#16a6a3'}], 'Comparação sintética');
  }
  function renderIndicators(){ renderTipologyParticipation(); renderIncrease(); renderEvoTipology(); renderBenchmark(); }
  async function renderMethodology(){
    const el=document.getElementById('methodologyContent'); if(el.dataset.loaded) return;
    const r=await fetch('metodologia/metodologia.md'); const md=await r.text(); el.innerHTML=marked.parse(md); el.dataset.loaded='1';
  }
  function renderActive(){
    if(!state.cube) return;
    if(state.activeTab==='overview') renderOverview();
    if(state.activeTab==='detail') renderRankings();
    if(state.activeTab==='indicators') renderIndicators();
    if(state.activeTab==='maps') { MapController.render(state); state.mapLoaded=true; }
    if(state.activeTab==='methodology') renderMethodology();
  }
  function initTabs(){ document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{ document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active')); document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active')); btn.classList.add('active'); document.getElementById(btn.dataset.tab).classList.add('active'); state.activeTab=btn.dataset.tab; renderActive(); })); }
  async function init(){
    try{
      const loaded=await DataLoader.loadAll(); state.cube=loaded.cube; state.meta=loaded.meta; state.bench=loaded.bench;
      state.meta.municipios.forEach(m=>state.munLabel.set(m.cod_mun, `${m.nome_mun} (${m.uf})`));
      document.getElementById('source-period').textContent = `${Utils.formatMonth(state.meta.source_summary.mes_inicial)} – ${Utils.formatMonth(state.meta.source_summary.mes_final)}`;
      document.getElementById('source-summary').textContent = `${Utils.formatNumber(state.meta.source_summary.linhas_base_financiamento)} linhas brutas processadas; ${Utils.formatNumber(state.cube.meta.rows_aggregated)} agregações públicas.`;
      initFilters(); initTabs(); renderOverview();
    }catch(e){ console.error(e); document.querySelector('.content').innerHTML=`<article class="panel"><h2>Erro ao carregar dashboard</h2><p>${e.message}</p></article>`; }
  }
  return {init, state};
})();
window.addEventListener('DOMContentLoaded', App.init);
