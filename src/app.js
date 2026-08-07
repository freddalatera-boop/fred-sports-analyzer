const games = [
  {
    id: 'g1', competition: 'Brasileirão Série A', country: 'Brasil', time: '16:00',
    home: 'Atlético-MG', away: 'Fluminense', homeForm: ['W','W','D','W','L'], awayForm: ['D','L','W','D','W'],
    market: 'Mais de 1,5 gols', odd: 1.38, bookmaker: 'Betano', confidence: 74,
    evidence: ['8 dos últimos 10 jogos somados tiveram pelo menos 2 gols.', 'Os dois times criam mais de 1,1 gol esperado por partida.'],
    risks: ['Escalações ainda não confirmadas.', 'O visitante pode adotar postura defensiva.']
  },
  {
    id: 'g2', competition: 'Premier League', country: 'Inglaterra', time: '17:00',
    home: 'Arsenal', away: 'Aston Villa', homeForm: ['W','W','W','D','W'], awayForm: ['W','L','D','W','L'],
    market: 'Arsenal ou empate', odd: 1.29, bookmaker: 'Sportingbet', confidence: 79,
    evidence: ['Mandante pontuou em 14 dos últimos 15 jogos em casa.', 'Vantagem consistente em finalizações e posse recente.'],
    risks: ['Adversário perigoso em contra-ataques.', 'Cotação com retorno reduzido.']
  },
  {
    id: 'g3', competition: 'La Liga', country: 'Espanha', time: '18:30',
    home: 'Real Sociedad', away: 'Sevilla', homeForm: ['D','W','W','L','D'], awayForm: ['L','D','W','L','D'],
    market: 'Menos de 3,5 gols', odd: 1.31, bookmaker: 'KTO', confidence: 77,
    evidence: ['Baixa média de gols nos confrontos recentes.', 'As equipes apresentam ritmo ofensivo moderado.'],
    risks: ['Um gol cedo pode mudar o desenho da partida.', 'Dados apresentados são demonstrativos.']
  },
  {
    id: 'g4', competition: 'Brasileirão Série A', country: 'Brasil', time: '19:00',
    home: 'Palmeiras', away: 'Bahia', homeForm: ['W','D','W','W','W'], awayForm: ['W','W','D','L','W'],
    market: 'Palmeiras mais de 0,5 gol', odd: 1.25, bookmaker: 'Bet365', confidence: 82,
    evidence: ['Mandante marcou em 12 partidas consecutivas em casa.', 'Volume alto de finalizações no primeiro e segundo tempo.'],
    risks: ['Rodízio de elenco pode reduzir o poder ofensivo.', 'Odd pode mudar próximo ao início.']
  },
  {
    id: 'g5', competition: 'Serie A', country: 'Itália', time: '20:45',
    home: 'Milan', away: 'Lazio', homeForm: ['W','L','W','D','W'], awayForm: ['D','W','L','W','D'],
    market: 'Mais de 7,5 escanteios', odd: 1.47, bookmaker: 'Pixbet', confidence: 68,
    evidence: ['Média combinada demonstrativa de 9,4 escanteios.', 'Laterais e pontas geram volume pelos dois lados.'],
    risks: ['Mercado de escanteios tem maior variância.', 'Placar cedo pode reduzir o ritmo.']
  },
  {
    id: 'g6', competition: 'Champions League', country: 'Europa', time: '21:00',
    home: 'PSG', away: 'Inter de Milão', homeForm: ['W','W','W','W','D'], awayForm: ['W','D','W','W','L'],
    market: 'Ambas recebem cartão', odd: 1.62, bookmaker: 'Betano', confidence: 61,
    evidence: ['Confronto decisivo tende a elevar a intensidade.', 'Médias demonstrativas acima de 1,5 cartão por equipe.'],
    risks: ['Critério do árbitro altera fortemente o mercado.', 'Escala de arbitragem não confirmada.']
  }
];

const STORAGE_KEY = 'fred-sports-analyzer-v1';
const defaultState = {
  ticket: [],
  bank: 500,
  initialBank: 500,
  history: [],
  transactions: [{ id: 't0', type: 'Depósito inicial', value: 500, date: new Date().toISOString() }],
  limits: { maxStake: 50, dailyLoss: 100 },
  activePage: 'overview'
};

let state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Object.assign({}, defaultState, saved || {});
  } catch (_) {
    return JSON.parse(JSON.stringify(defaultState));
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateTicketCount();
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pct(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
}

function e(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function combinedOdd(items) {
  return Number(items.reduce(function(total, item) { return total * Number(item.odd || 1); }, 1).toFixed(2));
}

function combinedConfidence(items) {
  if (!items.length) return 0;
  return Number((items.reduce(function(total, item) {
    return total * (Number(item.confidence || 0) / 100);
  }, 1) * 100).toFixed(1));
}

function riskLabel(probability) {
  if (probability >= 62) return 'Conservador';
  if (probability >= 42) return 'Moderado';
  return 'Alto';
}

function formHtml(form) {
  return '<div class="form-row">' + form.map(function(result) {
    return '<span class="form ' + result.toLowerCase() + '">' + result + '</span>';
  }).join('') + '</div>';
}

function tagClass(confidence) {
  return confidence >= 72 ? 'green' : confidence >= 60 ? 'yellow' : 'red';
}

function gameCard(game, compact) {
  const inTicket = state.ticket.some(function(item) { return item.id === game.id; });
  return '<article class="game-card">' +
    '<div class="game-top"><span>' + e(game.competition) + '</span><span>' + e(game.country) + ' • dados demonstrativos</span></div>' +
    '<div class="teams">' +
      '<div class="team">' + e(game.home) + formHtml(game.homeForm) + '</div>' +
      '<div class="kickoff">' + e(game.time) + '</div>' +
      '<div class="team">' + e(game.away) + formHtml(game.awayForm) + '</div>' +
    '</div>' +
    '<div class="market-row">' +
      '<div class="market-name"><strong>' + e(game.market) + '</strong><span>Melhor cotação: ' + e(game.bookmaker) + '</span></div>' +
      '<div class="odd-box"><small>ODD</small><strong>' + game.odd.toFixed(2) + '</strong></div>' +
      '<div class="confidence"><small>CONFIANÇA</small><strong>' + game.confidence + '%</strong></div>' +
      '<button class="btn small ' + (inTicket ? '' : 'primary') + '" data-action="' + (inTicket ? 'remove' : 'add') + '" data-id="' + game.id + '">' + (inTicket ? 'Remover' : '+ Bilhete') + '</button>' +
    '</div>' +
    (compact ? '' : '<div style="margin-top:12px"><span class="tag ' + tagClass(game.confidence) + '">' + riskLabel(game.confidence) + '</span></div>') +
  '</article>';
}

function miniTicket() {
  if (!state.ticket.length) return '<div class="empty">Seu bilhete está vazio.<br>Adicione uma análise para começar.</div>';
  const odd = combinedOdd(state.ticket);
  const confidence = combinedConfidence(state.ticket);
  return '<div class="ticket-list">' + state.ticket.map(function(item) {
    return '<div class="ticket-item"><div class="ticket-item-head"><strong>' + e(item.market) + '</strong><button class="remove" data-action="remove" data-id="' + item.id + '">×</button></div><p>' + e(item.home) + ' × ' + e(item.away) + ' • ' + item.odd.toFixed(2) + '</p></div>';
  }).join('') + '</div>' +
  '<div class="ticket-total"><div><small>ODD TOTAL</small><strong>' + odd.toFixed(2) + '</strong></div><div><small>CHANCE EST.</small><strong>' + pct(confidence) + '</strong></div><div><small>RISCO</small><strong>' + riskLabel(confidence) + '</strong></div></div>';
}

function renderOverview() {
  const pending = state.history.filter(function(item) { return item.status === 'Pendente'; }).length;
  const settled = state.history.filter(function(item) { return item.status !== 'Pendente'; });
  const wins = settled.filter(function(item) { return item.status === 'Ganha'; }).length;
  const hitRate = settled.length ? wins / settled.length * 100 : 0;
  return '<div class="hero"><div><p class="eyebrow">ANÁLISE EXPLICÁVEL</p><h2>Boa leitura vale mais que palpite.</h2><p>Compare informações, veja os riscos e monte bilhetes com critérios claros. Esta versão usa dados fictícios para você testar todas as funções.</p></div><div class="hero-actions"><button class="btn primary" data-go="games">Ver jogos do dia</button><button class="btn" data-action="auto" data-target="3">Montar odd 3</button></div></div>' +
    '<div class="stats-grid">' +
      statCard('Banca atual', money(state.bank), 'Salva neste computador') +
      statCard('Jogos analisados', String(games.length), 'Modo demonstração') +
      statCard('Taxa de acerto', pct(hitRate), settled.length + ' apostas finalizadas') +
      statCard('Apostas pendentes', String(pending), 'Acompanhe no histórico') +
    '</div>' +
    '<div class="split"><div><div class="panel-header"><div><h2>Destaques do dia</h2><p>Ordenados por confiança do modelo demonstrativo</p></div><button class="btn small" data-go="games">Ver todos</button></div><div class="games-list">' +
      games.slice().sort(function(a,b) { return b.confidence-a.confidence; }).slice(0,3).map(function(g) { return gameCard(g,true); }).join('') +
    '</div></div><aside class="panel"><div class="panel-header"><div><h3>Meu bilhete</h3><p>Seleções atuais</p></div></div>' + miniTicket() + '<button class="btn primary" style="width:100%;margin-top:14px" data-go="ticket">Abrir bilhete</button></aside></div>';
}

function statCard(label, value, detail) {
  return '<div class="stat-card"><span>' + label + '</span><strong>' + value + '</strong><small>' + detail + '</small></div>';
}

function renderGames() {
  const competitions = Array.from(new Set(games.map(function(g) { return g.competition; })));
  return '<div class="panel"><div class="panel-header"><div><h2>Jogos disponíveis</h2><p>Atualização demonstrativa • horário de Brasília</p></div><span class="tag yellow">SEM DADOS AO VIVO</span></div>' +
    '<div class="filters"><input class="input" id="gameSearch" placeholder="Buscar time ou competição"><select id="competitionFilter"><option value="">Todas as competições</option>' +
    competitions.map(function(c) { return '<option value="' + e(c) + '">' + e(c) + '</option>'; }).join('') +
    '</select></div><div class="games-list" id="gamesList">' + games.map(function(g) { return gameCard(g,false); }).join('') + '</div></div>';
}

function renderAnalyses() {
  return '<div class="hero"><div><p class="eyebrow">MOTOR DE ANÁLISE</p><h2>Critérios visíveis, sem promessa de resultado.</h2><p>A confiança combina forma, mando, produção ofensiva e estabilidade do mercado. Notícias e escalações só serão mostradas quando vierem de uma fonte conectada.</p></div><div class="target-row">' +
    [2,3,5,10,20].map(function(target) { return '<button class="target" data-action="auto" data-target="' + target + '">Montar odd ' + target + '</button>'; }).join('') +
    '</div></div><div class="section-title"><div><h2>Análises recomendadas</h2><p>Nunca trate uma recomendação como garantia.</p></div></div>' +
    games.slice().sort(function(a,b) { return b.confidence-a.confidence; }).map(function(game) {
      return '<article class="analysis-card"><div class="analysis-head"><div><h3>' + e(game.home) + ' × ' + e(game.away) + '</h3><p>' + e(game.market) + ' • odd ' + game.odd.toFixed(2) + ' em ' + e(game.bookmaker) + '</p></div><span class="tag ' + tagClass(game.confidence) + '">' + game.confidence + '% confiança</span></div><div class="meter"><span style="width:' + game.confidence + '%"></span></div><div class="split"><div><strong style="font-size:11px;color:var(--green)">Fatores favoráveis</strong><ul class="evidence">' + game.evidence.map(function(x) { return '<li>' + e(x) + '</li>'; }).join('') + '</ul></div><div><strong style="font-size:11px;color:var(--yellow)">Pontos de atenção</strong><ul class="evidence">' + game.risks.map(function(x) { return '<li>' + e(x) + '</li>'; }).join('') + '</ul></div></div><button class="btn small primary" data-action="add" data-id="' + game.id + '">Adicionar ao bilhete</button></article>';
    }).join('');
}

function renderTicket() {
  const odd = combinedOdd(state.ticket);
  const confidence = combinedConfidence(state.ticket);
  const defaultStake = Math.min(10, state.limits.maxStake);
  return '<div class="split"><div class="panel"><div class="panel-header"><div><h2>Construtor de bilhete</h2><p>Evita automaticamente duas seleções do mesmo jogo</p></div><button class="btn small danger" data-action="clear-ticket">Limpar</button></div>' +
    miniTicket() +
    '<div class="section-title"><div><h2>Montagem automática</h2><p>Usa as maiores confianças e separa os eventos.</p></div></div><div class="target-row">' +
    [2,3,5,10,20].map(function(target) { return '<button class="target" data-action="auto" data-target="' + target + '">Odd ' + target + '</button>'; }).join('') +
    '</div></div><aside class="panel"><div class="panel-header"><div><h3>Resumo da aposta</h3><p>Registro no controle de banca</p></div></div>' +
    '<div class="ticket-total"><div><small>ODD</small><strong>' + odd.toFixed(2) + '</strong></div><div><small>CONFIANÇA</small><strong>' + pct(confidence) + '</strong></div><div><small>RISCO</small><strong>' + riskLabel(confidence) + '</strong></div></div>' +
    '<div class="field" style="margin-top:16px"><label>VALOR DA APOSTA</label><input id="stake" class="input" type="number" min="1" max="' + state.limits.maxStake + '" step="1" value="' + defaultStake + '"></div>' +
    '<p style="color:var(--muted);font-size:11px">Retorno possível: <strong id="possibleReturn" style="color:var(--green)">' + money(defaultStake * odd) + '</strong></p>' +
    '<button class="btn primary" style="width:100%" data-action="place-bet" ' + (!state.ticket.length ? 'disabled' : '') + '>Registrar aposta</button>' +
    '<div class="warning-box" style="margin-top:14px">A odd pode mudar na casa de aposta. Confira todos os mercados antes de confirmar externamente.</div></aside></div>';
}

function profitTotal() {
  return state.history.reduce(function(total, item) {
    if (item.status === 'Ganha') return total + item.returnValue - item.stake;
    if (item.status === 'Perdida') return total - item.stake;
    return total;
  }, 0);
}

function renderBank() {
  const profit = profitTotal();
  return '<div class="stats-grid">' +
    statCard('Banca atual', money(state.bank), 'Saldo registrado') +
    statCard('Lucro/Prejuízo', money(profit), profit >= 0 ? 'Resultado positivo' : 'Revise os mercados') +
    statCard('Limite por aposta', money(state.limits.maxStake), 'Proteção configurada') +
    statCard('Limite diário de perda', money(state.limits.dailyLoss), 'Aviso responsável') +
    '</div><div class="panel"><div class="panel-header"><div><h2>Histórico de apostas</h2><p>Marque o resultado das apostas demonstrativas pendentes</p></div><button class="btn small" data-action="deposit">Adicionar depósito</button></div>' +
    historyTable() + '</div><div class="panel" style="margin-top:18px"><div class="panel-header"><div><h2>Movimentações</h2><p>Entradas e valores registrados</p></div></div>' + transactionsTable() + '</div>';
}

function historyTable() {
  if (!state.history.length) return '<div class="empty">Nenhuma aposta registrada ainda.</div>';
  return '<div class="table-wrap"><table><thead><tr><th>Data</th><th>Seleções</th><th>Odd</th><th>Valor</th><th>Retorno</th><th>Status</th><th>Ação</th></tr></thead><tbody>' +
    state.history.map(function(item) {
      return '<tr><td>' + new Date(item.date).toLocaleString('pt-BR') + '</td><td><strong>' + item.selections.length + ' seleções</strong></td><td>' + item.odd.toFixed(2) + '</td><td>' + money(item.stake) + '</td><td>' + money(item.returnValue) + '</td><td><span class="tag ' + (item.status === 'Ganha' ? 'green' : item.status === 'Perdida' ? 'red' : 'yellow') + '">' + item.status + '</span></td><td>' + (item.status === 'Pendente' ? '<button class="btn small" data-action="settle-win" data-id="' + item.id + '">Ganha</button> <button class="btn small danger" data-action="settle-loss" data-id="' + item.id + '">Perdida</button>' : '—') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

function transactionsTable() {
  return '<div class="table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Valor</th></tr></thead><tbody>' +
    state.transactions.slice().reverse().map(function(item) {
      return '<tr><td>' + new Date(item.date).toLocaleString('pt-BR') + '</td><td>' + e(item.type) + '</td><td class="' + (item.value >= 0 ? 'positive' : 'negative') + '">' + money(item.value) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

function renderSettings() {
  return '<div class="split"><div class="panel"><div class="panel-header"><div><h2>Limites responsáveis</h2><p>O sistema avisa quando um valor ultrapassa seus limites.</p></div></div><div class="form-grid"><div class="field"><label>LIMITE POR APOSTA</label><input id="maxStake" class="input" type="number" min="1" value="' + state.limits.maxStake + '"></div><div class="field"><label>LIMITE DIÁRIO DE PERDA</label><input id="dailyLoss" class="input" type="number" min="1" value="' + state.limits.dailyLoss + '"></div></div><button class="btn primary" style="margin-top:14px" data-action="save-limits">Salvar limites</button></div>' +
    '<aside class="panel"><div class="panel-header"><div><h3>Backup dos dados</h3><p>Leve seu histórico para outro computador.</p></div></div><button class="btn" style="width:100%;margin-bottom:9px" data-action="export">Exportar backup</button><button class="btn" style="width:100%;margin-bottom:9px" data-action="import">Importar backup</button><button class="btn danger" style="width:100%" data-action="reset">Apagar dados locais</button></aside></div>' +
    '<div class="panel" style="margin-top:18px"><div class="panel-header"><div><h2>Fontes esportivas</h2><p>As chaves nunca serão gravadas no código público.</p></div><span class="tag yellow">NÃO CONFIGURADO</span></div><div class="warning-box">A versão atual trabalha com dados demonstrativos. A integração real será feita em uma camada protegida, usando API-Football/API-Sports e uma fonte licenciada de odds. Quando um dado não existir, o programa mostrará “não disponível” em vez de inventá-lo.</div></div>';
}

function renderAbout() {
  return '<div class="panel" style="max-width:780px"><div class="about-logo">F</div><p class="eyebrow">VERSÃO 0.1.0</p><h2>Fred Sports Analyzer</h2><p style="color:var(--muted);line-height:1.65">Aplicativo para organizar informações esportivas, comparar evidências e controlar apostas. A primeira versão é um protótipo funcional com dados demonstrativos.</p><div class="warning-box"><strong>Importante:</strong> nenhuma análise garante resultado ou lucro. Odds representam probabilidades e incluem a margem das casas. Use somente se tiver 18 anos ou mais e mantenha limites compatíveis com sua realidade financeira.</div><h3 style="margin-top:22px">Princípios do aplicativo</h3><ul class="evidence"><li>Explicar todos os fatores usados.</li><li>Mostrar dados ausentes sem inventar informações.</li><li>Alertar sobre escalações pendentes e odds desatualizadas.</li><li>Priorizar casas autorizadas e endereços .bet.br.</li></ul></div>';
}

function setPage(page) {
  state.activePage = page;
  saveState();
  document.querySelectorAll('.nav-item').forEach(function(button) {
    button.classList.toggle('active', button.dataset.page === page);
  });
  const titles = { overview:'Visão geral', games:'Jogos', analyses:'Análises', ticket:'Meu bilhete', bank:'Banca e histórico', settings:'Configurações', about:'Sobre' };
  document.getElementById('pageTitle').textContent = titles[page] || 'Fred Sports Analyzer';
  const renderers = { overview:renderOverview, games:renderGames, analyses:renderAnalyses, ticket:renderTicket, bank:renderBank, settings:renderSettings, about:renderAbout };
  document.getElementById('page').innerHTML = (renderers[page] || renderOverview)();
}

function updateTicketCount() {
  document.getElementById('ticketCount').textContent = state.ticket.length;
}

function addToTicket(id) {
  const game = games.find(function(item) { return item.id === id; });
  if (!game) return;
  if (state.ticket.some(function(item) { return item.id === id; })) return notify('Esta seleção já está no bilhete.', true);
  if (state.ticket.some(function(item) { return item.id === game.id; })) return notify('Já existe uma seleção deste jogo.', true);
  state.ticket.push(game);
  saveState();
  notify('Seleção adicionada ao bilhete.');
  setPage(state.activePage);
}

function removeFromTicket(id) {
  state.ticket = state.ticket.filter(function(item) { return item.id !== id; });
  saveState();
  setPage(state.activePage);
}

function autoBuild(target) {
  const sorted = games.slice().filter(function(g) { return g.confidence >= 50; }).sort(function(a,b) { return b.confidence-a.confidence; });
  const selected = [];
  for (const item of sorted) {
    selected.push(item);
    if (combinedOdd(selected) >= target) break;
  }
  state.ticket = selected;
  saveState();
  notify('Bilhete automático montado para odd aproximada de ' + target + '.');
  setPage('ticket');
}

function placeBet() {
  const input = document.getElementById('stake');
  const stake = Number(input && input.value);
  if (!state.ticket.length) return notify('Adicione pelo menos uma seleção.', true);
  if (!Number.isFinite(stake) || stake <= 0) return notify('Informe um valor válido.', true);
  if (stake > state.limits.maxStake) return notify('O valor ultrapassa seu limite por aposta de ' + money(state.limits.maxStake) + '.', true);
  const today = new Date().toDateString();
  const dailyExposure = state.history.filter(function(item) { return new Date(item.date).toDateString() === today && item.status !== 'Ganha'; }).reduce(function(total, item) { return total + item.stake; }, 0);
  if (dailyExposure + stake > state.limits.dailyLoss) return notify('Este registro ultrapassa seu limite diário de perda de ' + money(state.limits.dailyLoss) + '.', true);
  if (stake > state.bank) return notify('Saldo insuficiente na banca.', true);
  const odd = combinedOdd(state.ticket);
  state.bank -= stake;
  state.history.unshift({
    id: 'b' + Date.now(), date: new Date().toISOString(), selections: state.ticket,
    odd: odd, stake: stake, returnValue: Number((stake * odd).toFixed(2)), status: 'Pendente'
  });
  state.transactions.push({ id:'t' + Date.now(), type:'Aposta registrada', value:-stake, date:new Date().toISOString() });
  state.ticket = [];
  saveState();
  notify('Aposta registrada no controle de banca.');
  setPage('bank');
}

function settle(id, won) {
  const bet = state.history.find(function(item) { return item.id === id; });
  if (!bet || bet.status !== 'Pendente') return;
  bet.status = won ? 'Ganha' : 'Perdida';
  if (won) {
    state.bank += bet.returnValue;
    state.transactions.push({ id:'t' + Date.now(), type:'Retorno de aposta ganha', value:bet.returnValue, date:new Date().toISOString() });
  }
  saveState();
  setPage('bank');
}

function notify(message, error) {
  const box = document.getElementById('notice');
  box.textContent = message;
  box.className = 'notice' + (error ? ' error' : '');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(function() { box.classList.add('hidden'); }, 3500);
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fred-sports-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  notify('Backup exportado.');
}

function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function() {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported || !Array.isArray(imported.history) || !Array.isArray(imported.ticket)) throw new Error('Formato inválido');
      state = Object.assign({}, defaultState, imported);
      saveState();
      setPage('settings');
      notify('Backup importado com sucesso.');
    } catch (_) {
      notify('O arquivo não é um backup válido.', true);
    }
  };
  reader.readAsText(file);
}

document.getElementById('nav').addEventListener('click', function(event) {
  const button = event.target.closest('[data-page]');
  if (button) setPage(button.dataset.page);
});

document.getElementById('page').addEventListener('click', function(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const action = button.dataset.action;
  if (button.dataset.go) return setPage(button.dataset.go);
  if (action === 'add') addToTicket(button.dataset.id);
  if (action === 'remove') removeFromTicket(button.dataset.id);
  if (action === 'auto') autoBuild(Number(button.dataset.target));
  if (action === 'clear-ticket') { state.ticket = []; saveState(); setPage('ticket'); }
  if (action === 'place-bet') placeBet();
  if (action === 'settle-win') settle(button.dataset.id, true);
  if (action === 'settle-loss') settle(button.dataset.id, false);
  if (action === 'deposit') {
    const raw = prompt('Valor do depósito:');
    const value = Number(String(raw || '').replace(',', '.'));
    if (Number.isFinite(value) && value > 0) {
      state.bank += value;
      state.transactions.push({ id:'t' + Date.now(), type:'Depósito', value:value, date:new Date().toISOString() });
      saveState(); setPage('bank'); notify('Depósito registrado.');
    }
  }
  if (action === 'save-limits') {
    const maxStake = Number(document.getElementById('maxStake').value);
    const dailyLoss = Number(document.getElementById('dailyLoss').value);
    if (maxStake > 0 && dailyLoss > 0) {
      state.limits = { maxStake:maxStake, dailyLoss:dailyLoss }; saveState(); notify('Limites salvos.');
    } else notify('Informe limites maiores que zero.', true);
  }
  if (action === 'export') exportBackup();
  if (action === 'import') document.getElementById('importFile').click();
  if (action === 'reset') {
    if (confirm('Deseja apagar o bilhete, banca e histórico deste computador?')) {
      state = JSON.parse(JSON.stringify(defaultState));
      state.transactions[0].date = new Date().toISOString();
      saveState(); setPage('settings'); notify('Dados locais apagados.');
    }
  }
});

document.getElementById('page').addEventListener('input', function(event) {
  if (event.target.id === 'stake') {
    const value = Number(event.target.value || 0) * combinedOdd(state.ticket);
    const output = document.getElementById('possibleReturn');
    if (output) output.textContent = money(value);
  }
  if (event.target.id === 'gameSearch' || event.target.id === 'competitionFilter') {
    const term = String(document.getElementById('gameSearch').value || '').toLowerCase();
    const competition = document.getElementById('competitionFilter').value;
    const filtered = games.filter(function(g) {
      const matchesTerm = (g.home + ' ' + g.away + ' ' + g.competition).toLowerCase().includes(term);
      return matchesTerm && (!competition || g.competition === competition);
    });
    document.getElementById('gamesList').innerHTML = filtered.length ? filtered.map(function(g) { return gameCard(g,false); }).join('') : '<div class="empty">Nenhum jogo encontrado.</div>';
  }
});

document.getElementById('importFile').addEventListener('change', function(event) {
  importBackup(event.target.files[0]);
  event.target.value = '';
});

setInterval(function() {
  document.getElementById('clock').textContent = new Date().toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });
}, 1000);

updateTicketCount();
setPage(state.activePage || 'overview');
