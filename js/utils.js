(function () {
  const ROOT = window.Amazul = window.Amazul || {};

  const UF_TO_MACRO = {
    AC: 'Norte', AP: 'Norte', AM: 'Norte', PA: 'Norte', RO: 'Norte', RR: 'Norte', TO: 'Norte',
    AL: 'Nordeste', BA: 'Nordeste', CE: 'Nordeste', MA: 'Nordeste', PB: 'Nordeste', PE: 'Nordeste', PI: 'Nordeste', RN: 'Nordeste', SE: 'Nordeste',
    DF: 'Centro-Oeste', GO: 'Centro-Oeste', MT: 'Centro-Oeste', MS: 'Centro-Oeste',
    ES: 'Sudeste', MG: 'Sudeste', RJ: 'Sudeste', SP: 'Sudeste',
    PR: 'Sul', RS: 'Sul', SC: 'Sul'
  };

  const LABELS = {
    valor: 'Valor contratado',
    beneficiarios: 'Beneficiários',
    contratos: 'Contratos',
    shareAzulValor: 'Participação das atividades Amazônia Azul no valor',
    shareAzulBeneficiarios: 'Participação das atividades Amazônia Azul nos beneficiários',
    shareAzulContratos: 'Participação das atividades Amazônia Azul nos contratos',
    shareMulheresValor: 'Participação feminina no valor',
    shareMulheresBeneficiarios: 'Participação feminina nos beneficiários',
    shareMulheresContratos: 'Participação feminina nos contratos',
    ticketContrato: 'Valor médio por contrato',
    ticketBeneficiario: 'Valor médio por beneficiário'
  };

  const MONTH_NAMES = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];

  function stripAccents(str) {
    return String(str ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function norm(str) {
    return stripAccents(String(str ?? '').trim().replace(/\s+/g, ' ')).toLowerCase();
  }

  function nonEmpty(value, fallback = 'Não informado') {
    const s = String(value ?? '').trim();
    return s.length ? s : fallback;
  }

  function parseNumber(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    let s = String(value).trim();
    if (!s) return 0;
    s = s.replace(/R\$|%/g, '').replace(/\s/g, '');
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function padMunicipioCode(value) {
    if (value === null || value === undefined || value === '') return '';
    const digits = String(value).replace(/\.0$/, '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.padStart(7, '0').slice(-7);
  }

  function excelSerialToDate(serial) {
    if (typeof serial !== 'number') return null;
    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    return dateInfo;
  }

  function parseMonth(value) {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date && !isNaN(value)) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
    if (typeof value === 'number') {
      const d = excelSerialToDate(value);
      return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : null;
    }
    const s = String(value).trim();
    let m = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
    if (m) return `${m[2]}-${String(Number(m[1])).padStart(2, '0')}`;
    m = s.match(/^(\d{4})[\/\-](\d{1,2})$/);
    if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}`;
    const dt = new Date(s);
    if (!isNaN(dt)) return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    return null;
  }

  function periodIndex(period) {
    const [y, m] = String(period || '').split('-').map(Number);
    if (!y || !m) return NaN;
    return y * 12 + m;
  }

  function indexToPeriod(idx) {
    const y = Math.floor((idx - 1) / 12);
    const m = idx - y * 12;
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  function periodRange(refPeriod, months) {
    const idx = periodIndex(refPeriod);
    if (!Number.isFinite(idx)) return new Set();
    const set = new Set();
    for (let i = 0; i < months; i++) set.add(indexToPeriod(idx - i));
    return set;
  }

  function previousPeriodRange(refPeriod, months) {
    const idx = periodIndex(refPeriod);
    if (!Number.isFinite(idx)) return new Set();
    const set = new Set();
    for (let i = months; i < months * 2; i++) set.add(indexToPeriod(idx - i));
    return set;
  }

  function formatMonth(period) {
    const [y, m] = String(period || '').split('-').map(Number);
    if (!y || !m) return 'N.D.';
    return `${MONTH_NAMES[m - 1]}/${y}`;
  }

  function formatBRL(value, compact = true) {
    const n = Number(value || 0);
    if (compact && Math.abs(n) >= 1e9) return `R$ ${(n / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`;
    if (compact && Math.abs(n) >= 1e6) return `R$ ${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
    if (compact && Math.abs(n) >= 1e3) return `R$ ${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
  }

  function formatBRLFull(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
  }

  function formatNumber(value, decimals = 0) {
    return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function formatPercent(value, decimals = 1) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'N.D.';
    return `${(Number(value) * 100).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
  }

  function safeDivide(num, den) {
    const n = Number(num || 0), d = Number(den || 0);
    return d ? n / d : null;
  }

  function uniqueSorted(rows, accessor) {
    return Array.from(new Set(rows.map(accessor).filter(v => v !== null && v !== undefined && String(v).trim() !== ''))).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
  }

  function quantiles(values, classes = 4) {
    const vals = values.map(Number).filter(v => Number.isFinite(v)).sort((a, b) => a - b);
    if (!vals.length) return [];
    const breaks = [];
    for (let i = 1; i < classes; i++) {
      const pos = (vals.length - 1) * (i / classes);
      const base = Math.floor(pos);
      const rest = pos - base;
      const val = vals[base] + ((vals[base + 1] ?? vals[base]) - vals[base]) * rest;
      breaks.push(val);
    }
    return Array.from(new Set(breaks));
  }

  function bucketByBreaks(value, breaks) {
    const v = Number(value);
    if (!Number.isFinite(v)) return -1;
    for (let i = 0; i < breaks.length; i++) if (v <= breaks[i]) return i;
    return breaks.length;
  }

  function debounce(fn, wait = 220) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), wait);
    };
  }

  function download(filename, text, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function toCsv(rows) {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [headers.map(esc).join(';')].concat(rows.map(r => headers.map(h => esc(r[h])).join(';'))).join('\n');
  }

  function makeOption(value, label) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label ?? value;
    return opt;
  }

  function setLoadingStep(text) {
    const el = document.getElementById('loadingStep');
    if (el) el.textContent = text;
  }

  function showLoading(show = true) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.toggle('hidden', !show);
  }

  ROOT.utils = {
    UF_TO_MACRO, LABELS, norm, nonEmpty, parseNumber, parseMonth, padMunicipioCode,
    periodIndex, indexToPeriod, periodRange, previousPeriodRange, formatMonth,
    formatBRL, formatBRLFull, formatNumber, formatPercent, safeDivide, uniqueSorted,
    quantiles, bucketByBreaks, debounce, download, toCsv, makeOption, setLoadingStep, showLoading
  };
})();
