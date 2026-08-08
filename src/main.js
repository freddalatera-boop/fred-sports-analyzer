const { app, BrowserWindow, shell, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { apiGet, buildOddsEndpoint } = require('./api-client');
const { extractMarket } = require('./markets');
const { oddsApiGet, selectedBookmakers, extractOddsIoMarket, chunks } = require('./odds-api-client');

function keyPath() {
  return path.join(app.getPath('userData'), 'sports-api-key.bin');
}

function oddsApiKeyPath() {
  return path.join(app.getPath('userData'), 'odds-api-io-key.bin');
}

function saveApiKey(value) {
  const key = String(value || '').trim();
  if (key.length < 20) throw new Error('A chave informada parece inválida.');
  if (!safeStorage.isEncryptionAvailable()) throw new Error('A criptografia do Windows não está disponível.');
  fs.writeFileSync(keyPath(), safeStorage.encryptString(key).toString('base64'), 'utf8');
}

function readApiKey() {
  if (!fs.existsSync(keyPath()) || !safeStorage.isEncryptionAvailable()) return '';
  try {
    const encrypted = Buffer.from(fs.readFileSync(keyPath(), 'utf8'), 'base64');
    return safeStorage.decryptString(encrypted);
  } catch (_) {
    return '';
  }
}

function saveOddsApiKey(value) {
  const key = String(value || '').trim();
  if (key.length < 12) throw new Error('A chave da Odds-API.io parece inválida. Copie novamente no painel.');
  if (!safeStorage.isEncryptionAvailable()) throw new Error('A criptografia do Windows não está disponível.');
  fs.writeFileSync(oddsApiKeyPath(), safeStorage.encryptString(key).toString('base64'), 'utf8');
}

function readOddsApiKey() {
  if (!fs.existsSync(oddsApiKeyPath()) || !safeStorage.isEncryptionAvailable()) return '';
  try {
    const encrypted = Buffer.from(fs.readFileSync(oddsApiKeyPath(), 'utf8'), 'base64');
    return safeStorage.decryptString(encrypted);
  } catch (_) {
    return '';
  }
}

function localDate(offset) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const date = new Date(Date.now() + offset * 86400000);
  return formatter.format(date);
}

async function fetchOddsPages(date, key) {
  const first = await apiGet(buildOddsEndpoint(date, 1), key);
  const totalPages = Math.max(1, Number(first.paging && first.paging.total) || 1);
  const pagesToLoad = Math.min(totalPages, 3);
  const rows = first.response.slice();
  let remaining = first.remaining;
  let partialFailures = 0;

  if (pagesToLoad > 1) {
    const extra = await Promise.allSettled(
      Array.from({ length: pagesToLoad - 1 }, (_, index) => apiGet(buildOddsEndpoint(date, index + 2), key))
    );
    extra.forEach((result) => {
      if (result.status === 'fulfilled') {
        rows.push(...result.value.response);
        remaining = result.value.remaining || remaining;
      } else {
        partialFailures += 1;
      }
    });
  }

  return { response: rows, remaining, partialFailures };
}

async function syncApiSports(key) {
  const dates = [localDate(0), localDate(1)];
  const fixtureRows = [];
  const oddRows = [];
  let remaining = null;

  const requests = dates.flatMap((date) => [
    { type: 'fixtures', date, promise: apiGet('/fixtures?date=' + date + '&timezone=America%2FSao_Paulo', key) },
    { type: 'odds', date, promise: fetchOddsPages(date, key) }
  ]);
  const results = await Promise.allSettled(requests.map((request) => request.promise));
  const failures = [];
  let fixtureSuccesses = 0;
  let oddsSuccesses = 0;
  let oddsPageFailures = 0;

  results.forEach((result, index) => {
    const request = requests[index];
    if (result.status === 'rejected') {
      failures.push({ type: request.type, date: request.date, message: result.reason && result.reason.message });
      return;
    }
    if (request.type === 'fixtures') {
      fixtureSuccesses += 1;
      fixtureRows.push(...result.value.response);
    } else {
      oddsSuccesses += 1;
      oddsPageFailures += Number(result.value.partialFailures || 0);
      oddRows.push(...result.value.response);
    }
    remaining = result.value.remaining || remaining;
  });

  if (!fixtureSuccesses) {
    const reason = failures.find((failure) => failure.type === 'fixtures');
    throw new Error(reason && reason.message ? reason.message : 'Não foi possível carregar os jogos atuais.');
  }

  const oddsByFixture = new Map(oddRows.map((entry) => [String(entry.fixture && entry.fixture.id), entry]));
  const upcoming = fixtureRows
    .filter((entry) => ['NS','TBD'].includes(entry.fixture && entry.fixture.status && entry.fixture.status.short))
    .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))
    .slice(0, 80);

  const games = upcoming.map((entry) => {
    const fixtureId = String(entry.fixture.id);
    const market = extractMarket(oddsByFixture.get(fixtureId));
    const start = new Date(entry.fixture.date);
    return {
      id: fixtureId,
      competition: entry.league.name,
      country: entry.league.country || 'Internacional',
      time: start.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }),
      home: entry.teams.home.name,
      away: entry.teams.away.name,
      homeForm: [],
      awayForm: [],
      market: market ? market.label : null,
      odd: market ? market.odd : null,
      bookmaker: market ? market.bookmaker : null,
      confidence: market ? market.confidence : 0,
      evidence: market ? [
        'Cotação real recebida da fonte para ' + market.bookmaker + '.',
        'Confiança de mercado calculada pela probabilidade implícita da odd.'
      ] : [],
      risks: [
        'A cotação pode mudar antes do início da partida.',
        'Probabilidade de mercado não garante o resultado.'
      ],
      source: 'API-Sports',
      updatedAt: new Date().toISOString()
    };
  });

  const warnings = [];
  if (fixtureSuccesses < dates.length) warnings.push('Alguns jogos não puderam ser atualizados.');
  if (!oddsSuccesses) {
    const oddsFailure = failures.find((failure) => failure.type === 'odds');
    warnings.push(oddsFailure && oddsFailure.message
      ? 'Falha nas odds: ' + oddsFailure.message
      : 'A API não retornou as odds; os jogos foram carregados sem cotações.');
  }
  else if (oddsSuccesses < dates.length || oddsPageFailures) warnings.push('Algumas odds não puderam ser atualizadas.');

  const diagnostics = {
    fixtures: upcoming.length,
    oddFixtures: oddsByFixture.size,
    analyzed: games.filter((game) => Number(game.odd) > 1).length,
    remaining
  };
  if (oddsByFixture.size && !diagnostics.analyzed) {
    warnings.push('A API enviou cotações, mas nenhum mercado compatível foi encontrado.');
  }

  return { games, updatedAt: new Date().toISOString(), remaining, warnings, diagnostics, provider: 'API-Sports' };
}

function oddsApiWindow() {
  const now = new Date();
  const until = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  return { from: now.toISOString(), to: until.toISOString() };
}

function formatOddsApiGame(event, eventOdds) {
  const market = extractOddsIoMarket(eventOdds);
  const start = new Date(event.date);
  return {
    id: 'oddsio-' + String(event.id),
    competition: event.league && event.league.name || 'Competição não identificada',
    country: 'Internacional',
    time: start.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }),
    home: event.home,
    away: event.away,
    homeForm: [],
    awayForm: [],
    market: market ? market.label : null,
    odd: market ? market.odd : null,
    bookmaker: market ? market.bookmaker : null,
    confidence: market ? market.confidence : 0,
    evidence: market ? [
      'Cotação real recebida da Odds-API.io para ' + market.bookmaker + '.',
      'Confiança de mercado calculada pela probabilidade implícita da odd.'
    ] : [],
    risks: [
      'A cotação pode mudar antes do início da partida.',
      'Probabilidade de mercado não garante o resultado.'
    ],
    source: 'Odds-API.io',
    updatedAt: new Date().toISOString()
  };
}

async function syncOddsApiIo(key) {
  const bookResponse = await oddsApiGet('/bookmakers/selected', key);
  const bookmakers = selectedBookmakers(bookResponse.response);
  if (!bookmakers.length) {
    throw new Error('Escolha duas casas de apostas no painel da Odds-API.io e tente novamente.');
  }

  const window = oddsApiWindow();
  const eventEndpoint = '/events?sport=football&status=pending&from=' + encodeURIComponent(window.from) +
    '&to=' + encodeURIComponent(window.to) + '&limit=80';
  const eventResponse = await oddsApiGet(eventEndpoint, key);
  const events = (Array.isArray(eventResponse.response) ? eventResponse.response : [])
    .filter((event) => event && event.id && new Date(event.date).getTime() > Date.now())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 80);

  const withOdds = events.filter((event) => Number(event.bookmakerCount || 0) > 0);
  const batches = chunks(withOdds, 10);
  const oddsResults = await Promise.allSettled(batches.map((batch) => {
    const ids = batch.map((event) => event.id).join(',');
    return oddsApiGet('/odds/multi?eventIds=' + encodeURIComponent(ids) +
      '&bookmakers=' + encodeURIComponent(bookmakers.join(',')), key);
  }));

  const oddsByEvent = new Map();
  const failures = [];
  let remaining = eventResponse.remaining || bookResponse.remaining;
  let successfulBatches = 0;
  oddsResults.forEach((result) => {
    if (result.status === 'rejected') {
      failures.push(result.reason && result.reason.message || 'Falha ao buscar um grupo de odds.');
      return;
    }
    successfulBatches += 1;
    remaining = result.value.remaining || remaining;
    const rows = Array.isArray(result.value.response) ? result.value.response : [];
    rows.forEach((row) => oddsByEvent.set(String(row.id), row));
  });

  if (batches.length && !successfulBatches) {
    throw new Error(failures[0] || 'A Odds-API.io não conseguiu carregar as cotações.');
  }

  const games = events.map((event) => formatOddsApiGame(event, oddsByEvent.get(String(event.id))));
  const warnings = [];
  if (failures.length) warnings.push('Alguns grupos de odds não puderam ser atualizados.');
  if (!withOdds.length && events.length) warnings.push('A fonte encontrou jogos, mas ainda não publicou cotações para eles.');
  const diagnostics = {
    fixtures: events.length,
    oddFixtures: oddsByEvent.size,
    analyzed: games.filter((game) => Number(game.odd) > 1).length,
    remaining,
    bookmakers: bookmakers.join(', ')
  };
  if (oddsByEvent.size && !diagnostics.analyzed) {
    warnings.push('A fonte enviou cotações, mas nenhum mercado compatível foi encontrado.');
  }

  return {
    games,
    updatedAt: new Date().toISOString(),
    remaining,
    warnings,
    diagnostics,
    provider: 'Odds-API.io'
  };
}

async function syncSports() {
  const oddsKey = readOddsApiKey();
  const sportsKey = readApiKey();
  if (!oddsKey && !sportsKey) throw new Error('Configure pelo menos uma fonte esportiva em Configurações.');

  const failures = [];
  if (oddsKey) {
    try {
      return await syncOddsApiIo(oddsKey);
    } catch (error) {
      failures.push('Odds-API.io: ' + (error && error.message || 'falhou'));
    }
  }
  if (sportsKey) {
    try {
      const result = await syncApiSports(sportsKey);
      if (failures.length) result.warnings.unshift('A fonte alternativa falhou; os dados foram carregados pela API-Sports.');
      return result;
    } catch (error) {
      failures.push('API-Sports: ' + (error && error.message || 'falhou'));
    }
  }
  throw new Error(failures.join(' | '));
}

function registerIpc() {
  ipcMain.handle('sports:status', () => ({
    configured: Boolean(readApiKey() || readOddsApiKey()),
    apiSportsConfigured: Boolean(readApiKey()),
    oddsApiConfigured: Boolean(readOddsApiKey())
  }));
  ipcMain.handle('sports:save-key', (_, value) => {
    saveApiKey(value);
    return { configured: true };
  });
  ipcMain.handle('sports:clear-key', () => {
    if (fs.existsSync(keyPath())) fs.unlinkSync(keyPath());
    return { configured: false };
  });
  ipcMain.handle('sports:save-odds-key', (_, value) => {
    saveOddsApiKey(value);
    return { configured: true };
  });
  ipcMain.handle('sports:clear-odds-key', () => {
    if (fs.existsSync(oddsApiKeyPath())) fs.unlinkSync(oddsApiKeyPath());
    return { configured: false };
  });
  ipcMain.handle('sports:sync', () => syncSports());
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#07111f',
    title: 'Fred Sports Analyzer',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
