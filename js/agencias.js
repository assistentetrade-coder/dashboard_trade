// Aba Agências — cards por estado/agência a partir de AGENCIAS_DATA (transcrito de
// "AGÊNCIAS E PROMOTORAS 2026.xlsx"), usando só: estado, agência, nome, contato,
// formato, fechamento via, redes que atende, quant. lojas atendidas.
// Depende de utils.js e data-agencias.js.

let agenciasFilterState = {query:'', rede:'ALL'};

function agenciaCardFullHTML(a){
  const redesHTML = a.redes.map(r=>chainChip(r.nome, r.qtdLojas!=null ? r.qtdLojas : '—')).join(' ');
  return `
    <div class="agencia-card">
      <div class="ag-top">
        <div>
          <div class="ag-name">${escHtml(a.agencia)}</div>
          <div class="ag-estado">${escHtml(a.estado)}</div>
        </div>
        <div class="ag-lojas">${a.qtdLojasTotal!=null ? a.qtdLojasTotal : '—'}<small> lojas</small></div>
      </div>
      <div class="ag-contato">👤 ${escHtml(a.nome)}</div>
      <div class="ag-meta-row">
        <span>📞 <b>${escHtml(a.contato)}</b></span>
        <span>💬 <b>${escHtml(a.formato||'—')}</b></span>
        ${a.fechamentoVia ? `<span>📤 fechamento via <b>${escHtml(a.fechamentoVia)}</b></span>` : ''}
      </div>
      <div class="ag-redes">${redesHTML}</div>
      ${a.obs ? `<div class="flag-note">⚠️ ${escHtml(a.obs)}</div>` : ''}
    </div>`;
}

function filteredAgencias(){
  let rows = AGENCIAS_DATA;
  if(agenciasFilterState.rede !== 'ALL') rows = rows.filter(a=>a.redes.some(r=>r.nome===agenciasFilterState.rede));
  if(agenciasFilterState.query){
    const q = agenciasFilterState.query;
    rows = rows.filter(a =>
      a.agencia.toLowerCase().includes(q) ||
      a.estado.toLowerCase().includes(q) ||
      a.nome.toLowerCase().includes(q) ||
      a.redes.some(r=>r.nome.toLowerCase().includes(q)));
  }
  return rows;
}

function renderAgenciasGrid(){
  const rows = filteredAgencias();
  const byEstado = {};
  rows.forEach(a=>{ (byEstado[a.estado]=byEstado[a.estado]||[]).push(a); });
  const estados = Object.keys(byEstado).sort();

  document.getElementById('agencias-grid-wrap').innerHTML = estados.length ? estados.map(estado=>`
    <div class="panel" style="margin-bottom:18px;">
      <h3>${escHtml(estado)} <span class="tag">${byEstado[estado].length} AGÊNCIA${byEstado[estado].length!==1?'S':''}</span></h3>
      <div class="agencia-grid">${byEstado[estado].map(agenciaCardFullHTML).join('')}</div>
    </div>`).join('') : `<div class="empty-state"><span>🔍</span>Nenhuma agência encontrada com esse filtro.</div>`;
}

function renderAgencias(){
  const totalLojas = AGENCIAS_DATA.reduce((s,a)=>s+(a.qtdLojasTotal||0),0);
  const totalRedes = new Set(AGENCIAS_DATA.flatMap(a=>a.redes.map(r=>r.nome))).size;
  const estados = [...new Set(AGENCIAS_DATA.map(a=>a.estado))].sort();
  const redes = [...new Set(AGENCIAS_DATA.flatMap(a=>a.redes.map(r=>r.nome)))].sort();

  const html = `
    <div class="info-note">
      <span>🏢</span>
      <span>Contatos e cobertura das agências de trade — dados de "AGÊNCIAS E PROMOTORAS 2026". Use esta aba para saber quem acionar em cada estado/rede, e cobrar melhorias com as informações certas em mãos.</span>
    </div>

    <div class="kpis">
      <div class="kpi" style="--accent:var(--gold-deep)">
        <div class="label">Agências</div>
        <div class="value">${AGENCIAS_DATA.length}</div>
        <div class="foot">em ${estados.length} estados</div>
      </div>
      <div class="kpi" style="--accent:var(--terra)">
        <div class="label">Lojas atendidas (soma)</div>
        <div class="value">${totalLojas.toLocaleString('pt-BR')}</div>
        <div class="foot">onde a planilha traz o número</div>
      </div>
      <div class="kpi" style="--accent:var(--blue)">
        <div class="label">Redes / bandeiras</div>
        <div class="value">${totalRedes}</div>
        <div class="foot">cobertas pelas agências</div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:18px;">
      <div class="table-controls">
        <input class="search" id="agencias-search" placeholder="Buscar por agência, contato, estado ou rede...">
        <select class="fsel" id="agencias-rede-filter">
          <option value="ALL">Todas as redes</option>
          ${redes.map(r=>`<option value="${escHtml(r)}">${escHtml(r)}</option>`).join('')}
        </select>
      </div>
    </div>

    <div id="agencias-grid-wrap"></div>
  `;
  document.getElementById('agencias-content').innerHTML = html;
  renderAgenciasGrid();
  document.getElementById('agencias-search').addEventListener('input', e=>{
    agenciasFilterState.query = e.target.value.toLowerCase();
    renderAgenciasGrid();
  });
  document.getElementById('agencias-rede-filter').addEventListener('change', e=>{
    agenciasFilterState.rede = e.target.value;
    renderAgenciasGrid();
  });
}
