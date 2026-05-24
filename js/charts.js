const Charts = (() => {
  const layoutBase = {margin:{l:64,r:20,t:36,b:70},paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',font:{family:'Inter, Segoe UI, Arial',size:12,color:'#17212b'},hovermode:'closest'};
  const config = {responsive:true,displayModeBar:false};
  function bar(id, x, y, title, opts={}){
    Plotly.react(id, [{type:'bar',x,y,orientation:opts.orientation||'v',marker:{color:opts.color||'#176b93'},text:opts.text,hovertemplate:opts.hovertemplate||'%{x}<br>%{y}<extra></extra>'}], {...layoutBase,title:{text:title,font:{size:14}},xaxis:{automargin:true,tickangle:opts.tickangle??-35},yaxis:{automargin:true,tickformat:opts.tickformat||''}}, config);
  }
  function hbar(id, labels, values, title, opts={}){
    Plotly.react(id, [{type:'bar',x:values,y:labels,orientation:'h',marker:{color:opts.color||'#176b93'},hovertemplate:opts.hovertemplate||'%{y}<br>%{x}<extra></extra>'}], {...layoutBase,title:{text:title,font:{size:14}},margin:{l:180,r:20,t:36,b:40},xaxis:{automargin:true,tickformat:opts.tickformat||''},yaxis:{automargin:true,categoryorder:'array',categoryarray:labels}}, config);
  }
  function line(id, traces, title, opts={}){
    Plotly.react(id, traces.map(t=>({type:'scatter',mode:'lines+markers',...t})), {...layoutBase,title:{text:title,font:{size:14}},xaxis:{automargin:true},yaxis:{automargin:true,tickformat:opts.tickformat||''},legend:{orientation:'h',y:-.25}}, config);
  }
  function groupedBar(id, labels, series, title, opts={}){
    Plotly.react(id, series.map(s=>({type:'bar',x:labels,y:s.values,name:s.name,marker:{color:s.color}})), {...layoutBase,title:{text:title,font:{size:14}},barmode:'group',xaxis:{automargin:true,tickangle:-35},yaxis:{automargin:true,tickformat:opts.tickformat||''},legend:{orientation:'h',y:-.25}}, config);
  }
  function pieLikeBar(id, labels, values, title){ bar(id, labels, values, title, {tickformat:'.0%'}); }
  return {bar,hbar,line,groupedBar,pieLikeBar};
})();
