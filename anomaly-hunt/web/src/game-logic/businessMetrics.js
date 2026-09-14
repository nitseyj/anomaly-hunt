/**
 * businessMetrics.js
 *
 * Shared building blocks for every game mode: a seedable RNG, a Gaussian
 * sampler, date generation, and the library of business-metric templates
 * (revenue, active users, etc.) that both the Anomaly Hunt mode and the
 * Forecast Call mode generate their rounds from. Kept in one place so
 * adding an eighth template, or a new game mode, doesn't mean copying
 * this logic a third time.
 */

export const SERIES_LENGTH = 90;

export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rng, mean = 0, std = 1) {
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

export function makeDates(length = SERIES_LENGTH, startOffset = 0) {
  const start = new Date(2024, 0, 1 + startOffset);
  return Array.from({ length }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    // Build the string from LOCAL calendar components -- toISOString()
    // converts through UTC first, which silently shifts the calendar
    // date backward by a day in any negative-UTC-offset timezone (e.g.
    // most of the Americas). getFullYear/getMonth/getDate are all local,
    // so this is timezone-safe.
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
}

/**
 * A unique ID for one generated round/case -- used as a React `key` on
 * the chart component so it fully unmounts and remounts whenever new
 * data loads. Recharts caches axis scale/tick calculations internally
 * per chart instance, and reusing the same instance across genuinely
 * different datasets (a new case's shorter date range, different value
 * scale) can leave stale ticks/domain from the previous case mixed in
 * with the new one. A key tied to generation identity, not just case
 * content, guarantees a clean remount every time.
 */
export function generateInstanceId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function stdDev(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Metrics that can't go negative (or, for ms, shouldn't sanely go near zero). */
const UNIT_FLOORS = { count: 0, usd: 0, percent: 0, roas: 0, ms: 15 };

export function clampToUnit(values, unit) {
  const floor = UNIT_FLOORS[unit];
  if (floor === undefined) return values;
  return values.map((v) => Math.max(floor, v));
}

export const UNIT_FORMATTERS = {
  usd: (v) => `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
  percent: (v) => `${v}%`,
  ms: (v) => `${v}ms`,
  count: (v) => Number(v).toLocaleString(),
  roas: (v) => `${v}x`,
};

export function formatValue(value, unit) {
  const fmt = UNIT_FORMATTERS[unit] || ((v) => v);
  return fmt(value);
}

/**
 * Each template describes a business metric: how to generate a clean
 * series (with some randomized jitter so repeats of the same template
 * still look different), plus display metadata and a few scenario
 * phrasings to rotate through for extra variety.
 */
export const TEMPLATES = [
  {
    id: 'revenue',
    y_label: 'Revenue',
    unit: 'usd',
    hasWeeklySeasonality: true,
    scenarios: [
      { case_name: 'Q1 Revenue Review', scenario: "You're reviewing daily revenue for an online store. Finance flagged that recent numbers looked \"off\" somewhere. Find the day something broke." },
      { case_name: 'Weekly Sales Audit', scenario: 'Store revenue is tracked daily. A regional manager thinks something broke the usual pattern — find where it started.' },
    ],
    generate(rng, length = SERIES_LENGTH) {
      const base = 6000 + rng() * 6000;
      const growth = 5 + rng() * 20;
      const weekendLift = 1200 + rng() * 1000;
      const noiseStd = 250 + rng() * 200;
      const dates = makeDates(length);
      const values = dates.map((d, t) => {
        const dow = new Date(d).getDay();
        const weekend = dow === 0 || dow === 6 ? weekendLift : 0;
        return Math.max(0, base + t * growth + weekend + gaussian(rng, 0, noiseStd));
      });
      return { dates, values };
    },
  },
  {
    id: 'active_users',
    y_label: 'Daily active users',
    unit: 'count',
    hasWeeklySeasonality: true,
    scenarios: [
      { case_name: 'Product Usage Audit', scenario: "You're checking daily active users for a SaaS product ahead of a board update. Something looks inconsistent — find it." },
      { case_name: 'Engagement Check-in', scenario: 'The growth team wants a sanity check on daily active user counts before quoting them externally.' },
    ],
    generate(rng, length = SERIES_LENGTH) {
      const base = 2000 + rng() * 3000;
      const growth = 2 + rng() * 8;
      const weekdayLift = 300 + rng() * 400;
      const noiseStd = 60 + rng() * 60;
      const dates = makeDates(length);
      const values = dates.map((d, t) => {
        const dow = new Date(d).getDay();
        const isWeekday = dow >= 1 && dow <= 5;
        const raw = base + t * growth + (isWeekday ? weekdayLift : -weekdayLift * 0.6) + gaussian(rng, 0, noiseStd);
        return Math.max(0, raw);
      });
      return { dates, values };
    },
  },
  {
    id: 'support_tickets',
    y_label: 'Tickets opened',
    unit: 'count',
    hasWeeklySeasonality: true,
    scenarios: [
      { case_name: 'Support Volume Check', scenario: 'Customer support tickets are tracked daily. Ops wants to know if a real incident is hiding in the noise.' },
      { case_name: 'Ticket Backlog Review', scenario: "Someone on the support team thinks something threw off the usual ticket volume. Find where it started." },
    ],
    generate(rng, length = SERIES_LENGTH) {
      const base = 60 + rng() * 60;
      const growth = 0.02 + rng() * 0.08;
      const weekdayLift = 10 + rng() * 15;
      const noiseStd = 4 + rng() * 5;
      const dates = makeDates(length);
      const values = dates.map((d, t) => {
        const dow = new Date(d).getDay();
        const isWeekday = dow >= 1 && dow <= 5;
        const raw = base + t * growth + (isWeekday ? weekdayLift : -weekdayLift) + gaussian(rng, 0, noiseStd);
        return Math.max(0, raw);
      });
      return { dates, values };
    },
  },
  {
    id: 'defect_rate',
    y_label: 'Defect rate',
    unit: 'percent',
    hasWeeklySeasonality: false,
    scenarios: [
      { case_name: 'Manufacturing QA Log', scenario: 'A factory line logs its daily defect rate. Quality control wants confirmation on whether any day breached normal tolerance.' },
      { case_name: 'Line 3 Quality Audit', scenario: 'A supplier claims their defect rate has been stable all month. Verify that against the daily log.' },
    ],
    generate(rng, length = SERIES_LENGTH) {
      const base = 1.2 + rng() * 2;
      const noiseStd = 0.08 + rng() * 0.15;
      const dates = makeDates(length);
      const values = dates.map(() => Math.max(0, base + gaussian(rng, 0, noiseStd)));
      return { dates, values };
    },
  },
  {
    id: 'response_time',
    y_label: 'Response time',
    unit: 'ms',
    hasWeeklySeasonality: true,
    scenarios: [
      { case_name: 'API Performance Incident', scenario: 'Engineering tracks average API response time daily. Something here may have caused a real performance regression.' },
      { case_name: 'Latency Sanity Check', scenario: 'On-call engineering wants a second opinion on whether latency really degraded, or if it\u2019s normal noise.' },
    ],
    generate(rng, length = SERIES_LENGTH) {
      const base = 150 + rng() * 150;
      const growth = 0.05 + rng() * 0.3;
      const noiseStd = 6 + rng() * 8;
      const dates = makeDates(length);
      const values = dates.map((d, t) => {
        const dow = new Date(d).getDay();
        const load = (dow >= 1 && dow <= 5 ? 1 : -1) * (10 + rng() * 15);
        return Math.max(30, base + t * growth + load + gaussian(rng, 0, noiseStd));
      });
      return { dates, values };
    },
  },
  {
    id: 'ad_spend_roas',
    y_label: 'Return on ad spend',
    unit: 'roas',
    hasWeeklySeasonality: false,
    scenarios: [
      { case_name: 'Ad Campaign Audit', scenario: "Marketing wants to know if the campaign's return on ad spend held steady, or if something threw it off — find where that started." },
      { case_name: 'Paid Media Review', scenario: 'A media buyer flagged that ROAS pattern looked off at some point this month. Find where it started.' },
    ],
    generate(rng, length = SERIES_LENGTH) {
      const base = 2.2 + rng() * 1.5;
      const noiseStd = 0.15 + rng() * 0.2;
      const dates = makeDates(length);
      const values = dates.map(() => Math.max(0, base + gaussian(rng, 0, noiseStd)));
      return { dates, values };
    },
  },
  {
    id: 'churn_rate',
    y_label: 'Churn rate',
    unit: 'percent',
    hasWeeklySeasonality: false,
    scenarios: [
      { case_name: 'Subscriber Churn Watch', scenario: 'Customer success tracks daily churn rate. Leadership wants to know if any day was a real outlier.' },
      { case_name: 'Retention Health Check', scenario: 'A dip in retention was mentioned in standup. Find where it actually started, if it did.' },
    ],
    generate(rng, length = SERIES_LENGTH) {
      const base = 0.8 + rng() * 1.2;
      const noiseStd = 0.05 + rng() * 0.1;
      const dates = makeDates(length);
      const values = dates.map(() => Math.max(0, base + gaussian(rng, 0, noiseStd)));
      return { dates, values };
    },
  },
];

/** Picks a random template (avoiding ones already used this game where possible) and one of its scenario phrasings. */
export function pickTemplate(rng, usedTemplateIds = []) {
  const available = TEMPLATES.filter((t) => !usedTemplateIds.includes(t.id));
  const pool = available.length > 0 ? available : TEMPLATES;
  const template = pool[Math.floor(rng() * pool.length)];
  const scenario = template.scenarios[Math.floor(rng() * template.scenarios.length)];
  return { template, scenario };
}
