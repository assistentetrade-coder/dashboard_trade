// "Mapa da Rede" — cobertura de lojas/agências/redes por estado, lida de uma
// planilha de roteiro (upload do usuário) ou dos dados pré-carregados
// (EMBEDDED_STATE, em data-coverage.js). Depende de utils.js.

let STATE = {};
let currentRows = [];
let tableState = {query:'', agency:'ALL', page:0, pageSize:12};
let roteiroDay = 'SEG';

function allRows(){
  return Object.entries(STATE).flatMap(([state, d]) => d.rows.map(r => ({...r, state})));
}

// ---------- Upload / parsing da planilha de roteiro ----------
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');

['dragenter','dragover'].forEach(ev=>dropzone.addEventListener(ev, e=>{e.preventDefault(); dropzone.classList.add('drag');}));
['dragleave','drop'].forEach(ev=>dropzone.addEventListener(ev, e=>{e.preventDefault(); dropzone.classList.remove('drag');}));
dropzone.addEventListener('drop', e=>{ const f = e.dataTransfer.files[0]; if(f) handleFile(f); });
dropzone.addEventListener('click', ()=>fileInput.click());
fileInput.addEventListener('change', e=>{ if(e.target.files[0]) handleFile(e.target.files[0]); });

function handleFile(file){
  const reader = new FileReader();
  reader.onload = (e)=>{
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, {type:'array'});
    parseWorkbook(wb);
    buildChainColorMap();
    document.getElementById('headerRight').innerHTML = `
      <div style="display:flex; gap:10px; align-items:center;">
        <div class="file-pill"><span class="dot"></span>${file.name}</div>
        <button class="btn" onclick="resetApp()">Trocar arquivo</button>
      </div>`;
    document.getElementById('dropzone').style.display = 'none';
    document.getElementById('appView').style.display = 'block';
    renderTabs();
  };
  reader.readAsArrayBuffer(file);
}

function resetApp(){
  STATE = {};
  document.getElementById('dropzone').style.display = 'block';
  document.getElementById('appView').style.display = 'none';
  document.getElementById('headerRight').innerHTML = '';
  fileInput.value = '';
}

function isHeaderish(text){
  if(text == null) return true;
  const up = text.toString().trim().toUpperCase();
  if(!up) return true;
  return HEADER_WORDS.some(w => up === w || up.startsWith(w));
}

// Finds every occurrence of an "AGÊNCIA / LOJAS" header row in a sheet (a sheet can repeat
// this table once per agency block), then reads each block's rows using ITS OWN column
// mapping until the next header (or end of sheet).
function parseWorkbook(wb){
  STATE = {};
  wb.SheetNames.forEach(sheetName=>{
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(ws, {header:1, defval:null, raw:true});

    const headers = []; // {row, agI, loI, vsI, vmI, ddI}
    for(let r=0;r<aoa.length;r++){
      const row = aoa[r];
      if(!row) continue;
      let agI=-1, loI=-1, vsI=-1, vmI=-1, ddI=-1;
      row.forEach((cell,ci)=>{
        if(typeof cell !== 'string') return;
        const c = cell.trim().toUpperCase();
        if(c === 'AGÊNCIA' || c === 'AGENCIA') agI = ci;
        else if(c === 'LOJAS' || c === 'LOJA') loI = ci;
        else if(c.includes('VISITAS POR LOJA') && c.includes('SEMANAL')) vsI = ci;
        else if(c.includes('VISITAS POR LOJA') && (c.includes('MÊS')||c.includes('MES'))) vmI = ci;
        else if(c.includes('DIAS DA SEMANA')) ddI = ci;
      });
      if(agI>-1 && loI>-1) headers.push({row:r, agI, loI, vsI, vmI, ddI});
    }
    if(!headers.length) return;

    const rows = [];
    headers.forEach((h, hi)=>{
      const endRow = hi+1 < headers.length ? headers[hi+1].row : aoa.length;
      for(let r=h.row+1; r<endRow; r++){
        const row = aoa[r];
        if(!row) continue;
        const agencyRaw = row[h.agI];
        const storeRaw = row[h.loI];
        if(storeRaw == null || storeRaw.toString().trim() === '') continue;
        if(isHeaderish(storeRaw)) continue;
        const store = storeRaw.toString().trim();
        const chain = detectChain(store);
        const agency = (agencyRaw==null || agencyRaw.toString().trim()==='') ? '—' : agencyRaw.toString().trim();
        const visitsWeek = h.vsI>-1 ? Number(row[h.vsI])||0 : 0;
        const visitsMonth = h.vmI>-1 ? Number(row[h.vmI])||0 : 0;
        const daysRaw = h.ddI>-1 ? row[h.ddI] : null;
        rows.push({
          agency, store, chain,
          location: extractLocation(store, chain),
          visitsWeek, visitsMonth: visitsMonth || visitsWeek*4,
          days: parseDays(daysRaw ? daysRaw.toString() : '')
        });
      }
    });

    // fill forward the last known agency name for rows where it was blank (merged cells)
    let lastAgency = null;
    rows.forEach(r=>{
      if(r.agency === '—' && lastAgency) r.agency = lastAgency;
      else if(r.agency !== '—') lastAgency = r.agency;
    });

    if(rows.length) STATE[sheetName] = { rows };
  });
}

// ---------- Abas / navegação de estados ----------
function renderTabs(){
  const tabsEl = document.getElementById('tabs');
  const names = Object.keys(STATE);
  const overviewTab = `<div class="tab active" data-state="__OVERVIEW__">🗺️ Mapa da Rede</div>`;
  const stateTabs = names.map(n=>{
    const count = STATE[n].rows.length;
    return `<div class="tab" data-state="${n}">${n}<span class="n">${count}</span></div>`;
  }).join('');
  tabsEl.innerHTML = overviewTab + stateTabs;
  tabsEl.querySelectorAll('.tab').forEach(t=>{
    t.addEventListener('click', ()=>{
      tabsEl.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      if(t.dataset.state === '__OVERVIEW__') renderOverview();
      else renderState(t.dataset.state);
    });
  });
  if(names.length) renderOverview();
  else document.getElementById('content').innerHTML = `<p style="color:var(--ink-dim);padding:40px 0;">Nenhuma tabela de cobertura foi encontrada nas abas desta planilha.</p>`;
}

function goToState(stateName){
  document.querySelectorAll('#tabs .tab').forEach(x=>{
    x.classList.toggle('active', x.dataset.state === stateName);
  });
  renderState(stateName);
  window.scrollTo({top:0, behavior:'smooth'});
}

// Painel, em estado vazio, para "quais produtos cada loja vende" — não há hoje
// uma planilha de vendas por produto integrada ao painel; a estrutura fica
// pronta para quando esse dado existir, sem inventar números.
function salesByProductEmptyPanelHTML(){
  return `
    <div class="panel" style="margin-bottom:18px;">
      <h3>Vendas por produto — o que cada loja vende <span class="tag">EM BREVE</span></h3>
      <div class="empty-note">
        <span>📦</span>
        <span><b>Ainda não há uma planilha de vendas por produto integrada ao painel.</b> Quando esse dado existir (relação de vendas por produto e quais produtos cada loja vende), ele aparece aqui, cruzado com a cobertura de lojas já mostrada acima.</span>
      </div>
    </div>`;
}

// "Mapa da Rede": visão consolidada de todos os pontos de operação no Brasil,
// organizada por estado / agência / rede — não é um mapa geográfico literal
// (a planilha não traz coordenadas), mas dá o panorama completo da cobertura.
function renderOverview(){
  const rows = allRows();
  const states = Object.keys(STATE);
  const totalLojas = rows.length;
  const totalVisitas = rows.reduce((s,r)=>s+(r.visitsMonth||0),0);
  const totalAgencias = new Set(rows.map(r=>r.state+'|'+r.agency)).size;
  const totalRedes = new Set(rows.map(r=>r.chain)).size;

  const byState = states.map(s=>{
    const rs = STATE[s].rows;
    const visitas = rs.reduce((a,r)=>a+(r.visitsMonth||0),0);
    const ags = new Set(rs.map(r=>r.agency));
    const redes = new Set(rs.map(r=>r.chain));
    const topRede = Object.entries(rs.reduce((acc,r)=>{acc[r.chain]=(acc[r.chain]||0)+1; return acc;},{}))
      .sort((a,b)=>b[1]-a[1])[0];
    return {state:s, lojas:rs.length, visitas, agencias:ags.size, redes:redes.size, topRede: topRede?topRede[0]:'—'};
  }).sort((a,b)=>b.lojas-a.lojas);
  const maxLojas = Math.max(1, ...byState.map(s=>s.lojas));

  const byRedeNacional = {};
  rows.forEach(r=>{ byRedeNacional[r.chain] = (byRedeNacional[r.chain]||0)+1; });
  const topRedesNacional = Object.entries(byRedeNacional).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxRedeNacional = topRedesNacional.length ? topRedesNacional[0][1] : 1;

  const html = `
    <div class="info-note">
      <span>🗺️</span>
      <span>Panorama de todos os pontos de operação cadastrados na planilha: <b>${states.length}</b> estado${states.length!==1?'s':''}, <b>${totalAgencias}</b> agências de promotoria e <b>${totalLojas}</b> lojas atendidas. Clique em um estado para ver o detalhe.</span>
    </div>

    <div class="kpis">
      <div class="kpi" style="--accent:var(--gold-deep)">
        <div class="label">Lojas na rede (Brasil)</div>
        <div class="value">${totalLojas}</div>
        <div class="foot">distribuídas em ${states.length} estado${states.length!==1?'s':''}</div>
      </div>
      <div class="kpi" style="--accent:var(--terra)">
        <div class="label">Visitas / mês (Brasil)</div>
        <div class="value">${totalVisitas.toLocaleString('pt-BR')}</div>
        <div class="foot">soma de todos os estados</div>
      </div>
      <div class="kpi" style="--accent:var(--green)">
        <div class="label">Agências de promotoria</div>
        <div class="value">${totalAgencias}</div>
        <div class="foot">operando a cobertura em campo</div>
      </div>
      <div class="kpi" style="--accent:var(--blue)">
        <div class="label">Redes / bandeiras</div>
        <div class="value">${totalRedes}</div>
        <div class="foot">atendidas em todo o território</div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:18px;">
      <h3>Cobertura por estado <span class="tag">CLIQUE PARA ABRIR</span></h3>
      <div class="state-grid">
        ${byState.map((s,i)=>`
          <div class="state-card" data-state="${s.state}" style="--bar:${(s.lojas/maxLojas*100).toFixed(0)}%; --c:${PALETTE[i%PALETTE.length]}">
            <div class="sc-top">
              <span class="sc-name">${s.state}</span>
              <span class="sc-lojas">${s.lojas}<small> lojas</small></span>
            </div>
            <div class="sc-bar-track"><div class="sc-bar-fill"></div></div>
            <div class="sc-meta">
              <span>${s.agencias} agência${s.agencias!==1?'s':''}</span>
              <span>${s.redes} rede${s.redes!==1?'s':''}</span>
              <span>${s.visitas.toLocaleString('pt-BR')} visitas/mês</span>
            </div>
          </div>`).join('')}
      </div>
    </div>

    <div class="panel" style="margin-bottom:18px;">
      <h3>Mapa de calor — concentração de lojas <span class="tag">ESTADO × REDE</span></h3>
      <p class="rhythm-explain">Quanto mais escura a célula, maior a quantidade de lojas daquela rede atendidas no estado. Mostra de relance onde a operação está mais concentrada.</p>
      ${heatmapHTML(byState.map(s=>s.state), rows)}
    </div>

    <div class="panel" style="margin-bottom:18px;">
      <h3>Maiores redes atendidas no país <span class="tag">Nº DE LOJAS</span></h3>
      ${topRedesNacional.map(([name,val])=>{ const c = chainColor(name); return `
        <div class="bar-row">
          <div class="name" title="${name}">${name}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${(val/maxRedeNacional*100).toFixed(1)}%; background:linear-gradient(90deg, ${c}99, ${c})"></div></div>
          <div class="bar-val">${val}</div>
        </div>`;}).join('')}
    </div>

    ${salesByProductEmptyPanelHTML()}
  `;
  document.getElementById('content').innerHTML = html;
  document.querySelectorAll('.state-card').forEach(card=>{
    card.addEventListener('click', ()=>goToState(card.dataset.state));
  });
}

// Agrupa uma lista de lojas por agência e monta um accordion nativo (<details>),
// evitando despejar dezenas de chips soltos na tela de uma vez.
function agencyAccordionHTML(rows){
  const groups = {};
  rows.forEach(r=>{ (groups[r.agency] = groups[r.agency]||[]).push(r); });
  const entries = Object.entries(groups).sort((a,b)=>b[1].length-a[1].length);
  return `<div class="accordion">
    ${entries.map(([agency, list], i)=>`
      <details class="acc-item" ${i===0 ? 'open' : ''}>
        <summary><span>${agency}</span><span class="acc-count">${list.length} loja${list.length!==1?'s':''}</span></summary>
        <div class="acc-body">
          ${list.map(r=>`<span class="mini-chip" ${r.location?`title="📍 ${r.location}"`:''}>${r.store}</span>`).join('')}
        </div>
      </details>`).join('')}
  </div>`;
}

// "Mapa de calor": matriz Estado × Rede com a quantidade de lojas em cada
// cruzamento. A cor segue uma escala de TEMPERATURA de verdade (azul = frio/
// baixa concentração, passando por amarelo, até vermelho = quente/alta
// concentração) — propositalmente fora da paleta da marca, para funcionar
// como uma leitura visual imediata e universal de "onde está mais quente".
function heatTemperatureColor(t){
  // t de 0 a 1. Três faixas: azul→amarelo (0–0.5) e amarelo→vermelho (0.5–1)
  const stops = [
    [0.00, [33, 102, 172]],   // azul frio
    [0.50, [255, 221, 51]],   // amarelo
    [1.00, [191, 26, 26]]     // vermelho quente
  ];
  let lo = stops[0], hi = stops[stops.length-1];
  for(let i=0;i<stops.length-1;i++){
    if(t >= stops[i][0] && t <= stops[i+1][0]){ lo = stops[i]; hi = stops[i+1]; break; }
  }
  const span = hi[0]-lo[0] || 1;
  const f = (t - lo[0]) / span;
  const c = lo[1].map((v,i)=> Math.round(v + (hi[1][i]-v)*f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// Uma linha por estado, com chips de rede coloridos por temperatura — em vez de
// uma matriz larga (que não cabe na tela do celular sem rolagem horizontal).
// As chips quebram de linha naturalmente em qualquer largura.
function heatmapHTML(states, rows){
  const chainTotals = {};
  rows.forEach(r=>{ chainTotals[r.chain] = (chainTotals[r.chain]||0)+1; });
  const topChains = new Set(Object.entries(chainTotals).sort((a,b)=>b[1]-a[1]).slice(0,10).map(e=>e[0]));

  const matrix = {};
  states.forEach(s=>{ matrix[s] = {}; });
  rows.forEach(r=>{ if(topChains.has(r.chain) && matrix[r.state]) matrix[r.state][r.chain] = (matrix[r.state][r.chain]||0)+1; });

  let maxVal = 1;
  states.forEach(s=>Object.values(matrix[s]).forEach(v=>{ maxVal = Math.max(maxVal, v); }));

  return `
    <div class="heat-rows">
      ${states.map(s=>{
        const entries = Object.entries(matrix[s]).sort((a,b)=>b[1]-a[1]);
        const total = entries.reduce((sum,[,v])=>sum+v, 0);
        return `
        <div class="heat-state-row">
          <div class="heat-state-head">
            <span class="heat-state-name">${s}</span>
            <span class="heat-state-total">${total} loja${total!==1?'s':''} · top ${topChains.size} redes do país</span>
          </div>
          <div class="heat-chips">
            ${entries.length ? entries.map(([chain,v])=>{
              const bg = heatTemperatureColor(v/maxVal);
              const textColor = contrastTextColor(bg);
              return `<span class="heat-chip" style="background:${bg}; color:${textColor}"><b>${v}</b> ${chain}</span>`;
            }).join('') : `<span class="heat-chip-empty">Nenhuma das redes mais atendidas do país está neste estado.</span>`}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="heat-legend">
      <span class="hl-label">Frio</span>
      <div class="hl-bar"></div>
      <span class="hl-label">Quente</span>
      <span class="hl-scale">0 lojas → ${maxVal} lojas (maior concentração: ${maxVal} em um único cruzamento estado×rede)</span>
    </div>`;
}

function dayContentHTML(day, labels){
  const stores = currentRows.filter(r=>r.days.includes(day));
  if(!stores.length) return `<div class="rd-empty-full">Nenhuma loja com visita programada para ${labels[day]}.</div>`;
  return agencyAccordionHTML(stores);
}

function selectRoteiroDay(day, labels){
  roteiroDay = day;
  document.querySelectorAll('.day-pill').forEach(p=>p.classList.toggle('active', p.dataset.day===day));
  document.getElementById('roteiroContent').innerHTML = dayContentHTML(day, labels);
}

function analysisPanelHTML(rows){
  const analyzed = rows.map(r=>({row:r, rhythm: rhythmFor(r)})).filter(x=>x.rhythm);
  if(!analyzed.length){
    return `<div class="rd-empty-full">Não há dados de dias de visita suficientes para calcular o ritmo nesta aba.</div>`;
  }
  const attention = analyzed.filter(x=>x.rhythm.status==='attention').sort((a,b)=>b.rhythm.deviation-a.rhythm.deviation);
  const ok = analyzed.filter(x=>x.rhythm.status==='ok').sort((a,b)=>a.rhythm.deviation-b.rhythm.deviation);

  const itemHTML = (x)=>`
    <div class="rhythm-item">
      <span class="ri-store">${x.row.store}</span>
      <span class="ri-meta">${x.row.agency} · visita a cada <b>${x.rhythm.med}d</b> (ideal ~${x.rhythm.ideal.toFixed(1)}d) · até <b>${x.rhythm.maxGap}d</b> sem visitar</span>
    </div>`;

  return `
    <div class="rhythm-kpis">
      <div class="rk"><span class="rk-n" style="color:var(--terra)">${attention.length}</span><span class="rk-l">precisam de atenção</span></div>
      <div class="rk"><span class="rk-n" style="color:var(--green)">${ok.length}</span><span class="rk-l">ritmo equilibrado</span></div>
      <div class="rk"><span class="rk-n">${analyzed.length}</span><span class="rk-l">lojas analisadas</span></div>
    </div>
    <div class="accordion">
      <details class="acc-item" open>
        <summary><span>⚠️ Ritmo desigual — pode precisar de reajuste</span><span class="acc-count">${attention.length} loja${attention.length!==1?'s':''}</span></summary>
        <div class="acc-body rhythm-body">
          ${attention.length ? attention.map(itemHTML).join('') : `<div class="rd-empty-full">Nenhuma loja fora do padrão nesta aba.</div>`}
        </div>
      </details>
      <details class="acc-item">
        <summary><span>✅ Ritmo equilibrado</span><span class="acc-count">${ok.length} loja${ok.length!==1?'s':''}</span></summary>
        <div class="acc-body rhythm-body">
          ${ok.length ? ok.map(itemHTML).join('') : `<div class="rd-empty-full">Nenhuma loja nesta categoria.</div>`}
        </div>
      </details>
    </div>
  `;
}

function renderState(stateName){
  const data = STATE[stateName];
  currentRows = data.rows;
  tableState = {query:'', agency:'ALL', page:0, pageSize:12};

  const totalLojas = currentRows.length;
  const totalVisitasMes = currentRows.reduce((s,r)=>s+ (r.visitsMonth||0), 0);
  const agencies = [...new Set(currentRows.map(r=>r.agency))];
  const chains = [...new Set(currentRows.map(r=>r.chain))];

  const byAgency = {};
  currentRows.forEach(r=>{ byAgency[r.agency] = (byAgency[r.agency]||0) + (r.visitsMonth||0); });
  const agencyEntries = Object.entries(byAgency).sort((a,b)=>b[1]-a[1]);
  const maxAgencyVal = agencyEntries.length ? agencyEntries[0][1] : 1;

  const byChain = {};
  currentRows.forEach(r=>{ byChain[r.chain] = (byChain[r.chain]||0) + 1; });
  const chainEntries = Object.entries(byChain).sort((a,b)=>b[1]-a[1]);
  const chainTotal = chainEntries.reduce((s,e)=>s+e[1],0) || 1;

  const byDay = {SEG:0,TER:0,QUA:0,QUI:0,SEX:0,SAB:0,DOM:0};
  currentRows.forEach(r=>{ r.days.forEach(d=>{ byDay[d] = (byDay[d]||0)+1; }); });
  const maxDay = Math.max(1, ...Object.values(byDay));

  const avgVisitsPerStore = totalLojas ? (totalVisitasMes/totalLojas).toFixed(1) : '0';

  const JS_DAY_TO_CODE = ['DOM','SEG','TER','QUA','QUI','SEX','SAB'];
  const todayCode = JS_DAY_TO_CODE[new Date().getDay()];
  const todayStores = currentRows.filter(r => r.days.includes(todayCode));
  roteiroDay = todayCode;

  const html = `
    <div class="info-note">
      <span>ℹ️</span>
      <span>Mostrando <b>${stateName}</b>: ${agencyEntries.length} agência${agencyEntries.length!==1?'s':''} de promotoria, ${chains.length} rede${chains.length!==1?'s':''}/bandeiras e ${totalLojas} lojas atendidas, lidos diretamente das tabelas de cobertura da aba.</span>
    </div>

    <div class="today-banner">
      <div class="tb-head">
        <h3>📍 Visitas de hoje — ${DAY_LABEL[todayCode]}</h3>
        <span class="tb-sub">${todayStores.length} loja${todayStores.length!==1?'s':''} programada${todayStores.length!==1?'s':''} para visita</span>
      </div>
      ${todayStores.length ? agencyAccordionHTML(todayStores) : `<span class="today-empty">Nenhuma loja com rota marcada para hoje nesta aba.</span>`}
    </div>

    <div class="panel" style="margin-bottom:18px;">
      <h3>Roteiro semanal <span class="tag">LOJAS POR DIA</span></h3>
      <div class="day-pills">
        ${DAY_ORDER.map(d=>{
          const n = currentRows.filter(r=>r.days.includes(d)).length;
          return `<div class="day-pill ${d===roteiroDay?'active':''} ${n===0?'is-empty':''}" data-day="${d}">${DAY_LABEL[d]}<span class="dp-n">${n}</span></div>`;
        }).join('')}
      </div>
      <div id="roteiroContent">${dayContentHTML(roteiroDay, DAY_LABEL)}</div>
    </div>

    <div class="panel" style="margin-bottom:18px;">
      <h3>Análise de ritmo de visitas <span class="tag">MEDIANA DE INTERVALO × IDEAL</span></h3>
      <p class="rhythm-explain">Para cada loja, calcula a <b>mediana do intervalo</b> entre visitas e o <b>maior período sem visita</b> na semana, comparando com o intervalo ideal (7 dias ÷ visitas/semana contratadas). Quando o maior intervalo sem visita supera o ideal em mais de 2 dias, a loja entra em atenção — sinal de que a distribuição dos dias pode precisar de ajuste. Veja o resumo nacional com prioridades cruzadas em Monitoramento de Visitas → Rotas &amp; Sugestões.</p>
      ${analysisPanelHTML(currentRows)}
    </div>

    <div class="kpis">
      <div class="kpi" style="--accent:var(--gold-deep)">
        <div class="label">Lojas atendidas</div>
        <div class="value">${totalLojas}</div>
        <div class="foot">${agencyEntries.length} agência${agencyEntries.length!==1?'s':''} de promotoria</div>
      </div>
      <div class="kpi" style="--accent:var(--terra)">
        <div class="label">Visitas / mês (total)</div>
        <div class="value">${totalVisitasMes.toLocaleString('pt-BR')}</div>
        <div class="foot">soma de todas as lojas listadas</div>
      </div>
      <div class="kpi" style="--accent:var(--green)">
        <div class="label">Média de visitas / loja</div>
        <div class="value">${avgVisitsPerStore}</div>
        <div class="foot">visitas mensais por loja</div>
      </div>
      <div class="kpi" style="--accent:var(--blue)">
        <div class="label">Redes / bandeiras</div>
        <div class="value">${chains.length}</div>
        <div class="foot">identificadas pelo nome da loja</div>
      </div>
    </div>

    <div class="grid2">
      <div class="panel">
        <h3>Visitas/mês por agência <span class="tag">SOMA</span></h3>
        ${agencyEntries.map(([name,val],i)=>`
          <div class="bar-row">
            <div class="name" title="${name}">${name}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${(val/maxAgencyVal*100).toFixed(1)}%; background:linear-gradient(90deg, ${PALETTE[i%PALETTE.length]}99, ${PALETTE[i%PALETTE.length]})"></div></div>
            <div class="bar-val">${val.toLocaleString('pt-BR')}</div>
          </div>`).join('')}
      </div>
      <div class="panel">
        <h3>Lojas por rede <span class="tag">CONTAGEM</span></h3>
        <div class="donut-wrap">
          ${donutSVG(chainEntries, chainTotal)}
          <div class="legend">
            ${chainEntries.slice(0,8).map(([name,val])=>`
              <div class="li"><span class="sw" style="background:${chainColor(name)}"></span>${name}<b>${val}</b></div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="panel">
      <h3>Frequência de visitas por dia da semana <span class="tag">CLIQUE NO DIA PARA VER AS LOJAS</span></h3>
      <div class="week-grid">
        ${DAY_ORDER.map(d=>`
          <div class="week-cell ${byDay[d]===maxDay && maxDay>0 ? 'hot':''}" data-day="${d}" role="button" tabindex="0">
            <div class="d">${d}</div>
            <div class="v">${byDay[d]||0}</div>
          </div>`).join('')}
      </div>
    </div>

    <div class="panel table-panel">
      <h3>Lojas atendidas — ${stateName} <span class="tag">${totalLojas} REGISTROS</span></h3>
      <p class="rhythm-explain" style="margin-top:-8px;">📍 indica bairro/cidade quando essa informação está embutida no nome da loja na planilha. A fonte não tem um campo de endereço completo (rua/número).</p>
      <div class="table-controls">
        <input class="search" id="searchInput" placeholder="Buscar por loja, bairro, agência ou rede...">
        <select class="fsel" id="agencyFilter">
          <option value="ALL">Todas as agências</option>
          ${agencies.map(a=>`<option value="${a}">${a}</option>`).join('')}
        </select>
      </div>
      <table>
        <thead>
          <tr>
            <th>Agência</th><th>Loja</th><th>Rede</th><th>Visitas/sem.</th><th>Visitas/mês</th><th>Dias</th>
          </tr>
        </thead>
        <tbody id="tbody"></tbody>
      </table>
      <div class="pager">
        <span id="pagerInfo"></span>
        <div style="display:flex; gap:8px;">
          <button id="prevPage">← Anterior</button>
          <button id="nextPage">Próxima →</button>
        </div>
      </div>
    </div>

    ${salesByProductEmptyPanelHTML()}
  `;
  document.getElementById('content').innerHTML = html;

  document.querySelectorAll('.day-pill').forEach(p=>{
    p.addEventListener('click', ()=> selectRoteiroDay(p.dataset.day, DAY_LABEL));
  });

  document.querySelectorAll('.week-cell').forEach(cell=>{
    const open = ()=>{
      selectRoteiroDay(cell.dataset.day, DAY_LABEL);
      document.getElementById('roteiroContent').scrollIntoView({behavior:'smooth', block:'center'});
    };
    cell.addEventListener('click', open);
    cell.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); open(); } });
  });

  document.getElementById('searchInput').addEventListener('input', e=>{
    tableState.query = e.target.value.toLowerCase(); tableState.page=0; renderTable();
  });
  document.getElementById('agencyFilter').addEventListener('change', e=>{
    tableState.agency = e.target.value; tableState.page=0; renderTable();
  });
  document.getElementById('prevPage').addEventListener('click', ()=>{ if(tableState.page>0){tableState.page--; renderTable();}});
  document.getElementById('nextPage').addEventListener('click', ()=>{ tableState.page++; renderTable(); });

  renderTable();
}

function donutSVG(entries, total){
  const r = 52, cx=60, cy=60, sw=20;
  let acc = 0;
  const circ = 2*Math.PI*r;
  const segs = entries.slice(0,8).map(([name,val])=>{
    const frac = val/total;
    const dash = frac*circ;
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${chainColor(name)}" stroke-width="${sw}"
      stroke-dasharray="${dash.toFixed(2)} ${(circ-dash).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    acc += dash;
    return seg;
  }).join('');
  return `<svg width="120" height="120" viewBox="0 0 120 120">${segs}
    <circle cx="${cx}" cy="${cy}" r="${r-sw/2-2}" fill="var(--panel)"/>
    <text x="${cx}" y="${cy-3}" text-anchor="middle" font-family="var(--font-display)" font-size="20" font-weight="700" fill="var(--brown)">${total}</text>
    <text x="${cx}" y="${cy+13}" text-anchor="middle" font-size="9.5" fill="var(--ink-faint)">lojas</text>
  </svg>`;
}

function renderTable(){
  let rows = currentRows;
  if(tableState.agency !== 'ALL') rows = rows.filter(r=>r.agency===tableState.agency);
  if(tableState.query){
    const q = tableState.query;
    rows = rows.filter(r => r.store.toLowerCase().includes(q) || r.agency.toLowerCase().includes(q) || r.chain.toLowerCase().includes(q) || (r.location||'').toLowerCase().includes(q));
  }
  const pageSize = tableState.pageSize;
  const totalPages = Math.max(1, Math.ceil(rows.length/pageSize));
  if(tableState.page >= totalPages) tableState.page = totalPages-1;
  const start = tableState.page*pageSize;
  const pageRows = rows.slice(start, start+pageSize);

  document.getElementById('tbody').innerHTML = pageRows.map(r=>{
    return `
    <tr>
      <td>${r.agency}</td>
      <td class="strong">${r.store}${r.location ? `<span class="loc-sub">📍 ${r.location}</span>` : ''}</td>
      <td>${chainChip(r.chain)}</td>
      <td>${r.visitsWeek || '—'}</td>
      <td>${r.visitsMonth || '—'}</td>
      <td>${r.days.length ? r.days.join(' / ') : '—'}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" style="text-align:center; color:var(--ink-faint); padding:30px;">Nenhum resultado encontrado.</td></tr>`;

  document.getElementById('pagerInfo').textContent = rows.length
    ? `${start+1}–${Math.min(start+pageSize, rows.length)} de ${rows.length}`
    : '0 de 0';
  document.getElementById('prevPage').disabled = tableState.page===0;
  document.getElementById('nextPage').disabled = start+pageSize>=rows.length;
}

// Abre o painel direto com os dados embutidos, se houver.
function bootCoverage(){
  if(!EMBEDDED_STATE) return;
  STATE = EMBEDDED_STATE;
  document.getElementById('dropzone').style.display = 'none';
  document.getElementById('appView').style.display = 'block';
  document.getElementById('headerRight').innerHTML = `
    <div style="display:flex; gap:10px; align-items:center;">
      <div class="file-pill"><span class="dot"></span>Dados de ${EMBEDDED_AT}</div>
      <button class="btn" onclick="resetApp()">Carregar nova versão</button>
    </div>`;
  renderTabs();
}
