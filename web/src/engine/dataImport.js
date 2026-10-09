/**
 * dataImport.js
 *
 * Turns a user-supplied CSV or JSON file into a {date, value} series that
 * generateCaseFromSeries() can inject anomalies into. Deliberately
 * tolerant of messy real-world exports: flexible column names, skips
 * unparsable rows instead of throwing.
 */

const DATE_KEYS = ['date', 'day', 'timestamp', 'time'];
const VALUE_KEYS = ['value', 'amount', 'count', 'metric', 'y'];

function findKey(row, candidates) {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const match = keys.find((k) => k.toLowerCase().trim() === c);
    if (match) return match;
  }
  return null;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error('CSV needs a header row and at least one data row.');
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    headers.forEach((h, i) => (row[h] = cells[i]?.trim()));
    return row;
  });
}

export function parseImportedData(text, filename = '') {
  const isJson = filename.toLowerCase().endsWith('.json') || text.trim().startsWith('[') || text.trim().startsWith('{');
  let rows;

  if (isJson) {
    const parsed = JSON.parse(text);
    rows = Array.isArray(parsed) ? parsed : parsed.data;
    if (!Array.isArray(rows)) throw new Error('JSON must be an array of rows, or {"data": [...]}.');
  } else {
    rows = parseCsv(text);
  }

  if (rows.length === 0) throw new Error('No rows found.');

  const dateKey = findKey(rows[0], DATE_KEYS);
  const valueKey = findKey(rows[0], VALUE_KEYS);
  if (!dateKey) throw new Error(`Couldn't find a date column (tried: ${DATE_KEYS.join(', ')}).`);
  if (!valueKey) throw new Error(`Couldn't find a value column (tried: ${VALUE_KEYS.join(', ')}).`);

  const series = [];
  for (const row of rows) {
    const date = String(row[dateKey]).trim();
    const value = Number(row[valueKey]);
    if (!date || Number.isNaN(value)) continue;
    series.push({ date, value });
  }

  if (series.length < 14) throw new Error('Need at least 14 valid rows to generate a meaningful case.');

  series.sort((a, b) => new Date(a.date) - new Date(b.date));
  return series.slice(-120);
}
