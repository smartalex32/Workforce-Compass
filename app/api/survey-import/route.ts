import {
  isNotNullViolation,
  type AppDatabase,
  type DatabaseRow,
  type DatabaseStatement,
} from '@/db';
import { getDb, runtimeEnv } from '@/db/runtime';
import { authorizeApiRequest } from '@/lib/api-auth';
import {
  canEditPlanning,
  loadPlanningState,
  planningActor,
  planningRoleFor,
} from '@/lib/planning-repository';
import {
  previewSurveyImport,
  type SurveyColumnMapping,
  type SurveyImportScope,
  type SurveyInputRow,
  type SurveyJobMatch,
  type SurveyMappingRecord,
} from '@/lib/survey-import';

type ImportBody = {
  action: 'preview' | 'apply';
  scope: SurveyImportScope;
  rows: SurveyInputRow[];
  mapping: SurveyColumnMapping;
  jobMatches: SurveyJobMatch;
  selectedRowNumbers?: number[];
  ignoredRowNumbers?: number[];
  conflictChoices?: Record<string, number>;
  saveMappingAs?: string;
  previewFingerprint?: string;
};

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}
function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function isoDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(new Date(`${value}T00:00:00Z`).getTime())
  );
}

function validBody(value: unknown): value is ImportBody {
  if (
    !isObject(value) ||
    (value.action !== 'preview' && value.action !== 'apply') ||
    !isObject(value.scope) ||
    !Array.isArray(value.rows) ||
    !isObject(value.mapping) ||
    !isObject(value.jobMatches)
  )
    return false;
  const scope = value.scope;
  const rowNumbers = new Set<number>();
  return (
    [
      'organizationId',
      'marketId',
      'currency',
      'datasetName',
      'source',
      'effectiveDate',
    ].every((key) => typeof scope[key] === 'string') &&
    (scope.sourceMarketLabel === undefined ||
      typeof scope.sourceMarketLabel === 'string') &&
    value.rows.every((row) => {
      if (
        !isObject(row) ||
        typeof row.rowNumber !== 'number' ||
        !Number.isSafeInteger(row.rowNumber) ||
        row.rowNumber < 1 ||
        rowNumbers.has(row.rowNumber) ||
        !isObject(row.values) ||
        Object.keys(row.values).length > 80 ||
        !Object.values(row.values).every(
          (cell) => typeof cell === 'string' && cell.length <= 10_000,
        )
      )
        return false;
      rowNumbers.add(row.rowNumber);
      return true;
    }) &&
    (value.selectedRowNumbers === undefined ||
      (Array.isArray(value.selectedRowNumbers) &&
        value.selectedRowNumbers.every((row) => typeof row === 'number'))) &&
    (value.ignoredRowNumbers === undefined ||
      (Array.isArray(value.ignoredRowNumbers) &&
        value.ignoredRowNumbers.every((row) => typeof row === 'number'))) &&
    (value.conflictChoices === undefined ||
      (isObject(value.conflictChoices) &&
        Object.values(value.conflictChoices).every(
          (row) => typeof row === 'number',
        ))) &&
    (value.saveMappingAs === undefined ||
      typeof value.saveMappingAs === 'string') &&
    Object.values(value.mapping).every(
      (column) => column === undefined || typeof column === 'string',
    ) &&
    Object.values(value.jobMatches).every(
      (levelId) => levelId === null || typeof levelId === 'string',
    ) &&
    (value.previewFingerprint === undefined ||
      typeof value.previewFingerprint === 'string')
  );
}

async function contextFor(db: AppDatabase, scope: SurveyImportScope) {
  const [organization, market, levels, existing] = await Promise.all([
    db
      .prepare(
        'SELECT currency, workspace_revision FROM organizations WHERE id = ? LIMIT 1',
      )
      .bind(scope.organizationId)
      .first<{ currency: string; workspace_revision: number }>(),
    db
      .prepare(
        'SELECT id, name FROM labor_markets WHERE id = ? AND organization_id = ? LIMIT 1',
      )
      .bind(scope.marketId, scope.organizationId)
      .first<DatabaseRow>(),
    db
      .prepare(`SELECT levels.id, COALESCE(levels.code, levels.name) AS code, levels.name
      FROM levels JOIN career_ladders ON career_ladders.id = levels.career_ladder_id
      JOIN disciplines ON disciplines.id = career_ladders.discipline_id
      WHERE disciplines.organization_id = ? AND levels.is_retired = 0 ORDER BY levels.id`)
      .bind(scope.organizationId)
      .all<DatabaseRow>(),
    scope.datasetId
      ? db
          .prepare(`SELECT mc.level_id AS "levelId", mc.p25, mc.p50, mc.p75
      FROM market_compensation mc JOIN market_datasets d ON d.id = mc.dataset_id
      WHERE d.id = ? AND d.labor_market_id = ? ORDER BY mc.level_id`)
          .bind(scope.datasetId, scope.marketId)
          .all<DatabaseRow>()
      : Promise.resolve({ results: [] as DatabaseRow[] }),
  ]);
  return {
    organization,
    market,
    levels: levels.results,
    existing: existing.results,
  };
}

export async function GET(request: Request) {
  const unauthorized = authorizeApiRequest(request, runtimeEnv);
  if (unauthorized) return unauthorized;
  const db = await getDb();
  const organizationId = new URL(request.url).searchParams
    .get('organizationId')
    ?.trim();
  if (!organizationId) return badRequest('organizationId is required.');
  const planning = await loadPlanningState(db, organizationId);
  if (
    !planningRoleFor(
      planning,
      planningActor(request, runtimeEnv.WORKFORCE_COMPASS_TRUSTED_USER_HEADER),
    )
  )
    return Response.json(
      { error: 'This identity is not a workspace member.' },
      { status: 403 },
    );
  const rows = await db
    .prepare(
      'SELECT name, mapping_json FROM survey_import_mappings WHERE organization_id = ? ORDER BY name',
    )
    .bind(organizationId)
    .all<DatabaseRow>();
  return Response.json({
    mappings: rows.results.flatMap((row) => {
      try {
        return [
          {
            name: String(row.name),
            ...(JSON.parse(String(row.mapping_json)) as SurveyMappingRecord),
          },
        ];
      } catch {
        return [];
      }
    }),
  });
}

export async function POST(request: Request) {
  const unauthorized = authorizeApiRequest(request, runtimeEnv);
  if (unauthorized) return unauthorized;
  const db = await getDb();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('The request body must be valid JSON.');
  }
  if (!validBody(body))
    return badRequest('A valid survey import payload is required.');
  const { scope } = body;
  if (
    !scope.organizationId.trim() ||
    !scope.marketId.trim() ||
    !/^[A-Z]{3}$/i.test(scope.currency) ||
    !scope.datasetName.trim() ||
    !scope.source.trim() ||
    !isoDate(scope.effectiveDate)
  )
    return badRequest(
      'Choose a market, three-letter currency, dataset name, source, and valid effective date.',
    );
  if (body.rows.length > 5000 || JSON.stringify(body).length > 4_000_000)
    return badRequest('Survey imports are limited to 5,000 rows and 4 MB.');
  const planning = await loadPlanningState(db, scope.organizationId);
  const role = planningRoleFor(
    planning,
    planningActor(request, runtimeEnv.WORKFORCE_COMPASS_TRUSTED_USER_HEADER),
  );
  if (!role)
    return Response.json(
      { error: 'This identity is not a workspace member.' },
      { status: 403 },
    );
  if (body.action === 'apply' && !canEditPlanning(role))
    return Response.json(
      { error: 'Analyst or admin access is required.' },
      { status: 403 },
    );
  const context = await contextFor(db, scope);
  if (!context.market || !context.organization)
    return badRequest(
      'The selected labor market does not belong to this organization.',
    );
  if (
    String(context.organization.currency).toUpperCase() !==
    scope.currency.toUpperCase()
  )
    return badRequest(
      `Survey currency must match the organization currency (${context.organization.currency}).`,
    );
  if (scope.datasetId) {
    const dataset = await db
      .prepare(
        'SELECT id FROM market_datasets WHERE id = ? AND labor_market_id = ?',
      )
      .bind(scope.datasetId, scope.marketId)
      .first();
    if (!dataset)
      return badRequest('The selected dataset is not in this labor market.');
  } else {
    const duplicate = await db
      .prepare(
        'SELECT id FROM market_datasets WHERE labor_market_id = ? AND name = ? AND source = ? AND effective_date = ? LIMIT 1',
      )
      .bind(
        scope.marketId,
        scope.datasetName.trim(),
        scope.source.trim(),
        scope.effectiveDate,
      )
      .first();
    if (duplicate)
      return Response.json(
        {
          error:
            'A dataset with this name, source, and effective date already exists. Select it before reimporting.',
        },
        { status: 409 },
      );
  }
  const preview = previewSurveyImport({
    rows: body.rows,
    mapping: body.mapping,
    jobMatches: body.jobMatches,
    currency: scope.currency,
    marketName: scope.sourceMarketLabel?.trim() || String(context.market.name),
    levels: context.levels.map((level) => ({
      id: String(level.id),
      code: String(level.code),
      name: String(level.name),
    })),
    existing: context.existing.map((row) => ({
      levelId: String(row.levelId),
      p25: row.p25 === null ? null : Number(row.p25),
      p50: Number(row.p50),
      p75: row.p75 === null ? null : Number(row.p75),
    })),
  });
  const reviewedState = JSON.stringify({
    review: {
      scope,
      rows: body.rows,
      mapping: body.mapping,
      jobMatches: body.jobMatches,
      saveMappingAs: body.saveMappingAs ?? '',
    },
    existing: context.existing,
    levels: context.levels,
    revision: Number(context.organization.workspace_revision ?? 0),
  });
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(reviewedState),
  );
  const previewFingerprint = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  if (body.action === 'preview')
    return Response.json({ preview, previewFingerprint });
  if (
    !body.previewFingerprint ||
    body.previewFingerprint !== previewFingerprint
  )
    return Response.json(
      {
        error:
          'This preview is stale. Review the import again before applying changes.',
      },
      { status: 409 },
    );
  const requested = new Set(body.selectedRowNumbers ?? []);
  const ignored = new Set(body.ignoredRowNumbers ?? []);
  const selected = preview.rows.filter((row) => requested.has(row.rowNumber));
  if (
    selected.length !== requested.size ||
    selected.some((row) => ignored.has(row.rowNumber))
  ) {
    return badRequest('Select only rows in the reviewed import.');
  }
  const unresolved = preview.rows.filter(
    (row) =>
      (row.requiresReview || row.action === 'conflict') &&
      !ignored.has(row.rowNumber) &&
      !requested.has(row.rowNumber),
  );
  if (unresolved.length)
    return badRequest(
      'Explicitly skip or resolve every unmatched, invalid, or conflicting row before applying.',
    );
  if (selected.some((row) => row.action === 'skip'))
    return badRequest('Skipped rows must be explicitly ignored, not applied.');
  if (
    selected.some(
      (row) =>
        row.action === 'conflict' &&
        body.conflictChoices?.[row.levelId ?? ''] !== row.rowNumber,
    )
  )
    return badRequest(
      'Choose exactly one incoming row for each conflict, or explicitly skip it.',
    );
  if (
    selected.some(
      (row) =>
        row.action === 'unchanged' || row.resolutionAction === 'unchanged',
    )
  )
    return badRequest(
      'Unchanged rows cannot be applied. Remove them from the checked preview.',
    );
  if (!selected.length)
    return Response.json({
      datasetId: scope.datasetId ?? null,
      preview,
      applied: 0,
      unchanged: true,
    });
  const datasetId = scope.datasetId || crypto.randomUUID();
  const statements: DatabaseStatement[] = [
    // A stale revision raises a constraint violation inside the transaction.
    db
      .prepare(
        'UPDATE organizations SET workspace_revision = CASE WHEN workspace_revision = ? THEN workspace_revision ELSE NULL END WHERE id = ?',
      )
      .bind(
        Number(context.organization.workspace_revision ?? 0),
        scope.organizationId,
      ),
  ];
  if (!scope.datasetId)
    statements.push(
      db
        .prepare(
          'INSERT INTO market_datasets (id, labor_market_id, name, effective_date, source, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        )
        .bind(
          datasetId,
          scope.marketId,
          scope.datasetName.trim(),
          scope.effectiveDate,
          scope.source.trim(),
        ),
    );
  else
    statements.push(
      db
        .prepare(
          'UPDATE market_datasets SET name = ?, effective_date = ?, source = ? WHERE id = ? AND labor_market_id = ?',
        )
        .bind(
          scope.datasetName.trim(),
          scope.effectiveDate,
          scope.source.trim(),
          datasetId,
          scope.marketId,
        ),
    );
  statements.push(
    db
      .prepare(`INSERT INTO market_compensation (id, dataset_id, discipline_id, career_ladder_id, level_id, p25, p50, p75)
    SELECT incoming.id, ?, d.id, l.career_ladder_id, l.id, incoming.p25, incoming.p50, incoming.p75
    FROM jsonb_to_recordset(CAST(? AS jsonb)) AS incoming(id text, level_id text, p25 double precision, p50 double precision, p75 double precision)
    JOIN levels l ON l.id = incoming.level_id
    JOIN career_ladders cl ON cl.id = l.career_ladder_id
    JOIN disciplines d ON d.id = cl.discipline_id
    WHERE d.organization_id = ? AND l.is_retired = 0
    ON CONFLICT(dataset_id, discipline_id, career_ladder_id, level_id) DO UPDATE SET p25 = excluded.p25, p50 = excluded.p50, p75 = excluded.p75`)
      .bind(
        datasetId,
        JSON.stringify(
          selected.map(({ levelId, p25, p50, p75 }) => ({
            id: crypto.randomUUID(),
            level_id: levelId,
            p25,
            p50,
            p75,
          })),
        ),
        scope.organizationId,
      ),
  );
  if (body.saveMappingAs?.trim())
    statements.push(
      db
        .prepare(
          'INSERT INTO survey_import_mappings (organization_id, name, mapping_json) VALUES (?, ?, ?) ON CONFLICT(organization_id, name) DO UPDATE SET mapping_json = excluded.mapping_json',
        )
        .bind(
          scope.organizationId,
          body.saveMappingAs.trim(),
          JSON.stringify({
            columns: body.mapping,
            jobMatches: body.jobMatches,
          } satisfies SurveyMappingRecord),
        ),
    );
  statements.push(
    db
      .prepare(
        'INSERT INTO audit_events (id, organization_id, actor, action, entity_type, entity_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        crypto.randomUUID(),
        scope.organizationId,
        planningActor(
          request,
          runtimeEnv.WORKFORCE_COMPASS_TRUSTED_USER_HEADER,
        ),
        'survey_import.applied',
        'market_dataset',
        datasetId,
        JSON.stringify({ rows: selected.length, source: scope.source.trim() }),
        new Date().toISOString(),
      ),
  );
  try {
    await db.batch(statements);
  } catch (error) {
    if (isNotNullViolation(error, 'organizations', 'workspace_revision')) {
      return Response.json(
        {
          error:
            'This preview is stale. Review the import again before applying changes.',
        },
        { status: 409 },
      );
    }
    throw error;
  }
  return Response.json({ datasetId, preview, applied: selected.length });
}
