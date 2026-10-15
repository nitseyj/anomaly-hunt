import { describe, it, expect } from 'vitest';
import { parseImportedData } from './dataImport.js';

function csvRows(n, { header = 'date,value', valueAt = () => 100 } = {}) {
  const lines = [header];
  for (let i = 1; i <= n; i++) {
    lines.push(`2024-01-${String(i).padStart(2, '0')},${valueAt(i)}`);
  }
  return lines.join('\n');
}

describe('parseImportedData (CSV)', () => {
  it('parses a plain, well-formed CSV', () => {
    const series = parseImportedData(csvRows(14));
    expect(series).toHaveLength(14);
    expect(series[0]).toEqual({ date: '2024-01-01', value: 100 });
  });

  it(
    'handles a quoted field containing a comma without misaligning columns -- ' +
      'this is exactly the shape Excel/Sheets exports when a value is ' +
      'thousands-separated, e.g. "1,234.56"',
    () => {
      const csv = ['date,value', '2024-01-01,"1,234.56"', ...Array.from({ length: 13 }, (_, i) => `2024-01-${String(i + 2).padStart(2, '0')},100`)].join('\n');
      const series = parseImportedData(csv);
      expect(series.find((p) => p.date === '2024-01-01').value).toBe(1234.56);
    }
  );

  it('decodes a doubled "" inside a quoted field as one literal quote, per the CSV escape convention', () => {
    const csv = ['title,date,value', '"Say ""hi""",2024-01-01,100', ...Array.from({ length: 13 }, (_, i) => `x,2024-01-${String(i + 2).padStart(2, '0')},100`)].join('\n');
    expect(() => parseImportedData(csv)).not.toThrow();
  });

  it('does not misparse a quoted field as a thousands separator when the column itself has no comma issue', () => {
    const series = parseImportedData(csvRows(14, { valueAt: (i) => 100 + i }));
    expect(series.map((p) => p.value)).toEqual(Array.from({ length: 14 }, (_, i) => 100 + i + 1));
  });

  it('recognizes any of the documented flexible column name aliases', () => {
    const csv = ['day,amount', ...Array.from({ length: 14 }, (_, i) => `2024-01-${String(i + 1).padStart(2, '0')},${50 + i}`)].join('\n');
    expect(() => parseImportedData(csv)).not.toThrow();
  });

  it('is case-insensitive and trims whitespace on column headers', () => {
    const csv = [' Date , Value ', ...Array.from({ length: 14 }, (_, i) => `2024-01-${String(i + 1).padStart(2, '0')},50`)].join('\n');
    expect(() => parseImportedData(csv)).not.toThrow();
  });

  it('skips rows with a non-numeric or missing value instead of throwing', () => {
    const csv = ['date,value', '2024-01-01,oops', '2024-01-02,', ...Array.from({ length: 14 }, (_, i) => `2024-01-${String(i + 3).padStart(2, '0')},100`)].join('\n');
    const series = parseImportedData(csv);
    expect(series.every((p) => Number.isFinite(p.value))).toBe(true);
    expect(series.find((p) => p.date === '2024-01-01')).toBeUndefined();
  });

  it('throws a clear error when there are fewer than 14 valid rows', () => {
    expect(() => parseImportedData(csvRows(10))).toThrow(/14/);
  });

  it('throws when no recognizable date or value column exists', () => {
    const csv = ['foo,bar', ...Array.from({ length: 14 }, () => '1,2')].join('\n');
    expect(() => parseImportedData(csv)).toThrow();
  });

  it('sorts the output chronologically regardless of input order', () => {
    const lines = ['date,value'];
    for (let i = 14; i >= 1; i--) lines.push(`2024-01-${String(i).padStart(2, '0')},${i}`);
    const series = parseImportedData(lines.join('\n'));
    for (let i = 1; i < series.length; i++) {
      expect(new Date(series[i].date) >= new Date(series[i - 1].date)).toBe(true);
    }
  });

  it('caps output at the most recent 120 points', () => {
    const lines = ['date,value'];
    const start = new Date(2024, 0, 1);
    for (let i = 0; i < 150; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      lines.push(`${d.toISOString().slice(0, 10)},${i}`);
    }
    const series = parseImportedData(lines.join('\n'));
    expect(series).toHaveLength(120);
    // the most RECENT 120 -- the earliest 30 days should have been dropped
    expect(series[0].value).toBe(30);
    expect(series[series.length - 1].value).toBe(149);
  });
});

describe('parseImportedData (JSON)', () => {
  it('accepts a bare JSON array of rows', () => {
    const rows = Array.from({ length: 14 }, (_, i) => ({ date: `2024-01-${String(i + 1).padStart(2, '0')}`, value: i }));
    const series = parseImportedData(JSON.stringify(rows), 'data.json');
    expect(series).toHaveLength(14);
  });

  it('accepts a JSON object with a top-level "data" array', () => {
    const rows = Array.from({ length: 14 }, (_, i) => ({ date: `2024-01-${String(i + 1).padStart(2, '0')}`, value: i }));
    const series = parseImportedData(JSON.stringify({ data: rows }), 'data.json');
    expect(series).toHaveLength(14);
  });

  it('throws when JSON is neither an array nor {data: [...]}', () => {
    expect(() => parseImportedData(JSON.stringify({ nope: true }), 'data.json')).toThrow();
  });
});
