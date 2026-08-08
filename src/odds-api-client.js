const API_BASE = 'https://api.odds-api.io/v3';
const DEFAULT_TIMEOUT_MS = 18000;
const DEFAULT_RETRIES = 1;

class OddsApiError extends Error {
  constructor(message, options) {
    super(message);
    this.name = 'OddsApiError';
    this.code = options && options.code;
    this.retryable = Boolean(options && options.retryable);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorDetail(payload) {
  if (!payload) return '';
  if (typeof payload.error === 'string') return payload.error;
  if (payload.error && typeof payload.error.message === 'string') return payload.error.message;
  if (typeof payload.message === 'string') return payload.message;
  return '';
}

function responseError(status, payload) {
  const detail = errorDetail(payload);
  if (status === 401 || status === 403) {
    return new OddsApiError('A chave da Odds-API.io foi recusada ou não tem acesso. Confira a chave e as duas casas selecionadas no painel.', { code: 'AUTH' });
  }
  if (status === 429) {
    return new OddsApiError('O limite da Odds-API.io foi atingido. O programa tentará a outra fonte configurada.', { code: 'RATE_LIMIT' });
  }
  if (status >= 500) {
    return new OddsApiError('A Odds-API.io está temporariamente indisponível.', { code: 'SERVER', retryable: true });
  }
  return new OddsApiError(detail || ('A Odds-API.io respondeu com erro ' + status + '.'), { code: 'API' });
}

function withApiKey(endpoint, key) {
  const separator = String(endpoint).includes('?') ? '&' : '?';
  return API_BASE + endpoint + separator + 'apiKey=' + encodeURIComponent(key);
}

async function requestOnce(endpoint, key, options) {
  const opts = options || {};
  const fetchImpl = opts.fetchImpl || fetch;
  const timeoutMs = Number(opts.timeoutMs || DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(withApiKey(endpoint, key), { signal: controller.signal });
    let payload;
    try {
      payload = await response.json();
    } catch (_) {
      throw new OddsApiError('A Odds-API.io enviou uma resposta inválida.', { code: 'INVALID_RESPONSE', retryable: true });
    }
    if (!response.ok) throw responseError(response.status, payload);
    const detail = errorDetail(payload);
    if (detail) throw new OddsApiError(detail, { code: 'API' });
    return {
      response: payload,
      remaining: response.headers && response.headers.get
        ? response.headers.get('x-ratelimit-remaining')
        : null
    };
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new OddsApiError('A Odds-API.io demorou mais de 18 segundos para responder.', { code: 'TIMEOUT', retryable: true });
    }
    if (error instanceof OddsApiError) throw error;
    throw new OddsApiError('Não foi possível conectar à Odds-API.io. Verifique a internet e tente novamente.', { code: 'NETWORK', retryable: true });
  } finally {
    clearTimeout(timer);
  }
}

async function oddsApiGet(endpoint, key, options) {
  const opts = options || {};
  const retries = Number.isInteger(opts.retries) ? opts.retries : DEFAULT_RETRIES;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestOnce(endpoint, key, opts);
    } catch (error) {
      lastError = error;
      if (!error.retryable || attempt === retries) throw error;
      await sleep(700);
    }
  }
  throw lastError;
}

function selectedBookmakers(payload) {
  if (Array.isArray(payload)) {
    return payload.map((item) => typeof item === 'string' ? item : item && item.name).filter(Boolean);
  }
  if (!payload || typeof payload !== 'object') return [];
  const list = payload.bookmakers || payload.selected || payload.selectedBookmakers || payload.data;
  if (Array.isArray(list)) return selectedBookmakers(list);
  if (list && typeof list === 'object') {
    return Object.keys(list).filter((name) => list[name] !== false && list[name] != null);
  }
  const metadata = /^(count|limit|max|plan|message|status|success)$/i;
  return Object.keys(payload).filter((name) => !metadata.test(name) &&
    (payload[name] === true || typeof payload[name] === 'string' || (payload[name] && typeof payload[name] === 'object')));
}

function decimalLine(value) {
  return String(value).replace('.', ',');
}

function addCandidate(candidates, label, value, bookmaker) {
  const odd = Number(value);
  if (!label || !Number.isFinite(odd) || odd < 1.08 || odd > 2.35) return;
  candidates.push({
    label,
    odd,
    bookmaker,
    confidence: Math.max(1, Math.min(90, Math.round((100 / odd) * 0.94)))
  });
}

function candidatesFromMarket(candidates, bookmaker, market) {
  const name = String(market && market.name || '').trim().toLowerCase();
  const rows = Array.isArray(market && market.odds) ? market.odds : [];

  for (const row of rows) {
    if (name === 'ml' || name === '1x2' || name.includes('moneyline')) {
      addCandidate(candidates, 'Vitória do mandante', row.home, bookmaker);
      addCandidate(candidates, 'Empate', row.draw, bookmaker);
      addCandidate(candidates, 'Vitória do visitante', row.away, bookmaker);
      continue;
    }

    if (name.includes('double chance')) {
      addCandidate(candidates, 'Mandante ou empate', row.homeDraw || row.home_draw || row['1x'], bookmaker);
      addCandidate(candidates, 'Visitante ou empate', row.drawAway || row.draw_away || row.x2, bookmaker);
      addCandidate(candidates, 'Mandante ou visitante', row.homeAway || row.home_away || row['12'], bookmaker);
      continue;
    }

    if (name.includes('both teams') && name.includes('score')) {
      addCandidate(candidates, 'Ambas as equipes marcam', row.yes, bookmaker);
      addCandidate(candidates, 'Ambas as equipes não marcam', row.no, bookmaker);
      continue;
    }

    const line = Number(row.hdp);
    if (!Number.isFinite(line)) continue;
    if (name === 'totals' || name.includes('goals over/under')) {
      if (line >= 1.5 && line <= 4.5) {
        addCandidate(candidates, 'Mais de ' + decimalLine(line) + ' gols', row.over, bookmaker);
        addCandidate(candidates, 'Menos de ' + decimalLine(line) + ' gols', row.under, bookmaker);
      }
    } else if (name.includes('corners totals')) {
      if (line >= 6.5 && line <= 13.5) {
        addCandidate(candidates, 'Mais de ' + decimalLine(line) + ' escanteios', row.over, bookmaker);
        addCandidate(candidates, 'Menos de ' + decimalLine(line) + ' escanteios', row.under, bookmaker);
      }
    } else if (name.includes('bookings totals')) {
      if (line >= 1.5 && line <= 7.5) {
        addCandidate(candidates, 'Mais de ' + decimalLine(line) + ' cartões', row.over, bookmaker);
        addCandidate(candidates, 'Menos de ' + decimalLine(line) + ' cartões', row.under, bookmaker);
      }
    } else if (name.includes('team total home')) {
      addCandidate(candidates, 'Mandante: mais de ' + decimalLine(line) + ' gols', row.over, bookmaker);
      addCandidate(candidates, 'Mandante: menos de ' + decimalLine(line) + ' gols', row.under, bookmaker);
    } else if (name.includes('team total away')) {
      addCandidate(candidates, 'Visitante: mais de ' + decimalLine(line) + ' gols', row.over, bookmaker);
      addCandidate(candidates, 'Visitante: menos de ' + decimalLine(line) + ' gols', row.under, bookmaker);
    }
  }
}

function extractOddsIoMarket(eventOdds) {
  if (!eventOdds || !eventOdds.bookmakers || typeof eventOdds.bookmakers !== 'object') return null;
  const candidates = [];
  for (const [bookmaker, markets] of Object.entries(eventOdds.bookmakers)) {
    for (const market of Array.isArray(markets) ? markets : []) {
      candidatesFromMarket(candidates, bookmaker, market);
    }
  }
  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.confidence - a.confidence || b.odd - a.odd)[0];
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

module.exports = {
  oddsApiGet,
  requestOnce,
  OddsApiError,
  selectedBookmakers,
  extractOddsIoMarket,
  chunks
};
