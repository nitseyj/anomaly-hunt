/** Parses user-supplied data (file or URL) into the {date, value} series
 * shape every generator already produces, so imported data flows through
 * the exact same anomaly-injection/scoring/detector pipeline. */

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) throw new Error('The file appears to be empty.');

  const rows = lines.map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')));
  const first = rows[0];
  const startIdx = first.length >= 2 && isNaN(parseFloat(first[1])) ? 1 : 0;

  const series = [];
  for (let i = startIdx; i < rows.length; i++) {
    const [date, rawValue] = rows[i];
    const value = parseFloat(rawValue);
    if (!date || isNaN(value)) continue;
    series.push({ date, value });
  }
  if (series.length < 10) throw new Error(`Only found ${series.length} valid rows — need at least 10 for a fair round.`);
  return series;
}

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
  if (series.length < 10) throw new Error(`Only found ${series.length} valid rows — need at least 10 for a fair round.`);
  return series;
}

export function downsampleSeries(series, maxLength = 90) {
  if (series.length <= maxLength) return series;
  const step = series.length / maxLength;
  return Array.from({ length: maxLength }, (_, i) => series[Math.floor(i * step)]);
}

export function parseSeriesText(text) {
  const trimmed = text.trim();
  return trimmed.startsWith('[') || trimmed.startsWith('{') ? parseJson(trimmed) : parseCsv(trimmed);
}

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

export async function parseSeriesUrl(url) {
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Couldn't reach that URL — check it's correct and publicly accessible (CORS can block cross-site fetches).");
  }
  if (!response.ok) throw new Error(`Server responded with ${response.status}.`);
  return parseSeriesText(await response.text());
}
