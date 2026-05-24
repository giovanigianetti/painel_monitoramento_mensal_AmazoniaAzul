const Charts = (() => {
  const layoutBase = {
    autosize:true,
    margin:{l:70,r:24,t:48,b:86},
    paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',
    font:{family:'Inter, Segoe UI, Arial',size:12,color:'#17212b'},
    hovermode:'closest'
  };
  const config = {responsive:true,displayModeBar:false};
  function hasData(values){ return Array.isArray(values) && values.some(v=>v!==null && v!==undefined && !Number.isNaN(v) && Number(v)!==0); }
  function empty(id){ const el=document.getElementById(id); if(el) el.innerHTML='<div class="empty-message">Não há dados disponíveis para a seleção atual.</div>'; }
  function trunc(s, n=28){ s=String(s??''); return s.length>n ? s.slice(0,n-1)+'…' : s; }
  function height(id, min=360){ const el=document.getElementById(id); return Math.max(min, el?.clientHeight || min); }
  function bar(id, x, y, title, opts={}){
    if(!hasData(y)) return empty(id);
    const labels=x.map(v=>trunc(v, opts.truncate||26));
    Plotly.react(id, [{type:'bar',x:labels,y,customdata:x,orientation:opts.orientation||'v',marker:{color:opts.color||'#176b93'},text:opts.text,textposition:opts.textposition||'auto',cliponaxis:false,hovertemplate:opts.hovertemplate||'%{customdata}<br>%{y}<extra></extra>'}], {...layoutBase,height:height(id),title:{text:title,font:{size:14}},xaxis:{automargin:true,tickangle:opts.tickangle??-32},yaxis:{automargin:true,tickformat:opts.tickformat||''}}, config);
  }
  function hbar(id, labels, values, title, opts={}){
    if(!hasData(values)) return empty(id);
    const full=labels.slice(); const short=labels.map(v=>trunc(v, opts.truncate||48));
    Plotly.react(id, [{type:'bar',x:values,y:short,customdata:full,orientation:'h',marker:{color:opts.color||'#176b93'},hovertemplate:opts.hovertemplate||'%{customdata}<br>%{x}<extra></extra>'}], {...layoutBase,height:height(id,460),title:{text:title,font:{size:14}},margin:{l:220,r:36,t:48,b:46},xaxis:{automargin:true,tickformat:opts.tickformat||''},yaxis:{automargin:true,categoryorder:'array',categoryarray:short}}, config);
  }
  function line(id, traces, title, opts={}){
    const yAll=traces.flatMap(t=>t.y||[]); if(!hasData(yAll)) return empty(id);
    Plotly.react(id, traces.map(t=>({type:'scatter',mode:'lines+markers',...t,hovertemplate:t.hovertemplate||'%{x}<br>%{y}<extra></extra>'})), {...layoutBase,height:height(id),title:{text:title,font:{size:14}},xaxis:{automargin:true},yaxis:{automargin:true,tickformat:opts.tickformat||''},legend:{orientation:'h',y:-.32}}, config);
  }
  function groupedBar(id, labels, series, title, opts={}){
    const yAll=series.flatMap(s=>s.values||[]); if(!hasData(yAll)) return empty(id);
    const short=labels.map(v=>trunc(v, opts.truncate||24));
    Plotly.react(id, series.map(s=>({type:'bar',x:short,y:s.values,customdata:labels,name:s.name,marker:{color:s.color},hovertemplate:'%{customdata}<br>'+s.name+': %{y}<extra></extra>'})), {...layoutBase,height:height(id),title:{text:title,font:{size:14}},barmode:'group',xaxis:{automargin:true,tickangle:-28},yaxis:{automargin:true,tickformat:opts.tickformat||''},legend:{orientation:'h',y:-.32}}, config);
  }
  function stackedPercent(id, metricLabel, azulShare, title){
    if(azulShare===null || azulShare===undefined || Number.isNaN(azulShare)) return empty(id);
    const azul=Math.max(0, Math.min(1, azulShare)); const nao=1-azul;
    Plotly.react(id, [
      {type:'bar',orientation:'h',y:[metricLabel],x:[azul],name:'Vinculada à Amazônia Azul',marker:{color:'#176b93'},text:[Utils.formatPercent(azul)],textposition:'inside',insidetextanchor:'middle',hovertemplate:'Vinculada: %{x:.1%}<extra></extra>'},
      {type:'bar',orientation:'h',y:[metricLabel],x:[nao],name:'Não vinculada',marker:{color:'#d7e1e7'},text:[Utils.formatPercent(nao)],textposition:'inside',insidetextanchor:'middle',hovertemplate:'Não vinculada: %{x:.1%}<extra></extra>'}
    ], {...layoutBase,height:height(id,310),title:{text:title,font:{size:14}},barmode:'stack',margin:{l:96,r:28,t:48,b:70},xaxis:{range:[0,1],tickformat:'.0%',automargin:true},yaxis:{automargin:true},legend:{orientation:'h',y:-.35}}, config);
  }
  function pieLikeBar(id, labels, values, title){ bar(id, labels, values, title, {tickformat:'.0%'}); }
  return {bar,hbar,line,groupedBar,stackedPercent,pieLikeBar};
})();
