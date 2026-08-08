const API_BASE = 'https://v3.football.api-sports.io';
const DEFAULT_TIMEOUT_MS = 18000;
const DEFAULT_RETRIES = 1;

class SportsApiError extends Error {
  constructor(message, options) {
    super(message);
    this.name = 'SportsApiError';
    this.code = options && options.code;
    this.retryable = Boolean(options && options.retryable);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function payloadError(payload) {
  if (!payload || !payload.errors || !Object.keys(payload.errors).length) return '';
  return Object.values(payload.errors).map((value) => {
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  }).join(' ');
}

function responseError(status, payload) {
  const detail = payloadError(payload);
  if (status === 401 || status === 403) {
    return new SportsApiError('A chave da API-Sports foi recusada. Confira a chave em Configurações.', { code: 'AUTH' });
  }
  if (status === 429) {
    return new SportsApiError('O limite de consultas da API-Sports foi atingido. Aguarde a renovação do limite.', { code: 'RATE_LIMIT' });
  }
  if (status >= 500) {
    return new SportsApiError('A API-Sports está temporariamente indisponível.', { code: 'SERVER', retryable: true });
  }
  return new SportsApiError(detail || ('A API-Sports respondeu com erro ' + status + '.'), { code: 'API' });
}

async function requestOnce(endpoint, key, options) {
  const opts = options || {};
  const fetchImpl = opts.fetchImpl || fetch;
  const timeoutMs = Number(opts.timeoutMs || DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(API_BASE + endpoint, {
      headers: { 'x-apisports-key': key },
      signal: controller.signal
    });

    let payload;
    try {
      payload = await response.json();
    } catch (_) {
      throw new SportsApiError('A API-Sports enviou uma resposta inválida.', { code: 'INVALID_RESPONSE', retryable: true });
    }

    if (!response.ok) throw responseError(response.status, payload);
    const detail = payloadError(payload);
    if (detail) {
      const authRejected = /api.?key|application key|token|auth|unauthorized/i.test(detail);
      const rateLimited = /rate.?limit|quota|too many requests|requests?.*(reached|exceeded)/i.test(detail);
      throw new SportsApiError(
        authRejected
          ? 'A chave da API-Sports foi recusada. Confira a chave em Configurações.'
          : rateLimited
            ? 'O limite de consultas da API-Sports foi atingido. Aguarde a renovação do limite.'
            : detail,
        { code: authRejected ? 'AUTH' : rateLimited ? 'RATE_LIMIT' : 'API' }
      );
    }

    return {
      response: Array.isArray(payload.response) ? payload.response : [],
      remaining: response.headers && response.headers.get
        ? response.headers.get('x-ratelimit-requests-remaining')
        : null,
      paging: {
        current: Number(payload.paging && payload.paging.current) || 1,
        total: Number(payload.paging && payload.paging.total) || 1
      }
    };
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new SportsApiError('A API-Sports demorou mais de 18 segundos para responder.', { code: 'TIMEOUT', retryable: true });
    }
    if (error instanceof SportsApiError) throw error;
    throw new SportsApiError('Não foi possível conectar à API-Sports. Verifique a internet e tente novamente.', { code: 'NETWORK', retryable: true });
  } finally {
    clearTimeout(timer);
  }
}

async function apiGet(endpoint, key, options) {
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

module.exports = { apiGet, requestOnce, SportsApiError, payloadError };
