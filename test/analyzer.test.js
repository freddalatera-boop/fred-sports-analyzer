const test = require('node:test');
const assert = require('node:assert/strict');
const { implicitProbability, combinedOdd, combinedProbability, riskLabel, buildTicket } = require('../src/analyzer');

test('calcula probabilidade implícita', () => {
  assert.equal(implicitProbability(2), 50);
  assert.equal(implicitProbability(0), 0);
});

test('calcula odd combinada', () => {
  assert.equal(combinedOdd([{ odd: 1.5 }, { odd: 2 }]), 3);
});

test('calcula confiança combinada', () => {
  assert.equal(combinedProbability([{ confidence: 80 }, { confidence: 50 }]), 40);
  assert.equal(combinedProbability([]), 0);
});

test('classifica risco', () => {
  assert.equal(riskLabel(70), 'Conservador');
  assert.equal(riskLabel(50), 'Moderado');
  assert.equal(riskLabel(30), 'Alto');
});

test('não coloca duas seleções do mesmo jogo no bilhete automático', () => {
  const result = buildTicket([
    { eventId: 'a', odd: 1.5, confidence: 80 },
    { eventId: 'a', odd: 2, confidence: 75 },
    { eventId: 'b', odd: 1.6, confidence: 70 }
  ], 2);
  assert.equal(result.length, 2);
  assert.notEqual(result[0].eventId, result[1].eventId);
});
