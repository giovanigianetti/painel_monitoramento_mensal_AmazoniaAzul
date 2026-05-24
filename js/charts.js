const Charts = (() => {
  const COLORS = {blue:'#176b93', teal:'#16a6a3', sky:'#9dd5ea', gray:'#d7e1e7', orange:'#d97706', red:'#b91c1c', navy:'#0b2f4a'};
  const config = {responsive:true,displayModeBar:false,staticPlot:false};
  const baseFont = {family:'Inter, Segoe UI, Arial',size:12,color:'#17212b'};
  const layoutBase = {
    autosize:true,
    margin:{l:64,r:28,t:52,b:86},
    paper_bgcolor:'rgba(0,0,0,0)',
    plot_bgcolor:'rgba(0,0,0,0)',
    font:baseFont,
    hovermode:'closest',
    separators:',.',
    uniformtext:{mode:'hide',minsize:10},
    dragmode:false,
    uirevision:'dashboard-stable'
  };
  function el(id){ return document.getElementById(id); }
  function truncate(text, max=34){
    const s = String(text ?? '');
    return s.length > max ? s.slice(0, Math.max(0,max-1)) + '…' : s;
  }
  function hasData(values){ return Array.isArray(values) && values.some(v => v !== null && v !== undefined && Number.isFinite(Number(v))); }
  function normalize(values){ return (values||[]).map(v => (v===null || v===undefined || Number.isNaN(v)) ? null : Number(v)); }
  function clear(id, msg='Não há dados disponíveis para a seleção atual'){
    const node=el(id); if(!node) return;
    if(window.Plotly){ try{ Plotly.purge(node); }catch(e){} }
    node.classList.add('chart-empty');
    node.innerHTML = `<div class="no-data">${msg}</div>`;
  }
  function prepareNode(id){
    const node=el(id); if(!node) return null;
    node.classList.remove('chart-empty');
    return node;
  }
  function commonLayout(title, extra={}){
    return {
      ...layoutBase,
      title:{text:title,font:{size:14,color:'#20313d'},x:0,xanchor:'left',y:.98,yanchor:'top'},
      ...extra
    };
  }
  function react(id, traces, layout){
    const node=prepareNode(id); if(!node || !window.Plotly) return;
    node.style.width='100%';
    const h = Number(node.dataset.chartHeight || 0);
    const finalLayout = h ? {...layout, height:h} : layout;
    try{
      Plotly.react(node, traces, finalLayout, config);
      requestAnimationFrame(()=>{ try{ Plotly.Plots.resize(node); }catch(e){} });
    }catch(e){
      console.error('Erro ao renderizar gráfico', id, e);
      clear(id, 'Não foi possível renderizar este gráfico para a seleção atual.');
    }
  }
  function bar(id, x, y, title, opts={}){
    const yy=normalize(y);
    if(!hasData(yy)){ clear(id); return; }
    const labels = (x||[]).map(v=>truncate(v, opts.maxLabel||28));
    const hoverLabels = (x||[]).map(v=>String(v ?? ''));
    react(id, [{
      type:'bar',x:labels,y:yy,orientation:opts.orientation||'v',customdata:hoverLabels,
      marker:{color:opts.color||COLORS.blue},text:opts.text,textposition:opts.textposition||'auto',cliponaxis:false,
      hovertemplate:opts.hovertemplate || '%{customdata}<br>%{y:,.1f}<extra></extra>'
    }], commonLayout(title, {
      xaxis:{automargin:true,tickangle:opts.tickangle ?? -35,tickfont:{size:11},fixedrange:true},
      yaxis:{automargin:true,tickformat:opts.tickformat||'',rangemode:opts.rangemode||'tozero',fixedrange:true},
      margin:opts.margin || layoutBase.margin
    }));
  }
  function hbar(id, labels, values, title, opts={}){
    const xx=normalize(values);
    if(!hasData(xx)){ clear(id); return; }
    const y = (labels||[]).map(v=>truncate(v, opts.maxLabel||46));
    const custom = (labels||[]).map(v=>String(v ?? ''));
    react(id, [{
      type:'bar',x:xx,y,orientation:'h',customdata:custom,
      marker:{color:opts.color||COLORS.blue},text:opts.text,textposition:opts.textposition||'auto',cliponaxis:false,
      hovertemplate:opts.hovertemplate || '%{customdata}<br>%{x:,.1f}<extra></extra>'
    }], commonLayout(title, {
      margin:opts.margin || {l:210,r:36,t:52,b:62},
      xaxis:{automargin:true,tickformat:opts.tickformat||'',rangemode:opts.rangemode||'tozero',zeroline:true,zerolinecolor:'#8fa1ad',fixedrange:true},
      yaxis:{automargin:true,categoryorder:'array',categoryarray:y,tickfont:{size:11},fixedrange:true}
    }));
  }
  function line(id, traces, title, opts={}){
    const valid = (traces||[]).map(t=>({...t, y:normalize(t.y)})).filter(t=>hasData(t.y));
    if(!valid.length){ clear(id); return; }
    react(id, valid.map(t=>({
      type:'scatter',mode:'lines+markers',connectgaps:false,line:{width:2,...(t.line||{})},marker:{size:6,...(t.marker||{})},...t
    })), commonLayout(title, {
      xaxis:{automargin:true,tickfont:{size:11},fixedrange:true},
      yaxis:{automargin:true,tickformat:opts.tickformat||'',rangemode:opts.rangemode||'normal',zeroline:true,zerolinecolor:'#ccd6dd',fixedrange:true},
      legend:{orientation:'h',x:0,y:-.32,xanchor:'left',font:{size:10},traceorder:'normal'},
      margin:opts.margin || {l:66,r:28,t:52,b:104}
    }));
  }
  function groupedBar(id, labels, series, title, opts={}){
    const valid = (series||[]).map(s=>({...s, values:normalize(s.values)})).filter(s=>hasData(s.values));
    if(!valid.length){ clear(id); return; }
    const x = (labels||[]).map(v=>truncate(v, opts.maxLabel||30));
    const custom = (labels||[]).map(v=>String(v ?? ''));
    react(id, valid.map(s=>({type:'bar',x,y:s.values,name:s.name,customdata:custom,marker:{color:s.color||COLORS.blue},text:s.text,textposition:s.textposition||'auto',cliponaxis:false,hovertemplate:s.hovertemplate || opts.hovertemplate || ('%{customdata}<br>'+s.name+': %{y:,.1f}<extra></extra>')})), commonLayout(title, {
      barmode:'group',
      bargap:.18,
      bargroupgap:.08,
      xaxis:{automargin:true,tickangle:opts.tickangle ?? -35,tickfont:{size:11},fixedrange:true},
      yaxis:{automargin:true,tickformat:opts.tickformat||'',rangemode:opts.rangemode||'tozero',zeroline:true,zerolinecolor:'#ccd6dd',fixedrange:true},
      legend:{orientation:'h',x:0,y:-.34,xanchor:'left',font:{size:10}},
      margin:opts.margin || {l:66,r:28,t:52,b:112}
    }));
  }
  function stackedPercent(id, labels, azulShares, title, opts={}){
    const shares=normalize(azulShares);
    if(!hasData(shares)){ clear(id); return; }
    const y = (labels||[]).map(v=>truncate(v, opts.maxLabel||34));
    const azul = shares.map(v => v===null ? 0 : Math.max(0, Math.min(1, v)));
    const nao = azul.map(v => Math.max(0, 1-v));
    const textAzul = azul.map(v => Utils.formatPercent(v));
    react(id, [
      {type:'bar',orientation:'h',x:azul,y,name:'Vinculada à Amazônia Azul',marker:{color:COLORS.blue},text:textAzul,textposition:'inside',insidetextanchor:'middle',hovertemplate:'%{y}<br>Amazônia Azul: %{x:.1%}<extra></extra>'},
      {type:'bar',orientation:'h',x:nao,y,name:'Não vinculada',marker:{color:'#d7e1e7'},text:nao.map(v=>Utils.formatPercent(v)),textposition:'inside',insidetextanchor:'middle',hovertemplate:'%{y}<br>Não vinculada: %{x:.1%}<extra></extra>'}
    ], commonLayout(title, {
      barmode:'stack',
      margin:opts.margin || {l:160,r:36,t:52,b:92},
      xaxis:{automargin:true,tickformat:'.1%',range:[0,1],fixedrange:true},
      yaxis:{automargin:true,categoryorder:'array',categoryarray:y,fixedrange:true},
      legend:{orientation:'h',x:0,y:-.28,xanchor:'left',font:{size:10}}
    }));
  }
  function dotPlot(id, labels, values, title, opts={}){
    const xx=normalize(values);
    if(!hasData(xx)){ clear(id); return; }
    const y = (labels||[]).map(v=>truncate(v, opts.maxLabel||46));
    const custom = (labels||[]).map(v=>String(v ?? ''));
    const text = opts.text || xx.map(v => v===null ? '' : (opts.formatter ? opts.formatter(v) : String(v)));
    const colors = opts.colors || xx.map(v => v > 0 ? COLORS.blue : v < 0 ? COLORS.red : COLORS.gray);
    react(id, [{
      type:'scatter',mode:'markers+text',x:xx,y,customdata:custom,text,
      textposition:opts.textposition||'middle right',textfont:{size:11},cliponaxis:false,
      marker:{size:10,color:colors,line:{color:'white',width:1}},
      hovertemplate:opts.hovertemplate || '%{customdata}<br>Variação: %{x:,.1f}<extra></extra>'
    }], commonLayout(title, {
      margin:opts.margin || {l:240,r:96,t:52,b:74},
      xaxis:{automargin:true,tickformat:opts.tickformat||'',zeroline:true,zerolinecolor:'#8fa1ad',fixedrange:true},
      yaxis:{automargin:true,categoryorder:'array',categoryarray:y,tickfont:{size:11},fixedrange:true},
      showlegend:false
    }));
  }
  function scatter(id, x, y, title, opts={}){
    const xx=normalize(x), yy=normalize(y);
    const points = xx.map((vx,i)=>({x:vx, y:yy[i], custom:(opts.customdata||[])[i], color:(opts.colors||[])[i]}))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    if(!points.length){ clear(id); return; }
    react(id, [{
      type:'scatter',
      mode:'markers',
      x:points.map(p=>p.x),
      y:points.map(p=>p.y),
      customdata:points.map(p=>p.custom),
      marker:{size:9,opacity:.78,color:points.map(p=>p.color||COLORS.blue),line:{color:'white',width:.8}},
      hovertemplate:opts.hovertemplate || '%{customdata}<br>x: %{x:,.1f}<br>y: %{y:.1%}<extra></extra>'
    }], commonLayout(title, {
      margin:opts.margin || {l:80,r:34,t:52,b:78},
      xaxis:{title:{text:opts.xTitle||'',font:{size:12}},automargin:true,tickformat:opts.xTickformat||'',rangemode:'tozero',zeroline:true,zerolinecolor:'#8fa1ad',fixedrange:true},
      yaxis:{title:{text:opts.yTitle||'',font:{size:12}},automargin:true,tickformat:opts.yTickformat||'',zeroline:true,zerolinecolor:'#8fa1ad',fixedrange:true},
      showlegend:false
    }));
  }
  function resizeAll(root=document){
    if(!window.Plotly) return;
    (root||document).querySelectorAll('.js-plotly-plot').forEach(node=>{ try{ Plotly.Plots.resize(node); }catch(e){} });
  }
  function installResizeObserver(root=document){
    if(!('ResizeObserver' in window)) return;
    const ro = new ResizeObserver(entries => {
      for(const entry of entries){
        const plots = entry.target.querySelectorAll ? entry.target.querySelectorAll('.js-plotly-plot') : [];
        plots.forEach(node=>{ try{ Plotly.Plots.resize(node); }catch(e){} });
      }
    });
    root.querySelectorAll('.panel,.chart-card').forEach(node=>ro.observe(node));
    return ro;
  }
  return {bar,hbar,line,groupedBar,stackedPercent,dotPlot,scatter,clear,resizeAll,installResizeObserver,truncate,COLORS};
})();
