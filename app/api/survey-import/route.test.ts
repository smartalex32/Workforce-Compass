import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleWorkspace } from '@/lib/sample-data';
import { createTestDatabase, type TestDatabase } from '@/lib/test-database';

const workerEnv = vi.hoisted(() => ({
  DB: undefined as unknown,
  WORKFORCE_COMPASS_ALLOW_INSECURE_LOCAL: 'true' as string | undefined,
}));
vi.mock('@/db/runtime', () => ({
  getDb: async () => workerEnv.DB,
  runtimeEnv: workerEnv,
}));

import { PUT } from '@/app/api/workspace/route';
import { POST } from './route';

function body(
  action: 'preview' | 'apply',
  extra: Record<string, unknown> = {},
) {
  return new Request('http://workforce.test/api/survey-import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action,
      scope: {
        organizationId: 'org-1',
        marketId: 'market-hsv',
        currency: 'USD',
        datasetId: 'dataset-2026',
        datasetName: '2026 market data',
        source: 'SurveyCo',
        effectiveDate: '2026-01-01',
      },
      rows: [
        {
          rowNumber: 2,
          values: {
            Code: 'SWE-1',
            Median: '101000',
            Currency: 'USD',
            Period: 'Annual',
          },
        },
      ],
      mapping: {
        jobCode: 'Code',
        p50: 'Median',
        currency: 'Currency',
        payBasis: 'Period',
      },
      jobMatches: { 'SWE-1': 'l1' },
      ...extra,
    }),
  });
}

describe('survey import API', () => {
  let database: TestDatabase;
  beforeEach(async () => {
    database = await createTestDatabase();
    workerEnv.DB = database;
    await PUT(
      new Request('http://workforce.test/api/workspace', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspace: structuredClone(sampleWorkspace) }),
      }),
    );
  });
  afterEach(async () => database.close());

  it('adds only checked rows and makes an identical reimport a no-op', async () => {
    const scope = {
      organizationId: 'org-1',
      marketId: 'market-hsv',
      currency: 'USD',
      datasetId: null,
      datasetName: 'Purchased engineering survey',
      source: 'SurveyCo',
      effectiveDate: '2026-01-01',
    };
    const reviewed = await POST(body('preview', { scope }));
    const preview = (await reviewed.json()) as {
      preview: { rows: Array<{ rowNumber: number; action: string }> };
      previewFingerprint: string;
    };
    expect(preview.preview.rows[0].action).toBe('add');
    const applied = await POST(
      body('apply', {
        scope,
        selectedRowNumbers: [2],
        previewFingerprint: preview.previewFingerprint,
      }),
    );
    const result = (await applied.json()) as { datasetId: string };
    expect(applied.status).toBe(200);
    expect(
      await database
        .prepare(
          'SELECT count(*)::integer AS count FROM market_compensation WHERE dataset_id = ?',
        )
        .bind(result.datasetId)
        .first(),
    ).toMatchObject({ count: 1 });
    const repeat = await POST(
      body('preview', { scope: { ...scope, datasetId: result.datasetId } }),
    );
    const repeated = (await repeat.json()) as {
      preview: { rows: Array<{ action: string }> };
    };
    expect(repeated.preview.rows[0].action).toBe('unchanged');
  });

  it('requires a new review when data changed after preview and surfaces duplicate conflicts', async () => {
    const preview = (await (await POST(body('preview'))).json()) as {
      previewFingerprint: string;
    };
    expect(
      (
        await POST(
          body('apply', {
            rows: [
              {
                rowNumber: 2,
                values: {
                  Code: 'SWE-1',
                  Median: '101001',
                  Currency: 'USD',
                  Period: 'Annual',
                },
              },
            ],
            selectedRowNumbers: [2],
            previewFingerprint: preview.previewFingerprint,
          }),
        )
      ).status,
    ).toBe(409);
    await database
      .prepare(
        'UPDATE market_compensation SET p50 = 99999 WHERE dataset_id = ? AND level_id = ?',
      )
      .bind('dataset-2026', 'l1')
      .run();
    expect(
      (
        await POST(
          body('apply', {
            selectedRowNumbers: [2],
            previewFingerprint: preview.previewFingerprint,
          }),
        )
      ).status,
    ).toBe(409);
    const rows = [
      {
        rowNumber: 2,
        values: {
          Code: 'SWE-1',
          Median: '101000',
          Currency: 'USD',
          Period: 'Annual',
        },
      },
      {
        rowNumber: 3,
        values: {
          Code: 'SWE-1',
          Median: '102000',
          Currency: 'USD',
          Period: 'Annual',
        },
      },
    ];
    const conflict = await POST(body('preview', { rows }));
    const result = (await conflict.json()) as {
      preview: { rows: Array<{ action: string }> };
      previewFingerprint: string;
    };
    expect(result.preview.rows.map((row) => row.action)).toEqual([
      'conflict',
      'conflict',
    ]);
    const selection = {
      rows,
      selectedRowNumbers: [3],
      previewFingerprint: result.previewFingerprint,
      conflictChoices: { l1: 3 },
    };
    expect((await POST(body('apply', selection))).status).toBe(400);
    expect(
      (await POST(body('apply', { ...selection, ignoredRowNumbers: [2] })))
        .status,
    ).toBe(200);
    expect(
      await database
        .prepare(
          'SELECT p50 FROM market_compensation WHERE dataset_id = ? AND level_id = ?',
        )
        .bind('dataset-2026', 'l1')
        .first(),
    ).toMatchObject({ p50: 102000 });
  });
});
