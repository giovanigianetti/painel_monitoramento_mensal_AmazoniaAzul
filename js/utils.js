const Utils = (() => {
  const monthsBR = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const fmtNum = new Intl.NumberFormat('pt-BR', {maximumFractionDigits:0});
  const fmt1 = new Intl.NumberFormat('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1});
  const fmt2 = new Intl.NumberFormat('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
  function formatNumber(x){ if(x===null||x===undefined||Number.isNaN(x)) return 'N.D.'; return fmtNum.format(x); }
  function formatBRL(x){ if(x===null||x===undefined||Number.isNaN(x)) return 'N.D.'; const abs=Math.abs(x); const sign=x<0?'-':''; if(abs>=1e9) return `${sign}R$ ${fmt1.format(abs/1e9)} bi`; if(abs>=1e6) return `${sign}R$ ${fmt1.format(abs/1e6)} mi`; if(abs>=1e3) return `${sign}R$ ${fmt1.format(abs/1e3)} mil`; return `${sign}R$ ${fmt2.format(abs)}`; }
  function formatBRLFull(x){ if(x===null||x===undefined||Number.isNaN(x)) return 'N.D.'; return x.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
  function formatPercent(x){ if(x===null||x===undefined||Number.isNaN(x)) return 'N.D.'; return `${fmt1.format(x*100)}%`; }
  function formatPP(x){ if(x===null||x===undefined||Number.isNaN(x)) return 'N.D.'; return `${fmt1.format(x*100)} p.p.`; }
  function formatMonth(m){ if(!m || m==='Não informado') return m||'N.D.'; const [y,mo]=m.split('-').map(Number); return `${monthsBR[(mo||1)-1]}/${y}`; }
  function metricLabel(m){ return {valor:'Valor contratado',beneficiarios:'Beneficiários',contratos:'Contratos'}[m]||m; }
  function metricFormat(m,x){ if(m.includes('share')||m.includes('participacao')||m.includes('growth')) return formatPercent(x); if(m.includes('valor')) return formatBRL(x); return formatNumber(x); }
  function sum(a,b){ a.valor+=b.valor||0; a.beneficiarios+=b.beneficiarios||0; a.contratos+=b.contratos||0; return a; }
  function empty(){ return {valor:0,beneficiarios:0,contratos:0,valor_azul:0,beneficiarios_azul:0,contratos_azul:0,valor_mulheres:0,beneficiarios_mulheres:0,contratos_mulheres:0}; }
  function addTo(acc, metric, v){ acc[metric]=(acc[metric]||0)+v; }
  function pct(num,den){ return den ? num/den : null; }
  function safeDiv(num,den){ return den ? num/den : null; }
  function makeCard(title,value,sub){ return `<article class="card"><h3>${title}</h3><strong>${value}</strong><small>${sub||''}</small></article>`; }
  function downloadText(name, text){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'})); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
  return {formatNumber,formatBRL,formatBRLFull,formatPercent,formatPP,formatMonth,metricLabel,metricFormat,sum,empty,addTo,pct,safeDiv,makeCard,downloadText};
})();
