// Rupturas & Alertas e Devoluções — agrupados por REDE (accordion, uma rede aberta
// por vez) para não jogar na tela, de uma vez, as lojas de todas as redes juntas.
// A REDE é sempre uma tag colorida (chainChip) e a LOJA é sempre um campo próprio,
// nunca substituído pela tag. Depende de utils.js e data-monitoring.js.

function groupByRede(items, redeGetter){
  const groups = {};
  items.forEach(it=>{ const rede = redeGetter(it); (groups[rede]=groups[rede]||[]).push(it); });
  return Object.entries(groups).sort((a,b)=>b[1].length-a[1].length);
}

// Accordion genérico: uma rede por grupo, com tag colorida no cabeçalho e a
// lista de registros (já com Loja como coluna própria) só visível ao abrir.
function redeAccordionTableHTML(items, redeGetter, opts){
  const groups = groupByRede(items, redeGetter);
  const pageSize = opts.pageSize || 15;
  if(!groups.length) return `<div class="empty-state"><span>🔍</span>${opts.emptyMsg||'Nenhum registro encontrado.'}</div>`;
  return `<div class="accordion">
    ${groups.map(([rede, list], i)=>`
      <details class="acc-item" data-rede="${escHtml(rede)}" ${i===0?'open':''}>
        <summary><span class="rede-header">${chainChip(rede)}</span><span class="acc-count">${list.length} registro${list.length!==1?'s':''}</span></summary>
        <div class="acc-body" style="flex-direction:column;flex-wrap:nowrap;padding:12px 16px;">
          <table class="rupt-table"><thead><tr>${opts.headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${list.slice(0,pageSize).map(opts.rowHTML).join('')}</tbody></table>
          ${list.length>pageSize?`<div style="font-size:11px;color:var(--ink-faint);margin-top:8px;">Mostrando ${pageSize} de ${list.length} — use a busca acima para refinar.</div>`:''}
        </div>
      </details>`).join('')}
  </div>`;
}

// ---------- Resumo de índices de ruptura (Lojas / Ritmo de visita / Agências) ----------
function resumoIndicesRupturaHTML(){
  const rupt = MONITORING.rupturas;
  const byLoja = {};
  rupt.forEach(r=>{ byLoja[r.loja] = (byLoja[r.loja]||0)+1; });
  const topLojas = Object.entries(byLoja).sort((a,b)=>b[1]-a[1]).slice(0,6);

  const byAgencia = {};
  let semAgencia = 0;
  rupt.forEach(r=>{
    const cov = coverageLookupByName(r.loja);
    const ag = cov ? cov.agency : null;
    if(ag) byAgencia[ag] = (byAgencia[ag]||0)+1; else semAgencia++;
  });
  const topAgencias = Object.entries(byAgencia).sort((a,b)=>b[1]-a[1]).slice(0,6);

  const ritmoItems = topLojas.map(([loja])=>{
    const cov = coverageLookupByName(loja);
    if(!cov) return {loja, info: 'loja não encontrada na cobertura (Mapa da Rede)'};
    const rhythm = rhythmFor(cov);
    if(!rhythm) return {loja, info: 'sem dados de dias de visita suficientes'};
    return {loja, info: rhythm.status==='attention'
      ? `⚠️ ritmo irregular — até ${rhythm.maxGap}d sem visitar`
      : `✅ ritmo equilibrado (mediana ${rhythm.med}d)`};
  });

  return `
    <div class="grid2" style="margin-bottom:18px; grid-template-columns:1fr 1fr 1fr;">
      <div class="panel">
        <h3>Lojas <span class="tag">MAIS RUPTURAS</span></h3>
        ${topLojas.map(([loja,n])=>`<div class="bar-row"><div class="name" title="${escHtml(loja)}">${escHtml(loja)}</div><div class="bar-val" style="width:auto;">${n}</div></div>`).join('') || '<div class="empty-state"><span>✅</span>Sem rupturas.</div>'}
      </div>
      <div class="panel">
        <h3>Visitas <span class="tag">RITMO DESSAS LOJAS</span></h3>
        ${ritmoItems.map(x=>`<div class="rhythm-item"><span class="ri-store">${escHtml(x.loja)}</span><span class="ri-meta">${x.info}</span></div>`).join('') || '<div class="empty-state"><span>—</span>Sem dados.</div>'}
      </div>
      <div class="panel">
        <h3>Agências <span class="tag">MAIS AFETADAS</span></h3>
        ${topAgencias.map(([ag,n])=>`<div class="bar-row"><div class="name" title="${escHtml(ag)}">${escHtml(ag)}</div><div class="bar-val" style="width:auto;">${n}</div></div>`).join('') || '<div class="empty-state"><span>—</span>Sem dados.</div>'}
        ${semAgencia ? `<div class="rhythm-explain" style="margin-top:10px;">${semAgencia} ruptura${semAgencia!==1?'s':''} em loja${semAgencia!==1?'s':''} não identificada${semAgencia!==1?'s':''} na cobertura.</div>` : ''}
      </div>
    </div>`;
}

// ---------- Status de cadastro de produtos (dado hoje ignorado no painel) ----------
function statusCadastroProdutosHTML(){
  const rows = (MONITORING.cadastros||[]).filter(r=>r.status && r.status.trim()!=='' && r.produto!=='Produto');
  const total = (MONITORING.cadastros||[]).filter(r=>r.produto!=='Produto').length;
  return `
    <div class="panel" style="margin-bottom:18px;">
      <h3>Status de cadastro de produtos <span class="tag">${rows.length} DE ${total} COM ATENÇÃO</span></h3>
      ${rows.length===0 ? `<div class="empty-state"><span>✅</span>Nenhum cadastro de produto com pendência sinalizada.</div>` : `
        <table class="rupt-table"><thead><tr><th>Rede</th><th>Loja</th><th>Produto</th><th>Status</th></tr></thead>
        <tbody>${rows.map(r=>`<tr><td>${chainChip(detectChainKnown(r.loja))}</td><td>${escHtml(r.loja)}</td><td>${escHtml(r.produto)}</td><td>${escHtml(r.status)}</td></tr>`).join('')}</tbody></table>`}
    </div>`;
}

// ---------- Rupturas & Alertas ----------
let ruptFilterState = {query:'', rede:'ALL'};

function filteredRupturas(){
  let rows = MONITORING.rupturas.filter(r=>r.data>='2025-01-01');
  if(ruptFilterState.rede !== 'ALL') rows = rows.filter(r=>detectChainKnown(r.loja)===ruptFilterState.rede);
  if(ruptFilterState.query){
    const q = ruptFilterState.query;
    rows = rows.filter(r=>r.loja.toLowerCase().includes(q) || (r.produto||'').toLowerCase().includes(q));
  }
  return rows;
}

function renderRupturasAccordion(){
  const rows = filteredRupturas();
  document.getElementById('rupt-accordion-wrap').innerHTML = redeAccordionTableHTML(rows, r=>detectChainKnown(r.loja), {
    headers:['Data','Loja','Produto'],
    rowHTML: r=>`<tr><td>${r.data}</td><td>${escHtml(r.loja)}</td><td><span class="rupt-badge">${escHtml(r.produto)}</span></td></tr>`,
    emptyMsg:'Nenhuma ruptura encontrada com esse filtro.'
  });
}

function renderRupturas(){
  const rupt = MONITORING.rupturas.filter(r=>r.data>='2025-01-01');
  const crit = MONITORING.criticas;
  const redesDisponiveis = [...new Set(MONITORING.rupturas.map(r=>detectChainKnown(r.loja)))].sort();

  return `
    <div style="margin-top:20px;">
      <h3 style="font-family:var(--font-display);font-size:16px;color:var(--brown);margin:0 0 14px;">Resumo de índices de ruptura</h3>
      ${resumoIndicesRupturaHTML()}

      ${statusCadastroProdutosHTML()}

      <div class="panel" style="margin-bottom:18px;">
        <h3>Rupturas <span class="tag">${rupt.filter(r=>r.data>='2026-01-01').length} EM 2026</span></h3>
        <div class="table-controls">
          <input id="rupt-search" class="search" placeholder="Filtrar por loja ou produto...">
          <select class="fsel" id="rupt-rede-filter">
            <option value="ALL">Todas as redes</option>
            ${redesDisponiveis.map(r=>`<option value="${escHtml(r)}">${escHtml(r)}</option>`).join('')}
          </select>
        </div>
        <div id="rupt-accordion-wrap"></div>
      </div>

      <div class="panel">
        <h3>Validades críticas <span class="tag">${crit.length} PRODUTOS PRÓXIMOS DO VENCIMENTO</span></h3>
        ${redeAccordionTableHTML(crit, r=>detectChainKnown(r.loja), {
          headers:['Data aviso','Loja','Produto','Qtd.','Vencimento'],
          rowHTML: r=>`<tr><td>${r.data_aviso}</td><td>${escHtml(r.loja)}</td><td><span class="crit-badge">${escHtml(r.produto)}</span></td><td>${r.quantidade}</td><td style="color:var(--terra);font-weight:700;">${r.vencimento}</td></tr>`,
          emptyMsg:'Nenhuma validade crítica registrada.'
        })}
      </div>
    </div>`;
}

function attachRupturasListeners(){
  renderRupturasAccordion();
  document.getElementById('rupt-search').addEventListener('input', e=>{
    ruptFilterState.query = e.target.value.toLowerCase();
    renderRupturasAccordion();
  });
  document.getElementById('rupt-rede-filter').addEventListener('change', e=>{
    ruptFilterState.rede = e.target.value;
    renderRupturasAccordion();
  });
}

// ---------- Devoluções ----------
let devFilterState = {rede:'ALL', estado:'ALL'};

function devolucaoEstadoBucket(loja){
  const rede = detectChainKnown(loja);
  const estados = estadosForRede(rede);
  if(estados.length === 0) return 'Estado não identificado';
  if(estados.length === 1) return estados[0];
  return `${rede} (múltiplos estados)`;
}

function filteredDevolucoes(){
  let rows = MONITORING.devolucoes;
  if(devFilterState.rede !== 'ALL') rows = rows.filter(r=>detectChainKnown(r.loja)===devFilterState.rede);
  if(devFilterState.estado !== 'ALL') rows = rows.filter(r=>devolucaoEstadoBucket(r.loja)===devFilterState.estado);
  return rows;
}

function renderDevolucoesAccordion(){
  const rows = filteredDevolucoes();
  document.getElementById('dev-accordion-wrap').innerHTML = redeAccordionTableHTML(rows, r=>detectChainKnown(r.loja), {
    headers:['Data','Loja','Valor','NF','CNPJ','Motivo / Observações'],
    rowHTML: r=>`<tr>
      <td>${r.data}</td>
      <td>${escHtml(r.loja)}</td>
      <td style="font-family:var(--font-mono);color:var(--terra);font-weight:600;">R$ ${(r.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
      <td style="color:var(--ink-faint);">—</td>
      <td style="color:var(--ink-faint);">—</td>
      <td><span class="dev-badge" title="${escHtml(r.motivo||'')}">${escHtml((r.motivo||'—').slice(0,60))}${(r.motivo||'').length>60?'…':''}</span></td>
    </tr>`,
    emptyMsg:'Nenhuma devolução encontrada com esse filtro.'
  });
}

// Correlação por REDE: rupturas e devoluções não usam o mesmo padrão de nome de
// loja na fonte (uma vem do relatório de campo, a outra do financeiro/NF), então
// o cruzamento loja-a-loja direto perde a maior parte dos casos. Por rede (que os
// dois lados conseguem identificar de forma confiável) a correlação é robusta.
function correlacaoPorRedeHTML(){
  const ruptByRede = {}, devByRede = {};
  MONITORING.rupturas.forEach(r=>{ const k=detectChainKnown(r.loja); ruptByRede[k]=(ruptByRede[k]||0)+1; });
  MONITORING.devolucoes.forEach(r=>{ const k=detectChainKnown(r.loja); devByRede[k]=(devByRede[k]||0)+(r.valor||0); });
  const redes = [...new Set([...Object.keys(ruptByRede), ...Object.keys(devByRede)])];
  const scored = redes.map(rede=>({
    rede, rupturas: ruptByRede[rede]||0, devValor: devByRede[rede]||0,
    score: (ruptByRede[rede]||0) + (devByRede[rede]||0)/200
  })).sort((a,b)=>b.score-a.score);
  const maxScore = Math.max(1, ...scored.map(s=>s.score));

  // Best-effort: mesma loja aparecendo, com o nome escrito igual, nos dois registros.
  const ruptSet = new Set(MONITORING.rupturas.map(r=>normStoreName(r.loja)));
  const overlapLojas = [...new Set(MONITORING.devolucoes.filter(r=>ruptSet.has(normStoreName(r.loja))).map(r=>r.loja))];

  return `
    <div class="panel" style="margin-bottom:18px;">
      <h3>Correlação por rede — rupturas × devoluções <span class="tag">SEVERIDADE COMBINADA</span></h3>
      <p class="rhythm-explain">Rupturas e devoluções vêm de fontes diferentes (relatório de campo × financeiro/NF) e nem sempre escrevem o nome da loja da mesma forma — por isso a correlação mais confiável hoje é por rede, não por loja individual.</p>
      <table class="rupt-table"><thead><tr><th>Rede</th><th>Rupturas</th><th>Valor devolvido</th><th>Severidade</th></tr></thead>
      <tbody>${scored.map(s=>`<tr>
        <td>${chainChip(s.rede)}</td>
        <td>${s.rupturas}</td>
        <td style="font-family:var(--font-mono);color:var(--terra);">R$ ${s.devValor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        <td><div class="sev-bar"><div class="sev-fill" style="width:${(s.score/maxScore*100).toFixed(0)}%"></div></div></td>
      </tr>`).join('')}</tbody></table>
      ${overlapLojas.length ? `
        <p class="rhythm-explain" style="margin-top:16px;">Lojas com o mesmo nome identificado em ruptura <b>e</b> devolução: ${overlapLojas.map(escHtml).join(', ')}.</p>
      ` : ''}
    </div>`;
}

function renderDevolucoes(){
  const dev = MONITORING.devolucoes;
  const totalDev = dev.reduce((s,r)=>s+(r.valor||0),0);
  const redesDisponiveis = [...new Set(dev.map(r=>detectChainKnown(r.loja)))].sort();
  const estadosDisponiveis = [...new Set(dev.map(r=>devolucaoEstadoBucket(r.loja)))].sort();

  return `
    <div style="margin-top:20px;">
      <div class="kpis" style="margin-bottom:18px;">
        <div class="kpi" style="--accent:var(--terra)">
          <div class="label">Devoluções registradas</div>
          <div class="value">${dev.length}</div>
          <div class="foot">no histórico importado</div>
        </div>
        <div class="kpi" style="--accent:var(--gold-deep)">
          <div class="label">Valor total devolvido</div>
          <div class="value" style="font-size:24px;">R$ ${totalDev.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
          <div class="foot">soma de todos os registros</div>
        </div>
      </div>

      ${correlacaoPorRedeHTML()}

      <div class="panel">
        <h3>Devoluções <span class="tag">AGRUPADAS POR REDE</span></h3>
        <p class="rhythm-explain">Cliente/CNPJ/NF individuais não vêm na planilha de origem hoje (colunas ficam com "—") — data, loja, valor e motivo estão disponíveis.</p>
        <div class="table-controls">
          <select class="fsel" id="dev-rede-filter">
            <option value="ALL">Todas as redes (cliente)</option>
            ${redesDisponiveis.map(r=>`<option value="${escHtml(r)}">${escHtml(r)}</option>`).join('')}
          </select>
          <select class="fsel" id="dev-estado-filter">
            <option value="ALL">Todos os estados</option>
            ${estadosDisponiveis.map(e=>`<option value="${escHtml(e)}">${escHtml(e)}</option>`).join('')}
          </select>
        </div>
        <div id="dev-accordion-wrap"></div>
      </div>
    </div>`;
}

function attachDevolucoesListeners(){
  renderDevolucoesAccordion();
  document.getElementById('dev-rede-filter').addEventListener('change', e=>{
    devFilterState.rede = e.target.value;
    renderDevolucoesAccordion();
  });
  document.getElementById('dev-estado-filter').addEventListener('change', e=>{
    devFilterState.estado = e.target.value;
    renderDevolucoesAccordion();
  });
}
