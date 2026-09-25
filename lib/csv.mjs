export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else {
      if (c === '"') quoted = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') {
        row.push(field.replace(/\r$/, '')); field = '';
        if (row.some((x) => x !== '')) rows.push(row);
        row = [];
      } else field += c;
    }
  }
  row.push(field.replace(/\r$/, ''));
  if (row.some((x) => x !== '')) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim().replace(/^\uFEFF/, ''));
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
}

export function numberFrom(row, candidates) {
  for (const key of candidates) {
    const n = Number(row[key]);
    if (Number.isFinite(n) && n > 1) return n;
  }
  return null;
}

export function extractFootballDataMatch(row) {
  const close = [
    numberFrom(row, ['AvgCH', 'B365CH', 'PSCH', 'AvgH', 'B365H', 'PSH']),
    numberFrom(row, ['AvgCD', 'B365CD', 'PSCD', 'AvgD', 'B365D', 'PSD']),
    numberFrom(row, ['AvgCA', 'B365CA', 'PSCA', 'AvgA', 'B365A', 'PSA'])
  ];
  const open = [
    numberFrom(row, ['AvgH', 'B365H', 'PSH']),
    numberFrom(row, ['AvgD', 'B365D', 'PSD']),
    numberFrom(row, ['AvgA', 'B365A', 'PSA'])
  ];
  const result = String(row.FTR || '').trim().toUpperCase();
  if (!['H', 'D', 'A'].includes(result) || close.some((x) => !x)) return null;
  return {
    date: row.Date || '',
    home: row.HomeTeam || '',
    away: row.AwayTeam || '',
    result,
    close,
    open: open.every(Boolean) ? open : null
  };
}
