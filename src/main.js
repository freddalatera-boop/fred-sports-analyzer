const { app, BrowserWindow, shell, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

const API_BASE = 'https://v3.football.api-sports.io';
const preferredBooks = /bet365|betano|sportingbet|kto|pixbet/i;

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

async function apiGet(endpoint, key) {
  const response = await fetch(API_BASE + endpoint, {
    headers: { 'x-apisports-key': key }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error('A fonte esportiva respondeu com erro ' + response.status + '.');
  if (payload.errors && Object.keys(payload.errors).length) {
    throw new Error(Object.values(payload.errors).join(' '));
  }
  return {
    response: Array.isArray(payload.response) ? payload.response : [],
    remaining: response.headers.get('x-ratelimit-requests-remaining')
  };
}

function localDate(offset) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const date = new Date(Date.now() + offset * 86400000);
  return formatter.format(date);
}

function translateMarket(bet, value) {
  const name = String(bet || '').toLowerCase();
  const selection = String(value || '').toLowerCase();
  if (name.includes('double chance')) {
    if (selection.includes('home') && selection.includes('draw')) return 'Mandante ou empate';
    if (selection.includes('away') && selection.includes('draw')) return 'Visitante ou empate';
  }
  if (name.includes('over') || name.includes('goals')) {
    if (selection === 'over 1.5') return 'Mais de 1,5 gols';
    if (selection === 'under 3.5') return 'Menos de 3,5 gols';
  }
  return '';
}

function extractMarket(oddEntry) {
  if (!oddEntry) return null;
  const candidates = [];
  const allBooks = oddEntry.bookmakers || [];
  const books = allBooks.filter((book) => preferredBooks.test(book.name || ''));
  const selectedBooks = books.length ? books : allBooks;

  for (const book of selectedBooks) {
    for (const bet of book.bets || []) {
      for (const value of bet.values || []) {
        const label = translateMarket(bet.name, value.value);
        const odd = Number(value.odd);
        if (!label || !Number.isFinite(odd) || odd < 1.12 || odd > 2.2) continue;
        candidates.push({ label, odd, bookmaker: book.name || 'Casa não identificada' });
      }
    }
  }

  if (!candidates.length) return null;
  const grouped = new Map();
  for (const item of candidates) {
    const previous = grouped.get(item.label);
    if (!previous || item.odd > previous.odd) grouped.set(item.label, item);
  }
  const options = Array.from(grouped.values()).map((item) => {
    item.confidence = Math.max(1, Math.min(90, Math.round((100 / item.odd) * 0.94)));
    return item;
  }).filter((item) => item.confidence >= 50);

  return options.sort((a, b) => b.confidence - a.confidence)[0] || null;
}

async function syncSports() {
  const key = readApiKey();
  if (!key) throw new Error('Configure sua chave gratuita da API-Sports.');
  const dates = [localDate(0), localDate(1)];
  const fixtureRows = [];
  const oddRows = [];
  let remaining = null;

  for (const date of dates) {
    const fixtures = await apiGet('/fixtures?date=' + date + '&timezone=America%2FSao_Paulo', key);
    fixtureRows.push(...fixtures.response);
    remaining = fixtures.remaining || remaining;
    const odds = await apiGet('/odds?date=' + date + '&timezone=America%2FSao_Paulo', key);
    oddRows.push(...odds.response);
    remaining = odds.remaining || remaining;
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

  return { games, updatedAt: new Date().toISOString(), remaining };
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
