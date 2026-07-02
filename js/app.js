// Boot geral e navegação principal (Mapa da Rede / Monitoramento de Visitas / Agências).
// Carregado por último — depende de todos os outros módulos já terem sido definidos.

// Accordion exclusivo: dentro de um mesmo grupo (.accordion), abrir um item
// fecha automaticamente os outros que estavam abertos. O evento "toggle" não
// borbulha, então o listener precisa ser registrado na fase de captura.
document.addEventListener('toggle', (e)=>{
  const d = e.target;
  if(!d || d.tagName !== 'DETAILS' || !d.open) return;
  const group = d.closest('.accordion');
  if(!group) return;
  group.querySelectorAll('details').forEach(other=>{ if(other !== d) other.open = false; });
}, true);

// ── Navegação principal ─────────────────────────────────────────────────
document.querySelectorAll('.main-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.main-nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const sec = btn.dataset.section;
    document.getElementById('trade-section').style.display = sec === 'trade' ? 'block' : 'none';
    document.getElementById('monitor-section').style.display = sec === 'monitor' ? 'block' : 'none';
    document.getElementById('agencias-section').style.display = sec === 'agencias' ? 'block' : 'none';
    if(sec === 'monitor') renderMonitorSub(currentMonitorSub);
    else if(sec === 'agencias') renderAgencias();
  });
});

// ── Sub-navegação de Monitoramento de Visitas ───────────────────────────
let currentMonitorSub = 'dashboard';
function renderMonitorSub(sub){
  currentMonitorSub = sub;
  document.querySelectorAll('.sub-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
  const el = document.getElementById('monitor-content');
  if(sub === 'dashboard'){ el.innerHTML = renderMonitorDashboard(); attachMonitorDashboardListeners(); }
  else if(sub === 'form'){ el.innerHTML = renderVisitForm(); attachFormListeners(); }
  else if(sub === 'rotas'){ el.innerHTML = renderRotasSugestoes(); }
  else if(sub === 'rupturas'){ el.innerHTML = renderRupturas(); attachRupturasListeners(); }
  else if(sub === 'devolucoes'){ el.innerHTML = renderDevolucoes(); attachDevolucoesListeners(); }
  else if(sub === 'promotores'){ el.innerHTML = renderPromotoresExclusivos(); }
}
document.querySelectorAll('.sub-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => renderMonitorSub(btn.dataset.sub));
});

// ── Boot ─────────────────────────────────────────────────────────────────
buildCanonicalChains();
bootCoverage();
