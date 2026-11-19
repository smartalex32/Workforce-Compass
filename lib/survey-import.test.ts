import { describe, expect, it } from 'vitest';
import { guessSurveyColumns, previewSurveyImport } from './survey-import';

const levels = [{ id: 'l2', code: 'ENG-2', name: 'Engineer II' }];
const mapping = {
  job: 'Role',
  p25: 'P25',
  p50: 'Median',
  p75: 'P75',
  currency: 'Currency',
  payBasis: 'Basis',
};

describe('survey import preview', () => {
  it('maps median-only survey rows and identifies no-op reimports', () => {
    const input = {
      rows: [
        {
          rowNumber: 2,
          values: {
            Role: 'Engineer II',
            P25: '',
            Median: '125,000',
            P75: '',
            Currency: 'USD',
            Basis: 'Annual',
          },
        },
      ],
      mapping,
      jobMatches: { 'Engineer II': 'l2' },
      currency: 'USD',
      levels,
      existing: [],
    };
    expect(previewSurveyImport(input).rows[0]).toMatchObject({
      action: 'add',
      levelId: 'l2',
      p25: null,
      p50: 125000,
      p75: null,
    });
    expect(
      previewSurveyImport({
        ...input,
        existing: [{ levelId: 'l2', p25: null, p50: 125000, p75: null }],
      }).rows[0].action,
    ).toBe('unchanged');
  });

  it('skips non-annual rows and makes conflicting duplicate jobs explicit', () => {
    const preview = previewSurveyImport({
      rows: [
        {
          rowNumber: 2,
          values: {
            Role: 'ENG-2',
            P25: '100',
            Median: '120',
            P75: '140',
            Currency: 'USD',
            Basis: 'Annual',
          },
        },
        {
          rowNumber: 3,
          values: {
            Role: 'ENG-2',
            P25: '110',
            Median: '130',
            P75: '150',
            Currency: 'USD',
            Basis: 'Annual',
          },
        },
        {
          rowNumber: 4,
          values: {
            Role: 'Engineer II',
            P25: '',
            Median: '60',
            P75: '',
            Currency: 'USD',
            Basis: 'Hourly',
          },
        },
      ],
      mapping,
      jobMatches: { 'ENG-2': 'l2', 'Engineer II': 'l2' },
      currency: 'USD',
      levels,
      existing: [],
    });
    expect(preview.rows.map((row) => row.action)).toEqual([
      'conflict',
      'conflict',
      'skip',
    ]);
  });

  it('suggests common purchased-survey headers', () => {
    expect(
      guessSurveyColumns([
        'Benchmark job',
        '25th percentile',
        'Median',
        '75th percentile',
        'Currency',
      ]),
    ).toMatchObject({
      job: 'Benchmark job',
      p25: '25th percentile',
      p50: 'Median',
      p75: '75th percentile',
      currency: 'Currency',
    });
  });
});
