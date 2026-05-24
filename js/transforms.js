const Transforms = (() => {
  const territoryDims = new Set(['macrorregiao_geografica','uf','cod_mun','tipologia_territorial_amazonia_azul']);
  function getVal(state, dim, i){ return state.cube.dicts[dim][state.cube.columns[dim][i]]; }
  function rowMetric(state, metric, i){ return state.cube.metrics[metric][i] || 0; }
  function getWindowMonths(months, ref, n){
    const idx = months.indexOf(ref); if(idx<0) return {current:[], previous:[], complete:false, previousComplete:false};
    const start = Math.max(0, idx-n+1); const current = months.slice(start, idx+1);
    const pEnd = start-1; const pStart = Math.max(0, pEnd-n+1); const previous = pEnd>=0 ? months.slice(pStart,pEnd+1) : [];
    return {current, previous, complete:current.length===n, previousComplete:previous.length===n};
  }
  function getActiveFilters(state, opts={}){
    const f = {};
    for(const dim of state.filterDims){
      if(opts.ignoreTerritory && territoryDims.has(dim)) continue;
      const el = document.getElementById('f_'+dim); if(!el) continue;
      const v = el.value;
      if(v && v !== '__all__') f[dim]=v;
    }
    return f;
  }
  function rowPasses(state, i, filters, monthsSet){
    if(monthsSet && !monthsSet.has(getVal(state,'ano_mes',i))) return false;
    for(const [dim,val] of Object.entries(filters)) if(getVal(state,dim,i)!==val) return false;
    return true;
  }
  function indices(state, filters, months){
    const mset = months ? new Set(months) : null; const n = state.cube.metrics.valor.length; const out=[];
    for(let i=0;i<n;i++) if(rowPasses(state,i,filters,mset)) out.push(i);
    return out;
  }
  function aggregateIndices(state, idxs){
    const a = Utils.empty();
    for(const i of idxs){
      const valor=rowMetric(state,'valor',i), ben=rowMetric(state,'beneficiarios',i), cont=rowMetric(state,'contratos',i);
      a.valor += valor; a.beneficiarios += ben; a.contratos += cont;
      if(getVal(state,'atividade_vinculada_amazonia_azul',i)==='Sim'){ a.valor_azul += valor; a.beneficiarios_azul += ben; a.contratos_azul += cont; }
      if(getVal(state,'sexo_padronizado',i)==='Mulheres'){ a.valor_mulheres += valor; a.beneficiarios_mulheres += ben; a.contratos_mulheres += cont; }
    }
    return a;
  }
  function aggregateBy(state, idxs, dim){
    const map = new Map();
    for(const i of idxs){
      const k = getVal(state,dim,i); if(!map.has(k)) map.set(k, Utils.empty());
      const a=map.get(k), valor=rowMetric(state,'valor',i), ben=rowMetric(state,'beneficiarios',i), cont=rowMetric(state,'contratos',i);
      a.valor+=valor; a.beneficiarios+=ben; a.contratos+=cont;
      if(getVal(state,'atividade_vinculada_amazonia_azul',i)==='Sim'){ a.valor_azul+=valor; a.beneficiarios_azul+=ben; a.contratos_azul+=cont; }
      if(getVal(state,'sexo_padronizado',i)==='Mulheres'){ a.valor_mulheres+=valor; a.beneficiarios_mulheres+=ben; a.contratos_mulheres+=cont; }
    }
    return map;
  }
  function derived(a, indicator){
    if(indicator==='valor'||indicator==='beneficiarios'||indicator==='contratos') return a[indicator]||0;
    if(indicator==='valor_azul') return a.valor_azul||0;
    if(indicator==='beneficiarios_azul') return a.beneficiarios_azul||0;
    if(indicator==='contratos_azul') return a.contratos_azul||0;
    if(indicator==='share_valor_azul') return Utils.pct(a.valor_azul,a.valor);
    if(indicator==='share_beneficiarios_azul') return Utils.pct(a.beneficiarios_azul,a.beneficiarios);
    if(indicator==='share_contratos_azul') return Utils.pct(a.contratos_azul,a.contratos);
    if(indicator==='share_mulheres_valor') return Utils.pct(a.valor_mulheres,a.valor);
    if(indicator==='share_mulheres_beneficiarios') return Utils.pct(a.beneficiarios_mulheres,a.beneficiarios);
    if(indicator==='share_mulheres_contratos') return Utils.pct(a.contratos_mulheres,a.contratos);
    return a[indicator]||0;
  }
  function aggregateMonthly(state, filters){
    const map=aggregateBy(state, indices(state, filters, null), 'ano_mes');
    return state.months.map(m=>({month:m, ...(map.get(m)||Utils.empty())}));
  }
  function comparePeriodsBy(state, filters, dim, currentMonths, previousMonths){
    const cur=aggregateBy(state, indices(state,filters,currentMonths), dim);
    const prev=aggregateBy(state, indices(state,filters,previousMonths), dim);
    const keys=new Set([...cur.keys(),...prev.keys()]); const out=[];
    for(const k of keys){ const a=cur.get(k)||Utils.empty(), b=prev.get(k)||Utils.empty(); out.push({key:k,current:a,previous:b}); }
    return out;
  }
  return {getVal,rowMetric,getWindowMonths,getActiveFilters,rowPasses,indices,aggregateIndices,aggregateBy,derived,aggregateMonthly,comparePeriodsBy};
})();
