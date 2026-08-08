const test = require('node:test');
const assert = require('node:assert/strict');
const { apiGet, requestOnce, payloadError } = require('../src/api-client');

function jsonResponse(payload, status) {
  return {
    ok: (status || 200) >= 200 && (status || 200) < 300,
    status: status || 200,
    headers: { get: () => '88' },
    json: async () => payload
  };
}

test('retorna dados e limite restante', async () => {
  const result = await requestOnce('/fixtures', 'chave', {
    fetchImpl: async () => jsonResponse({ response: [{ id: 1 }], errors: [] }),
    timeoutMs: 100
  });
  assert.deepEqual(result.response, [{ id: 1 }]);
  assert.equal(result.remaining, '88');
  assert.deepEqual(result.paging, { current: 1, total: 1 });
});

test('traduz limite excedido para mensagem clara sem repetir', async () => {
  let calls = 0;
  await assert.rejects(
    apiGet('/odds', 'chave', {
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({ errors: { rateLimit: 'Too many requests' } }, 429);
      },
      retries: 1,
      timeoutMs: 100
    }),
    /limite de consultas/
  );
  assert.equal(calls, 1);
});

test('repete uma vez quando o servidor falha temporariamente', async () => {
  let calls = 0;
  const result = await apiGet('/fixtures', 'chave', {
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({}, 503);
      return jsonResponse({ response: [] }, 200);
    },
    retries: 1,
    timeoutMs: 100
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.response, []);
});

test('traduz chave recusada mesmo quando a API responde com status 200', async () => {
  await assert.rejects(
    requestOnce('/fixtures', 'chave', {
      fetchImpl: async () => jsonResponse({ errors: { token: 'Error/Missing application key' } }),
      timeoutMs: 100
    }),
    /chave da API-Sports foi recusada/
  );
});

test('formata erros em objetos sem exibir object Object', () => {
  assert.equal(payloadError({ errors: { plan: { message: 'indisponível' } } }), '{"message":"indisponível"}');
});
