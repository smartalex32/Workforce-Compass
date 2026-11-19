import { validateMarketPoint, type MarketPoint } from './domain';

export type SurveyColumn =
  | 'jobCode'
  | 'job'
  | 'surveyLevel'
  | 'p25'
  | 'p50'
  | 'p75'
  | 'currency'
  | 'market'
  | 'payBasis';
export type SurveyColumnMapping = Partial<Record<SurveyColumn, string>>;
export type SurveyJobMatch = Record<string, string | null>;

export type SurveyInputRow = {
  rowNumber: number;
  values: Record<string, string>;
};
export type SurveyImportScope = {
  organizationId: string;
  marketId: string;
  currency: string;
  datasetId?: string | null;
  datasetName: string;
  source: string;
  effectiveDate: string;
  sourceMarketLabel?: string;
};

export type SurveyPreviewRow = {
  rowNumber: number;
  job: string;
  levelId: string | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  action: 'add' | 'update' | 'unchanged' | 'skip' | 'conflict';
  reason?: string;
  requiresReview?: boolean;
  previous?: MarketPoint;
  resolutionAction?: 'add' | 'update' | 'unchanged';
};

export type SurveyPreview = {
  rows: SurveyPreviewRow[];
  additions: number;
  updates: number;
  unchanged: number;
  skipped: number;
  conflicts: number;
};

export type SurveyMappingRecord = {
  columns: SurveyColumnMapping;
  jobMatches: SurveyJobMatch;
};

export function parseSurveyAmount(value: string | undefined): number | null {
  const text = value?.trim();
  if (!text) return null;
  const normalized = text
    .replaceAll(',', '')
    .replace(/^\$/, '')
    .replace(/\s/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function guessSurveyColumns(headers: string[]): SurveyColumnMapping {
  const find = (pattern: RegExp) =>
    headers.find((header) => pattern.test(header));
  return {
    jobCode: find(/^(job.?code|benchmark.?code)\b/i),
    job:
      find(/^(job.?title|benchmark.?(title|job)|role|position|title)\b/i) ??
      find(/^(job|benchmark)(?:$| \(column \d+\))/i),
    surveyLevel: find(/^(survey.?level|level|grade)/i),
    p25: find(/^(base.?salary.?p25|p25|25th|percentile.?25|q1)/i),
    p50: find(/^(base.?salary.?p50|p50|median|50th|percentile.?50)/i),
    p75: find(/^(base.?salary.?p75|p75|75th|percentile.?75|q3)/i),
    currency: find(/^currency$/i),
    market: find(/^(market|location|geo(graphy)?)/i),
    payBasis: find(/^(pay.?basis|pay.?period|frequency)\b/i),
  };
}

export function surveyRowKey(
  values: Record<string, string>,
  mapping: SurveyColumnMapping,
  rowNumber: number,
) {
  return (
    [
      mapping.jobCode && values[mapping.jobCode],
      mapping.job && values[mapping.job],
      mapping.surveyLevel && values[mapping.surveyLevel],
    ]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(' · ') || `Row ${rowNumber}`
  );
}

function samePoint(
  a: Pick<SurveyPreviewRow, 'p25' | 'p50' | 'p75'>,
  b: Pick<SurveyPreviewRow, 'p25' | 'p50' | 'p75'>,
) {
  return a.p25 === b.p25 && a.p50 === b.p50 && a.p75 === b.p75;
}

export function previewSurveyImport(input: {
  rows: SurveyInputRow[];
  mapping: SurveyColumnMapping;
  jobMatches: SurveyJobMatch;
  currency: string;
  marketName?: string;
  levels: Array<{ id: string; code: string; name: string }>;
  existing: MarketPoint[];
}): SurveyPreview {
  const existingByLevel = new Map(
    input.existing.map((row) => [row.levelId, row]),
  );
  const targetByLevel = new Map<string, SurveyPreviewRow[]>();
  const activeLevelIds = new Set(input.levels.map((level) => level.id));
  const rows = input.rows.map<SurveyPreviewRow>((row) => {
    const value = (column: SurveyColumn) =>
      input.mapping[column] ? row.values[input.mapping[column]!] : undefined;
    const job = surveyRowKey(row.values, input.mapping, row.rowNumber);
    const currency = value('currency')?.trim();
    const market = value('market')?.trim();
    const basis = value('payBasis')?.trim();
    if (currency && currency.toUpperCase() !== input.currency.toUpperCase())
      return {
        rowNumber: row.rowNumber,
        job,
        levelId: null,
        p25: null,
        p50: null,
        p75: null,
        action: 'skip',
        reason: `Currency is ${currency}, not ${input.currency}.`,
      };
    if (
      input.marketName &&
      market &&
      market.toLowerCase() !== input.marketName.toLowerCase()
    )
      return {
        rowNumber: row.rowNumber,
        job,
        levelId: null,
        p25: null,
        p50: null,
        p75: null,
        action: 'skip',
        reason: `Market is ${market}, not ${input.marketName}.`,
      };
    if (
      basis &&
      !/^(?:annual(?:ly|ized|ised)?(?: base (?:pay|salary))?|year(?:ly)?|per year|per annum|yr)$/i.test(
        basis,
      )
    )
      return {
        rowNumber: row.rowNumber,
        job,
        levelId: null,
        p25: null,
        p50: null,
        p75: null,
        action: 'skip',
        reason: 'Only annual base-pay observations can be imported.',
      };
    const levelId = input.jobMatches[job] ?? null;
    function bound(column: 'p25' | 'p75') {
      const raw = value(column)?.trim();
      if (!raw || /^(?:-+|—|–|n\/?a|suppressed|withheld|\*)$/i.test(raw))
        return null;
      return parseSurveyAmount(raw) ?? Number.NaN;
    }
    const point = {
      p25: bound('p25'),
      p50: parseSurveyAmount(value('p50')) ?? Number.NaN,
      p75: bound('p75'),
    };
    if (!levelId || !activeLevelIds.has(levelId))
      return {
        rowNumber: row.rowNumber,
        job,
        levelId: null,
        ...point,
        action: 'skip',
        requiresReview: true,
        reason:
          'Match this survey job to an internal job level before importing.',
      };
    if (!validateMarketPoint({ levelId, ...point }))
      return {
        rowNumber: row.rowNumber,
        job,
        levelId,
        ...point,
        action: 'skip',
        requiresReview: true,
        reason:
          'A positive median is required; supplied percentiles must be ordered around it.',
      };
    const prior = targetByLevel.get(levelId) ?? [];
    const current = existingByLevel.get(levelId);
    const result: SurveyPreviewRow = {
      rowNumber: row.rowNumber,
      job,
      levelId,
      ...point,
      previous: current,
      action: current
        ? samePoint(current, point)
          ? 'unchanged'
          : 'update'
        : 'add',
    };
    targetByLevel.set(levelId, [...prior, result]);
    return result;
  });
  for (const duplicates of targetByLevel.values()) {
    if (duplicates.length < 2) continue;
    const distinct = duplicates.some((row) => !samePoint(duplicates[0], row));
    for (const row of duplicates) {
      if (distinct) {
        row.resolutionAction =
          row.action === 'skip' || row.action === 'conflict'
            ? undefined
            : row.action;
        row.action = 'conflict';
        row.reason = `Conflicts with another row for the same internal job level.`;
      } else if (row !== duplicates[0]) {
        row.action = 'skip';
        row.reason = `Identical duplicate of row ${duplicates[0].rowNumber}; it will not be imported twice.`;
      }
    }
  }
  const count = (action: SurveyPreviewRow['action']) =>
    rows.filter((row) => row.action === action).length;
  return {
    rows,
    additions: count('add'),
    updates: count('update'),
    unchanged: count('unchanged'),
    skipped: count('skip'),
    conflicts: count('conflict'),
  };
}
