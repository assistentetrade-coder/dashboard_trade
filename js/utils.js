// Helpers compartilhados entre todas as seções do painel (cobertura, monitoramento,
// rupturas/devoluções, agências). Depende de data-agencias.js já ter sido carregado
// (para a lista de redes canônicas) e é usado por coverage.js / monitoring.js / rupturas.js / agencias.js.

const DAY_ORDER = ['SEG','TER','QUA','QUI','SEX','SAB','DOM'];
const DAY_LABEL = {SEG:'Segunda',TER:'Terça',QUA:'Quarta',QUI:'Quinta',SEX:'Sexta',SAB:'Sábado',DOM:'Domingo'};
const DAY_INDEX = {SEG:0,TER:1,QUA:2,QUI:3,SEX:4,SAB:5,DOM:6};
const PALETTE = ['#caa12a','#c2693c','#7a9a52','#4c81a0','#8a6bb0','#e0b32b','#a85b51','#4f8b82'];

function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ---------- Cor por rede (única fonte de verdade para todo o painel) ----------
// Calculada uma vez a partir de TODAS as redes conhecidas no painel: as da cobertura
// (STATE, carregada por upload ou pré-embutida), as detectadas nos dados de
// monitoramento (rupturas/devoluções/críticas) e as da planilha de agências —
// assim a mesma rede tem sempre a mesma cor em qualquer aba.
let CHAIN_COLOR_MAP = {};
function buildChainColorMap(){
  const freq = {};
  const bump = (name)=>{ if(!name) return; freq[name] = (freq[name]||0) + 1; };

  if(typeof allRows === 'function') allRows().forEach(r=>bump(r.chain));
  (MONITORING.rupturas||[]).forEach(r=>bump(detectChainKnown(r.loja)));
  (MONITORING.devolucoes||[]).forEach(r=>bump(detectChainKnown(r.loja)));
  (MONITORING.criticas||[]).forEach(r=>bump(detectChainKnown(r.loja)));
  AGENCIAS_DATA.forEach(a=>a.redes.forEach(r=>bump(r.nome)));

  const sorted = Object.keys(freq).sort((a,b)=>freq[b]-freq[a]);
  CHAIN_COLOR_MAP = {};
  sorted.forEach((chain,i)=>{
    if(i < PALETTE.length) CHAIN_COLOR_MAP[chain] = PALETTE[i];
    else {
      const hue = Math.round((137.508 * (i - PALETTE.length + 1)) % 360); // ângulo dourado: máxima distância de matiz
      CHAIN_COLOR_MAP[chain] = `hsl(${hue} 46% 45%)`;
    }
  });
}

function chainColor(name){
  return CHAIN_COLOR_MAP[name] || '#9c8a6f';
}

// Chip HTML padrão para exibir uma rede com sua cor (reaproveitado em todas as tabelas/cards).
function chainChip(name, extra){
  const c = chainColor(name);
  return `<span class="chip" style="--chip-bg:${c}26; --chip-fg:${c};">${escHtml(name)}${extra!=null?` <span class="qtd">${extra}</span>`:''}</span>`;
}

// words that show up as literal header text and must never be treated as a store/agency value
const HEADER_WORDS = ['AGÊNCIA','AGENCIA','LOJAS','LOJA','DIAS DA SEMANA','QUANT. VISITAS','OBSERVAÇÕES','OBSERVACOES'];

// words that alone don't identify a chain (ambiguous: "SUPER X", "REDE Y"...).
// When the first word of the store name is one of these, join it with the next
// word to form the real chain name (e.g. "SUPER RISSUL", not just "SUPER").
const GENERIC_CHAIN_PREFIXES = ['SUPER','SUPERMERCADO','SUPERMERCADOS','REDE','LOJAS','LOJA',
  'ATACADO','ATACADÃO','ATACAREJO','MERCADO','MERCADINHO','EMPÓRIO','GRUPO','COMERCIAL'];

function detectChain(storeName){
  if(!storeName) return 'OUTROS';
  // corta no primeiro traço (" - " ou "-"): muitos nomes de loja são
  // "REDE - BAIRRO / CÓDIGO_INTERNO / CIDADE", e o código interno costuma ter
  // números que, sem este corte, fariam o detector confundir cada endereço
  // com uma rede diferente (ex.: "CARREFOUR_4855" virando parte do nome da rede).
  const dashCut = storeName.trim().split(/\s*[-–]\s*/)[0].trim();
  const base = dashCut || storeName.trim();

  const tokens = base.split(/\s+/);
  let cut = -1;
  for(let i=0;i<tokens.length;i++){ if(/\d/.test(tokens[i])){ cut = i; break; } }
  let chainTokens;
  if(cut === 0) chainTokens = [tokens[0]];
  else if(cut > 0) chainTokens = tokens.slice(0, cut);
  else chainTokens = tokens.length ? [tokens[0]] : ['Outros'];

  // expande nomes genéricos ("SUPER", "REDE"...) com a próxima palavra disponível
  if(chainTokens.length === 1 && GENERIC_CHAIN_PREFIXES.includes(chainTokens[0].toUpperCase())){
    const nextIdx = chainTokens.length; // = 1, índice da próxima palavra em tokens
    if(tokens[nextIdx] && !/\d/.test(tokens[nextIdx])){
      chainTokens = [chainTokens[0], tokens[nextIdx]];
    }
  }
  const name = chainTokens.join(' ').replace(/[-–]$/,'').trim() || 'Outros';
  // maiúsculas para evitar "Carrefour" e "CARREFOUR" virarem redes diferentes
  return name.toUpperCase();
}

// Lista de redes canônicas conhecidas (da planilha de agências) — usada para
// reconhecer a rede em nomes de loja "soltos" (ex.: dados de ruptura/devolução),
// onde o corte genérico de detectChain() pode errar (ex.: "KOCH BR 101 ITAPEMA"
// viraria rede "KOCH BR" em vez de "KOCH"). Tenta o match mais longo primeiro.
let CANONICAL_CHAINS = [];
function buildCanonicalChains(){
  const set = new Set();
  AGENCIAS_DATA.forEach(a=>a.redes.forEach(r=>set.add(r.nome.toUpperCase())));
  CANONICAL_CHAINS = [...set].sort((a,b)=>b.length-a.length);
}

function detectChainKnown(storeName){
  if(!storeName) return 'OUTROS';
  const up = storeName.trim().toUpperCase();
  for(const chain of CANONICAL_CHAINS){
    if(up === chain || up.startsWith(chain+' ') || up.startsWith(chain+'-') || up.startsWith(chain+'–')) return chain;
  }
  return detectChain(storeName);
}

// A planilha não tem uma coluna de endereço — o que existe é o bairro/cidade
// embutido no próprio nome da loja (ex.: "CARREFOUR - PRAIA GRANDE / ..." ou
// "ASUN 01 QUINTÃO"). Esta função extrai essa parte para exibir como
// referência de localização, sem inventar dado que não existe na fonte.
function extractLocation(storeName, chain){
  const name = storeName.trim();
  const dashParts = name.split(/\s*[-–]\s*/);
  let loc;
  if(dashParts.length > 1){
    // tudo depois do primeiro traço, pegando só o trecho antes de "/" (código interno / cidade)
    loc = dashParts.slice(1).join(' - ').split('/')[0].trim();
  } else {
    // sem traço: tira as palavras da rede e números do início, sobra o bairro
    const chainWords = chain.toUpperCase().split(/\s+/);
    const tokens = name.split(/\s+/);
    let i = 0;
    while(i < tokens.length && (chainWords.includes(tokens[i].toUpperCase()) || /^\d+$/.test(tokens[i]) || tokens[i]==='-')){
      i++;
    }
    loc = tokens.slice(i).join(' ').replace(/^[-–(]+|[-–)]+$/g,'').trim();
  }
  return loc || '';
}

function parseDays(str){
  if(!str) return [];
  const found = [];
  const up = str.toUpperCase();
  DAY_ORDER.forEach(d=>{ if(up.includes(d)) found.push(d); });
  return found;
}

function parseDaysFromString(str){
  if(!str) return [];
  const up = str.toUpperCase();
  const map = {SEG:['SEG','SEGUNDA'],TER:['TER','TERCA'],QUA:['QUA','QUARTA'],QUI:['QUI','QUINTA'],SEX:['SEX','SEXTA'],SAB:['SAB','SABADO'],DOM:['DOM','DOMINGO']};
  const found = [];
  for(const [code, v] of Object.entries(map)){ if(v.some(x=>up.includes(x))) found.push(code); }
  return [...new Set(found)];
}

// ---------- Análise de ritmo de visitas ----------
// Para cada loja, calcula o intervalo (em dias) entre as visitas programadas na
// semana (de forma cíclica) e compara a MEDIANA desses intervalos com o
// intervalo ideal (7 dias / nº de visitas semanais). Quanto maior o desvio,
// mais irregular é o ritmo — sinal de que a frequência pode precisar de ajuste.
function median(arr){
  if(!arr.length) return null;
  const s = [...arr].sort((a,b)=>a-b);
  const mid = Math.floor(s.length/2);
  return s.length % 2 ? s[mid] : (s[mid-1]+s[mid])/2;
}

function visitGaps(days){
  if(!days || !days.length) return [];
  const idx = [...new Set(days.map(d=>DAY_INDEX[d]))].sort((a,b)=>a-b);
  if(idx.length === 1) return [7];
  const gaps = [];
  for(let i=0;i<idx.length;i++){
    const next = idx[(i+1)%idx.length];
    let g = next - idx[i];
    if(g <= 0) g += 7;
    gaps.push(g);
  }
  return gaps;
}

function rhythmFor(row){
  const gaps = visitGaps(row.days);
  if(!gaps.length || !row.visitsWeek) return null;
  const med = median(gaps);
  const maxGap = Math.max(...gaps);
  const ideal = 7 / row.visitsWeek;
  // o que mais importa na rotina de campo é o MAIOR período sem visita, não a média:
  // duas visitas/semana muito próximas uma da outra deixam um buraco grande depois.
  const deviation = maxGap - ideal;
  const status = deviation > 2 ? 'attention' : 'ok';
  return {med, maxGap, ideal, deviation, status};
}

// ---------- Cruzamento loja-a-loja entre monitoramento e cobertura ----------
// Rupturas/devoluções guardam o nome da loja como veio do relatório de origem
// (às vezes sem acento, com zero à esquerda faltando, etc.), então a comparação
// direta com o nome da loja na cobertura (roteiro) perde bastante caso. Aqui
// normalizamos (maiúsculas, sem acento, espaços colapsados) antes de comparar —
// aumenta a taxa de correspondência sem inventar vínculo nenhum: só casa quando
// os nomes realmente batem depois de normalizados.
function normStoreName(s){
  return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().trim().replace(/\s+/g,' ');
}

let _coverageByNormName = null;
function coverageLookupByName(storeName){
  if(_coverageByNormName === null){
    _coverageByNormName = new Map();
    if(typeof allRows === 'function') allRows().forEach(r=>_coverageByNormName.set(normStoreName(r.store), r));
  }
  return _coverageByNormName.get(normStoreName(storeName)) || null;
}
function resetCoverageLookup(){ _coverageByNormName = null; }

// ---------- Cruzamento com a planilha de Agências ----------
function agenciasForEstado(estado){
  return AGENCIAS_DATA.filter(a=>a.estado === estado);
}

function findAgenciaInfo(agenciaNome){
  if(!agenciaNome) return null;
  const up = agenciaNome.trim().toUpperCase();
  return AGENCIAS_DATA.find(a=>a.agencia.toUpperCase() === up) || null;
}

// Estado(s) onde uma rede aparece na planilha de agências. Redes atendidas em mais
// de um estado (ex.: CARREFOUR) retornam múltiplos — quem usa isso decide como tratar a ambiguidade.
function estadosForRede(redeNome){
  const up = (redeNome||'').toUpperCase();
  const estados = new Set();
  AGENCIAS_DATA.forEach(a=>{ if(a.redes.some(r=>r.nome.toUpperCase()===up)) estados.add(a.estado); });
  return [...estados];
}
