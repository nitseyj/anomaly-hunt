/**
 * metrics.js
 *
 * The business-metric template library every mode generates its rounds
 * from: how to build a clean (anomaly-free) series with realistic trend,
 * weekly seasonality and noise, plus how to format and floor its values.
 */
import { smoothNoise } from './rng.js';

export const SERIES_LENGTH = 90;

/** Builds `length` consecutive ISO date strings from local calendar
 * components (never toISOString(), which shifts the date in negative-UTC
 * timezones around local midnight). */
export function makeDates(length = SERIES_LENGTH, startOffset = 0) {
  const start = new Date(2024, 0, 1 + startOffset);
  return Array.from({ length }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
}

/**
 * A light centered moving average, applied to a clean (pre-anomaly)
 * series right before anomalies are injected (see case.js). This is the
 * safety net that guarantees a calm baseline regardless of how a given
 * random noise draw happened to turn out -- AR(1) noise (smoothNoise in
 * rng.js) already makes day-to-day values correlated rather than
 * independent, but a correlated random walk can still wander through an
 * occasional choppy stretch by chance. Smoothing happens BEFORE anomaly
 * injection, not after, so an injected anomaly is never itself blurred
 * away -- it lands on top of an already-calm baseline, which is exactly
 * what makes it read as an obvious deviation instead of just more noise.
 */
export function movingAverage(values, window = 3) {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(values.length, i + half + 1);
    const slice = values.slice(start, end);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

const UNIT_FLOORS = { count: 0, usd: 0, percent: 0, roas: 0, ms: 15 };

export function clampToUnit(values, unit) {
  const floor = UNIT_FLOORS[unit];
  if (floor === undefined) return values;
  return values.map((v) => Math.max(floor, v));
}

const round2 = (v) => Math.round(v * 100) / 100;

/** `count` rounds to a whole number for display -- you can't have a
 * fraction of a user or a ticket -- while the series itself keeps
 * 2-decimal internal precision for smooth chart/scoring math. The rest
 * round too, purely to guard against float noise leaking into display. */
export const UNIT_FORMATTERS = {
  usd: (v) => `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
  percent: (v) => `${round2(v)}%`,
  ms: (v) => `${round2(v)}ms`,
  count: (v) => Math.round(v).toLocaleString(),
  roas: (v) => `${round2(v)}x`,
};

export function formatValue(value, unit) {
  const fmt = UNIT_FORMATTERS[unit] || ((v) => v);
  return fmt(value);
}

function dayOfWeek(dateStr) {
  return new Date(dateStr).getDay();
}

export const METRIC_TEMPLATES = [
  {
    id: 'revenue',
    label: 'Revenue',
    unit: 'usd',
    hasWeeklySeasonality: true,
    scenarios: [
      { title: 'Q1 Revenue Review', brief: "Daily revenue for an online store. Finance flagged that recent numbers looked off somewhere — find the day something broke." },
      { title: 'Weekend Lift Audit', brief: 'Store revenue is tracked daily. A regional manager thinks something broke the usual weekend pattern.' },
    ],
    generate(rng, length = SERIES_LENGTH) {
      const base = 6200 + rng() * 5800;
      const growth = 4 + rng() * 18;
      const weekendLift = 1100 + rng() * 1100;
      const noiseStd = 240 + rng() * 220;
      const dates = makeDates(length);
      const noise = smoothNoise(rng, length, noiseStd);
      const values = dates.map((d, t) => {
        const dow = dayOfWeek(d);
        const weekend = dow === 0 || dow === 6 ? weekendLift : 0;
        return Math.max(0, base + t * growth + weekend + noise[t]);
      });
      return { dates, values };
    },
  },
  {
    id: 'active_users',
    label: 'Daily active users',
    unit: 'count',
    hasWeeklySeasonality: true,
    scenarios: [
      { title: 'Product Usage Audit', brief: 'Daily active users for a SaaS product ahead of a board update — something looks inconsistent.' },
      { title: 'Engagement Check-in', brief: 'The growth team wants a sanity check on DAU before quoting it externally.' },
    ],
    generate(rng, length = SERIES_LENGTH) {
      const base = 2100 + rng() * 2900;
      const growth = 2 + rng() * 7;
      const weekdayLift = 280 + rng() * 380;
      const noiseStd = 55 + rng() * 55;
      const dates = makeDates(length);
      const noise = smoothNoise(rng, length, noiseStd);
      const values = dates.map((d, t) => {
        const dow = dayOfWeek(d);
        const isWeekday = dow >= 1 && dow <= 5;
        const raw = base + t * growth + (isWeekday ? weekdayLift : -weekdayLift * 0.6) + noise[t];
        return Math.max(0, raw);
      });
      return { dates, values };
    },
  },
  {
    id: 'support_tickets',
    label: 'Tickets opened',
    unit: 'count',
    hasWeeklySeasonality: true,
    scenarios: [
      { title: 'Support Volume Check', brief: 'Customer support tickets are tracked daily — ops wants to know if a real incident is hiding in the noise.' },
      { title: 'Ticket Backlog Review', brief: 'Something may have thrown off the usual ticket volume. Find where it started.' },
    ],
    generate(rng, length = SERIES_LENGTH) {
      const base = 58 + rng() * 58;
      const growth = 0.02 + rng() * 0.08;
      const weekdayLift = 9 + rng() * 14;
      const noiseStd = 4 + rng() * 5;
      const dates = makeDates(length);
      const noise = smoothNoise(rng, length, noiseStd);
      const values = dates.map((d, t) => {
        const dow = dayOfWeek(d);
        const isWeekday = dow >= 1 && dow <= 5;
        const raw = base + t * growth + (isWeekday ? weekdayLift : -weekdayLift) + noise[t];
        return Math.max(0, raw);
      });
      return { dates, values };
    },
  },
  {
    id: 'defect_rate',
    label: 'Defect rate',
    unit: 'percent',
    hasWeeklySeasonality: false,
    scenarios: [
      { title: 'Manufacturing QA Log', brief: 'A factory line logs its daily defect rate. QC wants confirmation on whether any day breached normal tolerance.' },
      { title: 'Line 3 Quality Audit', brief: 'A supplier claims their defect rate held steady all month — verify it against the daily log.' },
    ],
    generate(rng, length = SERIES_LENGTH) {
      const base = 1.1 + rng() * 2.1;
      const noiseStd = 0.08 + rng() * 0.15;
      const dates = makeDates(length);
      const noise = smoothNoise(rng, length, noiseStd);
      const values = dates.map((_, t) => Math.max(0, base + noise[t]));
      return { dates, values };
    },
  },
  {
    id: 'response_time',
    label: 'Response time',
    unit: 'ms',
    hasWeeklySeasonality: true,
    scenarios: [
      { title: 'API Performance Incident', brief: 'Engineering tracks average API response time daily. Something here may be a real regression.' },
      { title: 'Latency Sanity Check', brief: 'On-call wants a second opinion on whether latency really degraded, or if it is normal noise.' },
    ],
    generate(rng, length = SERIES_LENGTH) {
      const base = 145 + rng() * 150;
      const growth = 0.05 + rng() * 0.3;
      const weekdayLoad = 12 + rng() * 10;
      const noiseStd = 6 + rng() * 8;
      const dates = makeDates(length);
      const noise = smoothNoise(rng, length, noiseStd);
      const values = dates.map((d, t) => {
        const dow = dayOfWeek(d);
        const load = (dow >= 1 && dow <= 5 ? 1 : -1) * weekdayLoad;
        return Math.max(30, base + t * growth + load + noise[t]);
      });
      return { dates, values };
    },
  },
  {
    id: 'ad_roas',
    label: 'Return on ad spend',
    unit: 'roas',
    hasWeeklySeasonality: false,
    scenarios: [
      { title: 'Ad Campaign Audit', brief: "Marketing wants to know if the campaign's ROAS held steady, or if something threw it off." },
      { title: 'Paid Media Review', brief: 'A media buyer flagged that ROAS looked off at some point this month — find where it started.' },
    ],
    generate(rng, length = SERIES_LENGTH) {
      const base = 2.1 + rng() * 1.5;
      const noiseStd = 0.15 + rng() * 0.2;
      const dates = makeDates(length);
      const noise = smoothNoise(rng, length, noiseStd);
      const values = dates.map((_, t) => Math.max(0, base + noise[t]));
      return { dates, values };
    },
  },
  {
    id: 'churn_rate',
    label: 'Churn rate',
    unit: 'percent',
    hasWeeklySeasonality: false,
    scenarios: [
      { title: 'Subscriber Churn Watch', brief: 'Customer success tracks daily churn. Leadership wants to know if any day was a real outlier.' },
      { title: 'Retention Health Check', brief: 'A dip in retention was mentioned in standup — find where it actually started, if it did.' },
    ],
    generate(rng, length = SERIES_LENGTH) {
      const base = 0.75 + rng() * 1.25;
      const noiseStd = 0.05 + rng() * 0.1;
      const dates = makeDates(length);
      const noise = smoothNoise(rng, length, noiseStd);
      const values = dates.map((_, t) => Math.max(0, base + noise[t]));
      return { dates, values };
    },
  },
];

export function pickTemplate(rng, usedTemplateIds = []) {
  const available = METRIC_TEMPLATES.filter((t) => !usedTemplateIds.includes(t.id));
  const pool = available.length > 0 ? available : METRIC_TEMPLATES;
  const template = pool[Math.floor(rng() * pool.length)];
  const scenario = template.scenarios[Math.floor(rng() * template.scenarios.length)];
  return { template, scenario };
}
