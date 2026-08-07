function implicitProbability(odd) {
  const value = Number(odd);
  if (!Number.isFinite(value) || value <= 1) return 0;
  return 100 / value;
}

function combinedOdd(selections) {
  return Number(selections.reduce((total, item) => total * Number(item.odd || 1), 1).toFixed(2));
}

function combinedProbability(selections) {
  return Number(selections.reduce((total, item) => total * (Number(item.confidence || 0) / 100), 1) * 100);
}

function riskLabel(probability) {
  if (probability >= 62) return 'Conservador';
  if (probability >= 42) return 'Moderado';
  return 'Alto';
}

function buildTicket(candidates, targetOdd) {
  const sorted = [...candidates]
    .filter((item) => Number(item.odd) > 1 && Number(item.confidence) >= 50)
    .sort((a, b) => b.confidence - a.confidence);
  const selected = [];
  const events = new Set();

  for (const item of sorted) {
    if (events.has(item.eventId)) continue;
    selected.push(item);
    events.add(item.eventId);
    if (combinedOdd(selected) >= targetOdd) break;
  }
  return selected;
}

module.exports = { implicitProbability, combinedOdd, combinedProbability, riskLabel, buildTicket };
