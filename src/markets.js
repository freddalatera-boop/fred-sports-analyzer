const preferredBooks = /bet365|betano|sportingbet|kto|pixbet/i;

function decimal(value) {
  return String(value).replace('.', ',');
}

function lineFrom(selection) {
  const match = String(selection || '').toLowerCase().match(/(over|under)\s*([0-9]+(?:\.[0-9]+)?)/);
  return match ? { direction: match[1], line: Number(match[2]) } : null;
}

function translateMarket(bet, value) {
  const name = String(bet || '').toLowerCase();
  const selection = String(value || '').toLowerCase();

  if (name.includes('match winner') || name === '1x2') {
    if (selection === 'home') return 'Vitória do mandante';
    if (selection === 'away') return 'Vitória do visitante';
    if (selection === 'draw') return 'Empate';
  }

  if (name.includes('double chance')) {
    if (selection.includes('home') && selection.includes('draw')) return 'Mandante ou empate';
    if (selection.includes('away') && selection.includes('draw')) return 'Visitante ou empate';
    if (selection.includes('home') && selection.includes('away')) return 'Mandante ou visitante';
  }

  if (name.includes('both teams') && (name.includes('score') || name.includes('to score'))) {
    if (selection === 'yes') return 'Ambas as equipes marcam';
    if (selection === 'no') return 'Ambas as equipes não marcam';
  }

  const total = lineFrom(selection);
  if (!total) return '';

  if (name.includes('corner')) {
    if (total.line < 6.5 || total.line > 13.5) return '';
    return (total.direction === 'over' ? 'Mais de ' : 'Menos de ') + decimal(total.line) + ' escanteios';
  }

  if (name.includes('card')) {
    if (total.line < 1.5 || total.line > 7.5) return '';
    return (total.direction === 'over' ? 'Mais de ' : 'Menos de ') + decimal(total.line) + ' cartões';
  }

  if (name.includes('home team') && name.includes('goal')) {
    return 'Mandante: ' + (total.direction === 'over' ? 'mais de ' : 'menos de ') + decimal(total.line) + ' gols';
  }

  if (name.includes('away team') && name.includes('goal')) {
    return 'Visitante: ' + (total.direction === 'over' ? 'mais de ' : 'menos de ') + decimal(total.line) + ' gols';
  }

  if (name.includes('goal') || name.includes('over/under')) {
    if (total.line < 1.5 || total.line > 4.5) return '';
    return (total.direction === 'over' ? 'Mais de ' : 'Menos de ') + decimal(total.line) + ' gols';
  }

  return '';
}

function candidatesFrom(books) {
  const candidates = [];
  for (const book of books) {
    for (const bet of book.bets || []) {
      for (const value of bet.values || []) {
        const label = translateMarket(bet.name, value.value);
        const odd = Number(value.odd);
        if (!label || !Number.isFinite(odd) || odd < 1.08 || odd > 2.35) continue;
        candidates.push({ label, odd, bookmaker: book.name || 'Casa não identificada' });
      }
    }
  }
  return candidates;
}

function extractMarket(oddEntry) {
  if (!oddEntry) return null;
  const allBooks = oddEntry.bookmakers || [];
  const preferred = allBooks.filter((book) => preferredBooks.test(book.name || ''));
  let candidates = candidatesFrom(preferred);
  if (!candidates.length) candidates = candidatesFrom(allBooks);
  if (!candidates.length) return null;

  const grouped = new Map();
  for (const item of candidates) {
    const previous = grouped.get(item.label);
    if (!previous || item.odd > previous.odd) grouped.set(item.label, item);
  }

  return Array.from(grouped.values())
    .map((item) => Object.assign(item, {
      confidence: Math.max(1, Math.min(90, Math.round((100 / item.odd) * 0.94)))
    }))
    .filter((item) => item.confidence >= 42)
    .sort((a, b) => b.confidence - a.confidence)[0] || null;
}

module.exports = { translateMarket, extractMarket };
