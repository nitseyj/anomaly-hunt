/**
 * dataImport.js
 *
 * Parses user-supplied data (a local file or a URL) into the same
 * {date, value} series shape every generator already produces -- so
 * once parsed, imported data flows through the exact same anomaly
 * injection, scoring, and detector pipeline as procedurally generated
 * data. Deliberately minimal: two columns, CSV or JSON, no schema
 * configuration UI, matching "as simple as possible."
 */

/** Parses CSV text with a `date,value` shape. Auto-detects and skips a header row. */
function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) throw new Error('The file appears to be empty.');

  const rows = lines.map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')));

  // If the first row's second column isn't a number, treat it as a header and skip it.
  const first = rows[0];
  const startIdx = first.length >= 2 && isNaN(parseFloat(first[1])) ? 1 : 0;

  const series = [];
  for (let i = startIdx; i < rows.length; i++) {
    const [date, rawValue] = rows[i];
    const value = parseFloat(rawValue);
    if (!date || isNaN(value)) continue; // skip malformed rows rather than failing the whole import
    series.push({ date, value });
  }
  if (series.length < 10) {
    throw new Error(`Only found ${series.length} valid rows — need at least 10 for a fair round.`);
  }
  return series;
}

/** Parses a JSON array of {date, value} objects (also accepts {label,...}/{x,y} variants loosely). */
function parseJson(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('Expected a JSON array of {date, value} objects.');

  const series = [];
  for (const row of data) {
    const date = row.date ?? row.label ?? row.x;
    const value = Number(row.value ?? row.y);
    if (!date || isNaN(value)) continue;
    series.push({ date: String(date), value });
  }
  if (series.length < 10) {
    throw new Error(`Only found ${series.length} valid rows — need at least 10 for a fair round.`);
  }
  return series;
}

/** Evenly samples a series down to at most `maxLength` points, preserving overall shape rather than just truncating to a time window. No-op if already short enough. */
export function downsampleSeries(series, maxLength = 90) {
  if (series.length <= maxLength) return series;
  const step = series.length / maxLength;
  const sampled = [];
  for (let i = 0; i < maxLength; i++) {
    sampled.push(series[Math.floor(i * step)]);
  }
  return sampled;
}

/** Parses raw text as JSON if it looks like JSON, otherwise as CSV. */
export function parseSeriesText(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return parseJson(trimmed);
  }
  return parseCsv(trimmed);
}

/** Reads a local File (from a file input) as text and parses it. */
export function parseSeriesFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(parseSeriesText(String(reader.result)));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsText(file);
  });
}

/** Fetches a URL and parses its response as CSV or JSON. */
export async function parseSeriesUrl(url) {
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Couldn't reach that URL — check it's correct and publicly accessible (CORS can block cross-site fetches).");
  }
  if (!response.ok) throw new Error(`Server responded with ${response.status}.`);
  const text = await response.text();
  return parseSeriesText(text);
}
