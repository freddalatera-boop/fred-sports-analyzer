const { app, BrowserWindow, shell, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { apiGet, buildOddsEndpoint } = require('./api-client');
const { extractMarket } = require('./markets');

function keyPath() {
  return path.join(app.getPath('userData'), 'sports-api-key.bin');
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

async function syncSports() {
  const key = readApiKey();
  if (!key) throw new Error('Configure sua chave gratuita da API-Sports.');
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

  return { games, updatedAt: new Date().toISOString(), remaining, warnings, diagnostics };
}

function registerIpc() {
  ipcMain.handle('sports:status', () => ({ configured: Boolean(readApiKey()) }));
  ipcMain.handle('sports:save-key', (_, value) => {
    saveApiKey(value);
    return { configured: true };
  });
  ipcMain.handle('sports:clear-key', () => {
    if (fs.existsSync(keyPath())) fs.unlinkSync(keyPath());
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
