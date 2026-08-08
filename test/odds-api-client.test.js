const test = require('node:test');
const assert = require('node:assert/strict');
const {
  requestOnce,
  selectedBookmakers,
  extractOddsIoMarket,
  chunks
} = require('../src/odds-api-client');

function jsonResponse(payload, status) {
  return {
    ok: (status || 200) >= 200 && (status || 200) < 300,
    status: status || 200,
    headers: { get: () => '490' },
    json: async () => payload
  };
}

test('envia a chave da Odds-API.io somente na consulta', async () => {
  let requestedUrl = '';
  const result = await requestOnce('/events?sport=football', 'chave secreta', {
    fetchImpl: async (url) => {
      requestedUrl = url;
      return jsonResponse([]);
    },
    timeoutMs: 100
  });
  assert.match(requestedUrl, /apiKey=chave%20secreta/);
  assert.deepEqual(result.response, []);
  assert.equal(result.remaining, '490');
});

test('lê as casas selecionadas em formatos comuns da API', () => {
  assert.deepEqual(selectedBookmakers({ bookmakers: ['Bet365', 'Betano'] }), ['Bet365', 'Betano']);
  assert.deepEqual(selectedBookmakers([{ name: 'Bet365' }, { name: 'KTO' }]), ['Bet365', 'KTO']);
  assert.deepEqual(selectedBookmakers({ Bet365: true, Betano: true, limit: 2 }), ['Bet365', 'Betano']);
});

test('extrai mercado de gols da Odds-API.io', () => {
  const market = extractOddsIoMarket({
    bookmakers: {
      Bet365: [
        { name: 'Totals', odds: [{ hdp: 2.5, over: '1.80', under: '2.05' }] }
      ]
    }
  });
  assert.equal(market.label, 'Mais de 2,5 gols');
  assert.equal(market.odd, 1.8);
  assert.equal(market.bookmaker, 'Bet365');
});

test('extrai resultado da partida quando não há totais', () => {
  const market = extractOddsIoMarket({
    bookmakers: {
      Betano: [{ name: 'ML', odds: [{ home: '1.55', draw: '3.80', away: '5.20' }] }]
    }
  });
  assert.equal(market.label, 'Vitória do mandante');
  assert.equal(market.odd, 1.55);
});

test('agrupa no máximo dez eventos por consulta', () => {
  const groups = chunks(Array.from({ length: 23 }, (_, index) => index + 1), 10);
  assert.deepEqual(groups.map((group) => group.length), [10, 10, 3]);
});
