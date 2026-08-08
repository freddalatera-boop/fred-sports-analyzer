const test = require('node:test');
const assert = require('node:assert/strict');
const { translateMarket, extractMarket } = require('../src/markets');

test('reconhece os principais mercados da API', () => {
  assert.equal(translateMarket('Match Winner', 'Home'), 'Vitória do mandante');
  assert.equal(translateMarket('Double Chance', 'Draw/Away'), 'Visitante ou empate');
  assert.equal(translateMarket('Goals Over/Under', 'Over 2.5'), 'Mais de 2,5 gols');
  assert.equal(translateMarket('Both Teams Score', 'Yes'), 'Ambas as equipes marcam');
  assert.equal(translateMarket('Corners Over Under', 'Over 8.5'), 'Mais de 8,5 escanteios');
});

test('usa outras casas quando as preferidas não têm mercado compatível', () => {
  const market = extractMarket({
    bookmakers: [
      { name: 'Betano', bets: [{ name: 'Mercado desconhecido', values: [{ value: 'X', odd: '1.30' }] }] },
      { name: 'Outra Casa', bets: [{ name: 'Double Chance', values: [{ value: 'Home/Draw', odd: '1.35' }] }] }
    ]
  });
  assert.equal(market.label, 'Mandante ou empate');
  assert.equal(market.bookmaker, 'Outra Casa');
});
