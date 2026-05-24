const DataLoader = (() => {
  async function getJSON(path){ const r = await fetch(path); if(!r.ok) throw new Error(`Falha ao carregar ${path}: ${r.status}`); return r.json(); }
  async function loadAll(){
    const [cube, meta, bench] = await Promise.all([
      getJSON('data/processed/operacoes_agregadas_publicas.json'),
      getJSON('data/processed/metadata.json'),
      getJSON('data/processed/benchmarking.json')
    ]);
    return {cube, meta, bench};
  }
  return {loadAll, getJSON};
})();
