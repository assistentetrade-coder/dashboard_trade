// Monitoramento de Visitas: Painel Geral Visitas (cumprimento de rota por agência),
// Registrar Visita (formulário + log local), Rotas & Sugestões (prioridades de ação
// cruzando ritmo de visita com ruptura/devolução) e Promotores Exclusivos (estado vazio).
// Depende de utils.js, data-monitoring.js, data-agencias.js e, quando disponível, coverage.js.

const JS_DAY_MAP = ['DOM','SEG','TER','QUA','QUI','SEX','SAB'];
const PT_DAYS = {SEG:'Segunda',TER:'Terca',QUA:'Quarta',QUI:'Quinta',SEX:'Sexta',SAB:'Sabado',DOM:'Domingo'};

// ── LocalStorage: log de visitas registradas pelo formulário ───────────────
function getVisits(){ try{ return JSON.parse(localStorage.getItem('mineiraco_visits')||'[]'); }catch(e){ return []; } }
function saveVisit(v){ try{ const vs=getVisits(); vs.unshift(v); localStorage.setItem('mineiraco_visits', JSON.stringify(vs.slice(0,200))); }catch(e){} }

function getScheduledDays(storeName){
  if(!storeName) return [];
  if(typeof STATE === 'object'){
    for(const sd of Object.values(STATE)){
      const f = sd.rows.find(r => r.store === storeName);
      if(f && f.days && f.days.length) return f.days;
    }
  }
  for(const [name, info] of Object.entries({...MONITORING.top_sul,...MONITORING.jara})){
    if(name.toLowerCase()===storeName.toLowerCase()) return parseDaysFromString(info.dias);
  }
  return [];
}

function getAgencyForStore(storeName){
  if(!storeName) return '';
  if(typeof STATE === 'object'){
    for(const sd of Object.values(STATE)){
      const f = sd.rows.find(r => r.store === storeName);
      if(f) return f.agency||'';
    }
  }
  return '';
}

// ── Painel Geral Visitas ────────────────────────────────────────────────
// Estado interno do filtro por estado no Painel Geral (persiste entre re-renders da sub-aba)
let monitorEstadoFiltro = 'ALL';

function monthlyTrendHTML(){
  const bucket = {}; // 'YYYY-MM' -> {rupt, devVal}
  const pushDate = (iso)=> iso ? iso.slice(0,7) : null;
  (MONITORING.rupturas||[]).forEach(r=>{
    const k = pushDate(r.data); if(!k) return;
    bucket[k] = bucket[k] || {rupt:0, devVal:0};
    bucket[k].rupt++;
  });
  (MONITORING.devolucoes||[]).forEach(r=>{
    const k = pushDate(r.data); if(!k) return;
    bucket[k] = bucket[k] || {rupt:0, devVal:0};
    bucket[k].devVal += (r.valor||0);
  });
  const months = Object.keys(bucket).sort().slice(-8);
  if(!months.length) return `<div class="empty-state"><span>📈</span>Sem histórico suficiente para calcular tendência.</div>`;
  const maxRupt = Math.max(1, ...months.map(m=>bucket[m].rupt));
  const maxDev = Math.max(1, ...months.map(m=>bucket[m].devVal));
  const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `
    <div class="trend-wrap">
      ${months.map(m=>{
        const [y,mm] = m.split('-');
        const b = bucket[m];
        const hR = Math.round((b.rupt/maxRupt)*84)+2;
        const hD = Math.round((b.devVal/maxDev)*84)+2;
        return `<div class="trend-col">
          <div class="trend-bars">
            <div class="trend-bar rupt" style="height:${hR}px" title="${b.rupt} ruptura(s)"></div>
            <div class="trend-bar dev" style="height:${hD}px" title="R$ ${b.devVal.toLocaleString('pt-BR',{minimumFractionDigits:2})} em devoluções"></div>
          </div>
          <div class="trend-label">${MESES[parseInt(mm,10)-1]}/${y.slice(2)}</div>
        </div>`;
      }).join('')}
    </div>
    <div class="trend-legend">
      <span class="li"><span class="sw" style="background:var(--terra)"></span>Rupturas registradas</span>
      <span class="li"><span class="sw" style="background:var(--blue)"></span>Valor devolvido (R$)</span>
    </div>`;
}

function sellOutEmptyKPIsHTML(){
  return `
    <div class="kpis" style="margin-bottom:18px;">
      <div class="kpi empty" style="--accent:var(--line)">
        <div class="label">Sell-out (R$)</div>
        <div class="value">—</div>
        <div class="foot">aguardando integração de dados de vendas</div>
      </div>
      <div class="kpi empty" style="--accent:var(--line)">
        <div class="label">Sell-in × Sell-out</div>
        <div class="value">—</div>
        <div class="foot">aguardando integração de dados de vendas</div>
      </div>
    </div>`;
}

function agencyComplianceCardHTML(a){
  const key = a.agencia.toUpperCase() === 'TOP SUL' ? 'top_sul' : (a.agencia.toUpperCase() === 'PERSORE' ? 'jara' : null);
  const redesHTML = a.redes.map(r=>chainChip(r.nome, r.qtdLojas!=null ? r.qtdLojas : null)).join(' ');
  let complianceHTML;
  if(key && MONITORING[key]){
    const months = MONITORING.months;
    const lastMonth = months[months.length-1];
    let totalC=0, totalD=0, below=0, n=0;
    Object.values(MONITORING[key]).forEach(info=>{
      const actual = info.months[lastMonth];
      if(actual===undefined) return;
      const contracted = (info.contracted||0)*4;
      totalC += contracted; totalD += actual; n++;
      if(contracted>0 && Math.round(actual/contracted*100) < 80) below++;
    });
    const pct = totalC>0 ? Math.round(totalD/totalC*100) : 0;
    complianceHTML = `
      <div class="ag-meta-row">
        <span><b>${pct}%</b> cumprimento de rota (${lastMonth.toLowerCase()})</span>
        <span><b>${below}</b> de ${n} lojas abaixo de 80%</span>
      </div>`;
  } else {
    complianceHTML = `<div class="empty-note" style="margin:8px 0;"><span>📋</span><span>Sem dados de cumprimento de rota importados ainda para esta agência.</span></div>`;
  }
  return `
    <div class="agencia-card">
      <div class="ag-top">
        <div>
          <div class="ag-name">${escHtml(a.agencia)}</div>
          <div class="ag-estado">${escHtml(a.estado)}</div>
        </div>
        <div class="ag-lojas">${a.qtdLojasTotal!=null ? a.qtdLojasTotal : '—'}<small> lojas</small></div>
      </div>
      <div class="ag-contato">👤 ${escHtml(a.nome)} · 📞 ${escHtml(a.contato)}</div>
      ${complianceHTML}
      <div class="ag-redes">${redesHTML}</div>
      <div class="empty-note" style="margin-top:10px;"><span>🎉</span><span>Eventos, degustações e apresentações — aguardando registro.</span></div>
    </div>`;
}

function renderMonitorDashboard(){
  const visits = getVisits();
  const now = new Date();
  const thisMonth = now.getMonth(), thisYear = now.getFullYear();
  const monthVisits = visits.filter(v=>{ const d=new Date(v.date); return d.getMonth()===thisMonth&&d.getFullYear()===thisYear; });
  const wrongDay = monthVisits.filter(v=>v.wrongDay);
  const allStores = {...MONITORING.top_sul,...MONITORING.jara};
  const months = MONITORING.months;
  const lastMonth = months[months.length-1];
  let totalC=0, totalD=0, belowTarget=[];
  for(const [name,info] of Object.entries(allStores)){
    const actual = info.months[lastMonth];
    if(actual===undefined) continue;
    const contracted = (info.contracted||0)*4;
    totalC += contracted; totalD += actual;
    const pct = contracted>0 ? Math.round(actual/contracted*100) : 100;
    if(pct<80) belowTarget.push({name,pct,actual,expected:contracted,dias:info.dias||''});
  }
  belowTarget.sort((a,b)=>a.pct-b.pct);
  const globalPct = totalC>0 ? Math.round(totalD/totalC*100) : 0;
  const activeRupturas = MONITORING.rupturas.filter(r=>r.data>='2026-01-01').length;
  const activeCriticas = MONITORING.criticas.length;

  const estados = [...new Set(AGENCIAS_DATA.map(a=>a.estado))].sort();

  return `
    <p class="rhythm-explain" style="margin:18px 0 12px;">Dados históricos baseados nas planilhas de relatório importadas. Mês de referencia: <b>${lastMonth}</b>.</p>
    <div class="kpis" style="margin-bottom:18px;">
      <div class="kpi" style="--accent:var(--gold-deep)">
        <div class="label">Visitas registradas (mes)</div>
        <div class="value">${monthVisits.length}</div>
        <div class="foot">via formulario deste painel</div>
      </div>
      <div class="kpi" style="--accent:var(--terra)">
        <div class="label">Visitas dia incorreto</div>
        <div class="value">${wrongDay.length}</div>
        <div class="foot">${monthVisits.length>0?Math.round(wrongDay.length/monthVisits.length*100)+'%':'0%'} do mes atual</div>
      </div>
      <div class="kpi" style="--accent:var(--green)">
        <div class="label">Cumprimento historico</div>
        <div class="value">${globalPct}%</div>
        <div class="foot">${lastMonth} - visitas reais vs contrato</div>
      </div>
      <div class="kpi" style="--accent:#8a3dc0">
        <div class="label">Rupturas & alertas ativos</div>
        <div class="value">${activeRupturas+activeCriticas}</div>
        <div class="foot">${activeRupturas} rupturas - ${activeCriticas} validades</div>
      </div>
    </div>

    ${sellOutEmptyKPIsHTML()}

    <div class="panel" style="margin-bottom:18px;">
      <h3>Tendência mensal — rupturas e devoluções <span class="tag">ÚLTIMOS MESES</span></h3>
      <p class="rhythm-explain">Enquanto não há integração com dados de vendas, este é o indicador de desempenho mais direto disponível: menos rupturas e menos devoluções = mais sell-out não perdido em gôndola.</p>
      ${monthlyTrendHTML()}
    </div>

    <div class="grid2" style="margin-bottom:18px;">
      <div class="panel">
        <h3>Lojas abaixo de 80% <span class="tag">${lastMonth}</span></h3>
        ${belowTarget.length===0?`<div class="empty-state"><span>✅</span>Nenhuma loja abaixo de 80%.</div>`:`
          <table class="compliance-table"><thead><tr><th>Loja</th><th>Dias</th><th>Real</th><th>Esp.</th><th>%</th></tr></thead><tbody>
          ${belowTarget.slice(0,12).map(r=>`<tr>
            <td class="ct-store">${r.name}</td>
            <td style="font-size:11px;">${r.dias}</td>
            <td>${r.actual}</td><td>${r.expected}</td>
            <td><div style="display:flex;align-items:center;gap:5px;"><div class="pct-bar"><div class="pct-fill ${r.pct<60?'lo':'mid'}" style="width:${r.pct}%"></div></div><span style="font-size:11px">${r.pct}%</span></div></td>
          </tr>`).join('')}
          </tbody></table>`}
      </div>
      <div class="panel">
        <h3>Ultimas visitas registradas <span class="tag">PAINEL</span></h3>
        ${visits.length===0
          ?`<div class="empty-state"><span>📋</span>Nenhuma visita registrada. Use a aba Registrar Visita.</div>`
          :`<div class="visit-log">${visits.slice(0,5).map(v=>renderVisitCardInline(v)).join('')}</div>`}
      </div>
    </div>

    <div class="panel" style="margin-bottom:18px;">
      <h3>Agências por estado <span class="tag">FILTRAR PARA VER CONTATOS E COBERTURA</span></h3>
      <div class="table-controls">
        <select class="fsel" id="monEstadoFiltro">
          <option value="ALL">Todos os estados</option>
          ${estados.map(e=>`<option value="${escHtml(e)}" ${e===monitorEstadoFiltro?'selected':''}>${escHtml(e)}</option>`).join('')}
        </select>
      </div>
      <div class="agencia-grid" id="monAgenciaGrid">
        ${(monitorEstadoFiltro==='ALL' ? AGENCIAS_DATA : agenciasForEstado(monitorEstadoFiltro)).map(agencyComplianceCardHTML).join('')}
      </div>
    </div>

    <div class="panel">
      <h3>Rupturas recentes (60 dias) <span class="tag">PLANILHA</span></h3>
      ${(()=>{const r=MONITORING.rupturas.filter(x=>{const d=new Date(x.data);return(Date.now()-d.getTime())/86400000<=60;}).slice(0,10);
        return r.length===0?'<div class="empty-state"><span>✅</span>Nenhuma ruptura recente.</div>':`<table class="rupt-table"><thead><tr><th>Data</th><th>Rede</th><th>Loja</th><th>Produto</th></tr></thead><tbody>${r.map(x=>`<tr><td>${x.data}</td><td>${chainChip(detectChainKnown(x.loja))}</td><td>${x.loja}</td><td><span class="rupt-badge">${x.produto}</span></td></tr>`).join('')}</tbody></table>`;
      })()}
    </div>`;
}

function attachMonitorDashboardListeners(){
  const sel = document.getElementById('monEstadoFiltro');
  if(!sel) return;
  sel.addEventListener('change', e=>{
    monitorEstadoFiltro = e.target.value;
    document.getElementById('monAgenciaGrid').innerHTML =
      (monitorEstadoFiltro==='ALL' ? AGENCIAS_DATA : agenciasForEstado(monitorEstadoFiltro)).map(agencyComplianceCardHTML).join('');
  });
}

// ── Registrar Visita ────────────────────────────────────────────────────
function renderVisitForm(){
  const storeList=[];
  if(typeof STATE==='object'){
    for(const sd of Object.values(STATE)){
      for(const row of sd.rows){
        if(row.store&&!storeList.find(s=>s.store===row.store)) storeList.push({store:row.store,agency:row.agency});
      }
    }
  }
  storeList.sort((a,b)=>a.store.localeCompare(b.store));
  const today=new Date().toISOString().split('T')[0];
  return `
    <div style="max-width:720px;margin:22px auto 0;">
      <div class="visit-form">
        <h3 style="font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--brown);margin:0 0 4px;">Registrar nova visita</h3>
        <p class="rhythm-explain" style="margin:0 0 22px;">Preencha os dados da visita ao PDV. O sistema verifica automaticamente se a visita esta no dia correto conforme a rota cadastrada.</p>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Data da visita</label>
            <input type="date" id="vf-date" class="form-input" value="${today}">
          </div>
          <div class="form-group">
            <label class="form-label">Promotor responsavel</label>
            <input type="text" id="vf-promoter" class="form-input" placeholder="Nome do promotor">
          </div>
          <div class="form-group full">
            <label class="form-label">Loja</label>
            <select id="vf-store" class="form-select">
              <option value="">Selecione a loja...</option>
              ${storeList.map(s=>`<option value="${s.store}">${s.store}</option>`).join('')}
            </select>
            <div id="vf-day-alert" class="day-alert"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Agencia</label>
            <input type="text" id="vf-agency" class="form-input" placeholder="Auto-preenchida" readonly>
          </div>
          <div class="form-group">
            <label class="form-label">Execucao</label>
            <input type="text" id="vf-execucao" class="form-input" placeholder="Ex: Gondola abastecida...">
          </div>
          <div class="form-group">
            <label class="form-label">Validades</label>
            <input type="text" id="vf-validades" class="form-input" placeholder="Ex: Produto X vence em 15/07...">
          </div>
          <div class="form-group">
            <label class="form-label">Rupturas</label>
            <input type="text" id="vf-rupturas" class="form-input" placeholder="Ex: Coquetel 400g sem estoque...">
          </div>
          <div class="form-group">
            <label class="form-label">Deposito</label>
            <input type="text" id="vf-deposito" class="form-input" placeholder="Situacao do deposito...">
          </div>
          <div class="form-group">
            <label class="form-label">Alteracao</label>
            <input type="text" id="vf-alteracao" class="form-input" placeholder="Trocas, devolucoes...">
          </div>
          <div class="form-group full">
            <label class="form-label">Demais informacoes</label>
            <textarea id="vf-obs" class="form-textarea" placeholder="Observacoes gerais, pontos de atencao..."></textarea>
          </div>
        </div>
        <button class="form-submit" id="vf-submit">Registrar visita</button>
        <div class="form-success" id="vf-success">Visita registrada! Acesse o Dashboard para ver os indicadores.</div>
      </div>
    </div>`;
}

function attachFormListeners(){
  const storeEl=document.getElementById('vf-store');
  const agencyEl=document.getElementById('vf-agency');
  const alertEl=document.getElementById('vf-day-alert');
  const dateEl=document.getElementById('vf-date');
  function checkDay(){
    const storeName=storeEl.value, dateVal=dateEl.value;
    if(!storeName||!dateVal){ alertEl.className='day-alert'; return false; }
    const d=new Date(dateVal+'T12:00:00'), dayCode=JS_DAY_MAP[d.getDay()];
    const scheduled=getScheduledDays(storeName);
    agencyEl.value=getAgencyForStore(storeName);
    if(!scheduled.length){ alertEl.className='day-alert'; return false; }
    if(scheduled.includes(dayCode)){
      alertEl.className='day-alert ok';
      alertEl.innerHTML=`Visita no dia correto - ${PT_DAYS[dayCode]}. Dias programados: ${scheduled.map(x=>PT_DAYS[x]).join(', ')}.`;
      return false;
    } else {
      alertEl.className='day-alert warn';
      alertEl.innerHTML=`Esta loja tem visita programada para <b>${scheduled.map(x=>PT_DAYS[x]).join(' e ')}</b>, mas a data selecionada e <b>${PT_DAYS[dayCode]}</b>. A visita sera marcada como dia incorreto.`;
      return true;
    }
  }
  storeEl.addEventListener('change',checkDay);
  dateEl.addEventListener('change',checkDay);
  document.getElementById('vf-submit').addEventListener('click',()=>{
    const store=storeEl.value;
    if(!store){ alert('Selecione a loja.'); return; }
    const dateVal=dateEl.value, d=new Date(dateVal+'T12:00:00'), dayCode=JS_DAY_MAP[d.getDay()];
    const scheduled=getScheduledDays(store), wrongDay=scheduled.length>0&&!scheduled.includes(dayCode);
    saveVisit({
      store, date:dateVal, dayCode,
      agency:agencyEl.value,
      promoter:document.getElementById('vf-promoter').value,
      execucao:document.getElementById('vf-execucao').value,
      validades:document.getElementById('vf-validades').value,
      rupturas:document.getElementById('vf-rupturas').value,
      deposito:document.getElementById('vf-deposito').value,
      alteracao:document.getElementById('vf-alteracao').value,
      obs:document.getElementById('vf-obs').value,
      wrongDay, scheduledDays:scheduled,
      ts:new Date().toISOString()
    });
    document.getElementById('vf-success').style.display='block';
    document.getElementById('vf-submit').disabled=true;
    setTimeout(()=>renderMonitorSub('dashboard'),1800);
  });
}

function renderVisitCardInline(v){
  const hr = v.wrongDay?'warn':'ok';
  const ic = v.wrongDay?'⚠️':'✅';
  const hasR = v.rupturas && v.rupturas.trim()!=='' && v.rupturas.trim().toUpperCase()!=='NÃO' && v.rupturas.trim()!=='-';
  return '<div class="visit-card">'
    + '<div class="vc-badge '+hr+'">'+ic+'</div>'
    + '<div class="vc-info">'
    + '<div class="store">'+escHtml(v.store||'')+'</div>'
    + '<div class="meta">'+escHtml(v.agency||'')+' · '+escHtml(v.promoter||'sem promotor')+'</div>'
    + '<div class="tags">'
    + (v.wrongDay?'<span class="vc-tag ruptura">📅 Dia incorreto</span>':'<span class="vc-tag ok">📅 Dia correto</span>')
    + (hasR?'<span class="vc-tag ruptura">📉 Ruptura</span>':'')
    + (v.validades?'<span class="vc-tag">⏰ Validades</span>':'')
    + '</div></div>'
    + '<div class="vc-date">'+(v.date||'')+'</div>'
    + '</div>';
}

// ── Rotas & Sugestões ────────────────────────────────────────────────────
// Cruza o ritmo de visita de cada loja (rhythmFor, calculado a partir do roteiro
// de cobertura) com a contagem de rupturas/devoluções daquela mesma loja nos
// dados de monitoramento — quando a loja aparece nos dois lados, ela sobe ao
// topo da lista de prioridades: é ali que vale a pena cobrar a agência primeiro.
function buildPriorityList(){
  if(typeof allRows !== 'function' || !Object.keys(STATE||{}).length) return null;

  const ruptByStore = {}, devByStore = {};
  (MONITORING.rupturas||[]).forEach(r=>{ const k=normStoreName(r.loja); ruptByStore[k]=(ruptByStore[k]||0)+1; });
  (MONITORING.devolucoes||[]).forEach(r=>{ const k=normStoreName(r.loja); devByStore[k]=(devByStore[k]||0)+(r.valor||0); });

  const rows = allRows();
  const items = rows.map(r=>{
    const rhythm = rhythmFor(r);
    const k = normStoreName(r.store);
    const rupturas = ruptByStore[k] || 0;
    const devolucoes = devByStore[k] || 0;
    if(!rhythm && !rupturas && !devolucoes) return null;
    let score = 0;
    const reasons = [];
    if(rhythm && rhythm.status==='attention'){ score += 2 + rhythm.deviation; reasons.push({type:'rhythm', label:`ritmo irregular (até ${rhythm.maxGap}d sem visita)`}); }
    if(rupturas){ score += rupturas; reasons.push({type:'ruptura', label:`${rupturas} ruptura${rupturas!==1?'s':''} registrada${rupturas!==1?'s':''}`}); }
    if(devolucoes){ score += devolucoes/200; reasons.push({type:'dev', label:`R$ ${devolucoes.toLocaleString('pt-BR',{minimumFractionDigits:2})} em devoluções`}); }
    if(!reasons.length) return null;
    return {row:r, score, reasons, rhythm};
  }).filter(Boolean).sort((a,b)=>b.score-a.score);

  return items;
}

function renderRotasSugestoes(){
  const items = buildPriorityList();
  if(!items){
    return `<div class="empty-note" style="margin-top:18px;"><span>🗺️</span><span>Carregue ou mantenha os dados de cobertura (Mapa da Rede) para calcular as sugestões de rota — elas dependem do roteiro semanal de cada loja.</span></div>`;
  }
  const top = items.slice(0,20);
  const multi = items.filter(i=>i.reasons.length>1).length;

  return `
    <div class="info-note">
      <span>🧭</span>
      <span>Cruza o <b>ritmo de visita</b> de cada loja (calculado a partir do roteiro semanal) com as <b>rupturas e devoluções</b> registradas para a mesma loja. Lojas com mais de um sinal de alerta sobem ao topo — é a lista mais objetiva para levar à agência numa conversa de cobrança.</span>
    </div>
    <div class="rhythm-kpis" style="margin:18px 0;">
      <div class="rk"><span class="rk-n" style="color:var(--terra)">${items.length}</span><span class="rk-l">lojas com algum sinal de alerta</span></div>
      <div class="rk"><span class="rk-n" style="color:#8a3dc0">${multi}</span><span class="rk-l">com mais de um sinal (prioridade máxima)</span></div>
    </div>
    <div class="panel">
      <h3>Prioridades de ação <span class="tag">TOP ${top.length}</span></h3>
      <div style="display:flex; flex-direction:column;">
        ${top.map((it,i)=>`
          <div class="priority-item">
            <div class="priority-top">
              <span class="priority-rank">${i+1}</span>
              <span class="ri-store">${escHtml(it.row.store)}</span>
              <span class="ri-meta">${chainChip(it.row.chain)} · ${escHtml(it.row.agency)} · ${escHtml(it.row.state)}</span>
            </div>
            <div class="priority-reasons">
              ${it.reasons.map(r=>`<span class="priority-reason ${r.type}">${r.label}</span>`).join('')}
            </div>
          </div>`).join('')}
      </div>
    </div>
    <div class="panel" style="margin-top:18px;">
      <h3>Roteiro e ritmo por estado <span class="tag">DETALHE</span></h3>
      <p class="rhythm-explain">O roteiro semanal (dias/lojas a visitar) e a análise de ritmo completa de cada estado ficam na aba Mapa da Rede, dentro de cada estado — esta página é o resumo nacional de prioridades.</p>
    </div>`;
}

// ── Promotores Exclusivos ─────────────────────────────────────────────────
function renderPromotoresExclusivos(){
  return `
    <div class="panel" style="margin-top:18px;">
      <h3>Promotores exclusivos & roteiro por mês <span class="tag">EM BREVE</span></h3>
      <div class="empty-note">
        <span>👥</span>
        <span><b>Ainda não há uma planilha de promotores exclusivos integrada ao painel.</b> Quando esse dado existir, aqui vai aparecer a lista de promotores exclusivos por agência/loja e o roteiro mensal de cada um — hoje o painel só tem os dias de visita programados por loja (roteiro semanal), disponíveis em Rotas &amp; Sugestões e em cada estado no Mapa da Rede.</span>
      </div>
    </div>`;
}
