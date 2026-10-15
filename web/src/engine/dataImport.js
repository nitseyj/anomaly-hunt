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

/**
 * A bare `line.split(',')` breaks on any quoted field containing a comma
 * -- common in real exports (Excel/Sheets quote a thousands-separated
 * number like "1,234.56", or any text field with a comma in it), and
 * breaks silently: columns shift, values stop parsing as numbers, and
 * the only symptom is a confusing "not enough valid rows" error on a
 * file that looks completely fine. This walks the line char-by-char,
 * tracking quote state, so a comma inside quotes doesn't split the row,
 * and a doubled `""` inside a quoted field decodes to one literal `"`
 * (the standard CSV escape).
 */
function parseCsvLine(line) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error('CSV needs a header row and at least one data row.');
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => (row[h] = cells[i]));
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
    // Strips thousands separators ("1,234.56") -- correctly splitting a
    // quoted CSV field gets the comma back as literal text, which
    // Number() still can't parse on its own.
    const rawValue = String(row[valueKey] ?? '').replace(/,/g, '');
    const value = Number(rawValue);
    if (!date || rawValue === '' || Number.isNaN(value)) continue;
    series.push({ date, value });
  }

  if (series.length < 14) throw new Error('Need at least 14 valid rows to generate a meaningful case.');

  series.sort((a, b) => new Date(a.date) - new Date(b.date));
  return series.slice(-120);
}
