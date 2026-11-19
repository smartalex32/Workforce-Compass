'use client';

import readXlsxFile, { readSheetNames } from 'read-excel-file';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { OfficeWorkspaceData } from '@/lib/office-workspace';
import {
  guessSurveyColumns,
  surveyRowKey,
  type SurveyColumn,
  type SurveyColumnMapping,
  type SurveyInputRow,
  type SurveyJobMatch,
  type SurveyMappingRecord,
  type SurveyPreview,
} from '@/lib/survey-import';
import { parseCsv } from '@/lib/workforce-planning';

type Sheet = { name: string; rows: string[][] };
type SavedMapping = SurveyMappingRecord & { name: string };
type PreviewResponse = { preview: SurveyPreview; previewFingerprint: string };
type ApplyResponse = {
  datasetId?: string | null;
  applied?: number;
  unchanged?: boolean;
};
const fields: Array<[SurveyColumn, string]> = [
  ['jobCode', 'Survey job code'],
  ['job', 'Survey job'],
  ['surveyLevel', 'Survey level or grade'],
  ['p25', 'P25'],
  ['p50', 'Median (P50)'],
  ['p75', 'P75'],
  ['currency', 'Currency'],
  ['market', 'Market'],
  ['payBasis', 'Pay basis'],
];

function sheetHeaders(row: string[] = []) {
  const used = new Set<string>();
  return row.map((value, index) => {
    const title = value.trim() || `Column ${index + 1}`;
    let header = title;
    while (used.has(header)) header += ` (column ${index + 1})`;
    used.add(header);
    return header;
  });
}

function detectHeader(rows: string[][]) {
  let best = { index: 0, score: 0 };
  rows.slice(0, 30).forEach((row, index) => {
    const guess = guessSurveyColumns(sheetHeaders(row));
    const score =
      Number(Boolean(guess.p50)) * 4 +
      Number(Boolean(guess.job || guess.jobCode)) * 4 +
      Object.values(guess).filter(Boolean).length;
    if (score > best.score) best = { index, score };
  });
  return best;
}

export function OfficeMarketData({
  workspace,
  canEdit,
  officeMarketId,
  onRefresh,
}: {
  workspace: OfficeWorkspaceData;
  canEdit: boolean;
  officeMarketId: string | null;
  onRefresh: () => Promise<void>;
}) {
  const [destinationMarketId, setDestinationMarketId] = useState('');
  const market =
    workspace.markets.find(
      (candidate) =>
        candidate.id ===
        (destinationMarketId || officeMarketId || workspace.markets[0]?.id),
    ) ?? null;
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [mapping, setMapping] = useState<SurveyColumnMapping>({});
  const [matches, setMatches] = useState<SurveyJobMatch>({});
  const [preview, setPreview] = useState<SurveyPreview | null>(null);
  const [previewFingerprint, setPreviewFingerprint] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [ignored, setIgnored] = useState<Set<number>>(new Set());
  const [conflictChoices, setConflictChoices] = useState<
    Record<string, number>
  >({});
  const [mappings, setMappings] = useState<SavedMapping[]>([]);
  const [datasetId, setDatasetId] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [source, setSource] = useState('');
  const [sourceMarketLabel, setSourceMarketLabel] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [saveMappingAs, setSaveMappingAs] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const unresolved =
    preview?.rows.filter(
      (row) =>
        (row.requiresReview || row.action === 'conflict') &&
        !selected.has(row.rowNumber) &&
        !ignored.has(row.rowNumber),
    ) ?? [];
  const pay = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const currentSheet = sheets[sheetIndex];
  const headers = useMemo(
    () => sheetHeaders(currentSheet?.rows[headerIndex]),
    [currentSheet, headerIndex],
  );
  const rows: SurveyInputRow[] = useMemo(
    () =>
      currentSheet
        ? currentSheet.rows
            .slice(headerIndex + 1)
            .map((row, index) => ({
              rowNumber: headerIndex + index + 2,
              hasValues: row.some((cell) => cell.trim()),
              values: Object.fromEntries(
                headers.map((header, position) => [
                  header,
                  row[position] ?? '',
                ]),
              ),
            }))
            .filter((row) => row.hasValues)
            .map(({ rowNumber, values }) => ({ rowNumber, values }))
        : [],
    [currentSheet, headerIndex, headers],
  );
  const levels = workspace.levels.filter((level) => !level.retired);
  const levelGroups = workspace.ladders
    .map((ladder) => {
      const family = workspace.disciplines.find(
        (item) => item.id === ladder.disciplineId,
      );
      return {
        id: ladder.id,
        label: [family?.name, ladder.name].filter(Boolean).join(' · '),
        levels: levels.filter((level) => level.ladderId === ladder.id),
      };
    })
    .filter((group) => group.levels.length > 0);
  const mappingRows = useMemo(() => {
    const seen = new Set<string>();
    return rows.filter((row) => {
      const key = surveyRowKey(row.values, mapping, row.rowNumber);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [mapping, rows]);
  const datasets = workspace.datasets.filter(
    (dataset) => dataset.laborMarketId === market?.id,
  );

  useEffect(() => {
    if (!canEdit || !workspace.organization.id) {
      queueMicrotask(() => setMappings([]));
      return;
    }
    fetch(
      `/api/survey-import?organizationId=${encodeURIComponent(workspace.organization.id)}`,
    )
      .then((response) => (response.ok ? response.json() : { mappings: [] }))
      .then((data: unknown) =>
        setMappings(
          data &&
            typeof data === 'object' &&
            Array.isArray((data as { mappings?: unknown }).mappings)
            ? (data as { mappings: SavedMapping[] }).mappings
            : [],
        ),
      )
      .catch(() => setMappings([]));
  }, [canEdit, workspace.organization.id]);

  async function loadFile(file: File) {
    setMessage('');
    setPreview(null);
    setSheets([]);
    setMatches({});
    try {
      const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
      const parsed: Sheet[] = isCsv
        ? [
            {
              name: 'CSV',
              rows: parseCsv(await file.text(), { includeBlankRows: true }),
            },
          ]
        : await (async () => {
            const available = await readSheetNames(file);
            return Promise.all(
              available.map(async (name) => ({
                name,
                rows: (await readXlsxFile(file, { sheet: name })).map((row) =>
                  row.map((value) =>
                    value instanceof Date
                      ? value.toISOString().slice(0, 10)
                      : String(value ?? '').trim(),
                  ),
                ),
              })),
            );
          })();
      if (!parsed.length)
        throw new Error('No readable worksheet rows were found.');
      setSheets(parsed);
      const bestSheet = parsed.reduce(
        (best, sheet, index) =>
          detectHeader(sheet.rows).score > detectHeader(parsed[best].rows).score
            ? index
            : best,
        0,
      );
      setSheetIndex(bestSheet);
      selectHeader(
        parsed[bestSheet],
        detectHeader(parsed[bestSheet].rows).index,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'This file could not be read.',
      );
    }
  }

  function selectHeader(sheet: Sheet, index: number) {
    setHeaderIndex(index);
    setMapping(guessSurveyColumns(sheetHeaders(sheet.rows[index])));
    setMatches({});
  }

  function payload(action: 'preview' | 'apply') {
    if (!market) throw new Error('Choose an office with a labor market first.');
    const mappedHeaders = new Set(
      Object.values(mapping).filter((header): header is string =>
        Boolean(header),
      ),
    );
    return {
      action,
      scope: {
        organizationId: workspace.organization.id,
        marketId: market.id,
        currency: workspace.organization.currency,
        datasetId: datasetId || null,
        datasetName: datasetName.trim(),
        source: source.trim(),
        sourceMarketLabel: sourceMarketLabel.trim() || undefined,
        effectiveDate,
      },
      rows: rows.map(({ rowNumber, values }) => ({
        rowNumber,
        values: Object.fromEntries(
          [...mappedHeaders].map((header) => [header, values[header] ?? '']),
        ),
      })),
      mapping,
      jobMatches: matches,
      saveMappingAs: saveMappingAs.trim() || undefined,
      ...(action === 'apply'
        ? {
            selectedRowNumbers: [...selected],
            ignoredRowNumbers: [...ignored],
            conflictChoices,
            previewFingerprint,
          }
        : {}),
    };
  }
  async function requestPreview() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/survey-import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload('preview')),
      });
      const data = (await response.json()) as PreviewResponse & {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || 'Preview failed.');
      setPreview(data.preview);
      setPreviewFingerprint(data.previewFingerprint);
      setSelected(
        new Set(
          data.preview.rows
            .filter(
              (row: SurveyPreview['rows'][number]) =>
                row.action === 'add' || row.action === 'update',
            )
            .map((row: SurveyPreview['rows'][number]) => row.rowNumber),
        ),
      );
      setIgnored(new Set());
      setConflictChoices({});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Preview failed.');
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/survey-import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload('apply')),
      });
      const data = (await response.json()) as ApplyResponse & {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || 'Import failed.');
      setMessage(
        data.unchanged
          ? 'No market-data rows were applied.'
          : `Applied ${data.applied} market-data row${data.applied === 1 ? '' : 's'}.`,
      );
      const savedName = saveMappingAs.trim();
      if (savedName && !data.unchanged) {
        setMappings((current) =>
          [
            ...current.filter((item) => item.name !== savedName),
            { name: savedName, columns: mapping, jobMatches: matches },
          ].sort((left, right) => left.name.localeCompare(right.name)),
        );
      }
      await onRefresh();
      closeWizard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  function chooseConflict(row: SurveyPreview['rows'][number]) {
    if (!preview || !row.levelId) return;
    const group = preview.rows.filter(
      (item) => item.action === 'conflict' && item.levelId === row.levelId,
    );
    const nextSelected = new Set(selected);
    const nextIgnored = new Set(ignored);
    for (const item of group) {
      nextSelected.delete(item.rowNumber);
      nextIgnored.add(item.rowNumber);
    }
    if (row.resolutionAction !== 'unchanged') {
      nextIgnored.delete(row.rowNumber);
      nextSelected.add(row.rowNumber);
    }
    setSelected(nextSelected);
    setIgnored(nextIgnored);
    setConflictChoices({ ...conflictChoices, [row.levelId]: row.rowNumber });
  }
  function applySavedMapping(saved: SavedMapping) {
    setMapping(saved.columns);
    setMatches(saved.jobMatches);
    setSaveMappingAs(saved.name);
    setPreview(null);
  }

  function closeWizard() {
    setDestinationMarketId('');
    setDatasetId('');
    setDatasetName('');
    setSource('');
    setSourceMarketLabel('');
    setEffectiveDate(new Date().toISOString().slice(0, 10));
    setSheets([]);
    setMapping({});
    setMatches({});
    setSaveMappingAs('');
    setPreview(null);
    setPreviewFingerprint('');
    setShowWizard(false);
  }

  if (!market)
    return (
      <section className="office-panel office-stack">
        <h2 className="office-heading">Market data</h2>
        <p className="office-muted">
          Assign this office to a labor market before importing survey data.
        </p>
      </section>
    );
  if (!showWizard)
    return (
      <section className="office-panel office-stack">
        <div className="office-heading">
          <div>
            <h1>Market Data</h1>
            <p className="office-muted">
              Purchased survey datasets and annual base-pay benchmarks.
            </p>
          </div>
          {canEdit && (
            <Button
              onClick={() => {
                setMessage('');
                setShowWizard(true);
              }}
            >
              Import survey
            </Button>
          )}
        </div>
        <div className="office-table-scroll">
          <table className="office-table">
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Labor market</th>
                <th>Source</th>
                <th>Effective date</th>
              </tr>
            </thead>
            <tbody>
              {workspace.datasets.length ? (
                workspace.datasets.map((dataset) => (
                  <tr key={dataset.id}>
                    <td>{dataset.name}</td>
                    <td>
                      {workspace.markets.find(
                        (item) => item.id === dataset.laborMarketId,
                      )?.name ?? '—'}
                    </td>
                    <td>{dataset.source ?? '—'}</td>
                    <td>{dataset.effectiveDate ?? '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="office-muted">
                    No survey datasets yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {message && (
          <p className="office-status" role="status">
            {message}
          </p>
        )}
        {!canEdit && (
          <p className="office-status">
            You can review market datasets. Analysts and administrators can
            import surveys.
          </p>
        )}
      </section>
    );
  return (
    <section className="office-panel office-stack">
      <div className="office-heading">
        <div>
          <h1>Import survey</h1>
          <p className="office-muted">
            Import annual base-pay benchmarks from a CSV or Excel workbook.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setMessage('');
            closeWizard();
          }}
        >
          Cancel import
        </Button>
      </div>
      {!canEdit && (
        <p className="office-status">
          You can review market data, but only analysts and administrators can
          import it.
        </p>
      )}
      {!preview && (
        <>
          <h2 className="office-heading">1. File and destination</h2>
          <div className="office-form-grid">
            <label>
              Destination labor market
              <select
                aria-label="Destination labor market"
                className="office-input"
                value={market.id}
                onChange={(event) => {
                  setDestinationMarketId(event.target.value);
                  setDatasetId('');
                  setPreview(null);
                  setPreviewFingerprint('');
                }}
                disabled={!canEdit}
              >
                {workspace.markets.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Dataset
              <select
                aria-label="Dataset"
                className="office-input"
                value={datasetId}
                onChange={(event) => {
                  const id = event.target.value;
                  setDatasetId(id);
                  const data = datasets.find((dataset) => dataset.id === id);
                  if (data) {
                    setDatasetName(data.name);
                    setSource(data.source ?? '');
                    setEffectiveDate(data.effectiveDate ?? effectiveDate);
                  }
                  setPreview(null);
                  setPreviewFingerprint('');
                }}
                disabled={!canEdit}
              >
                <option value="">New dataset (default)</option>
                {datasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Dataset name
              <Input
                className="office-input"
                value={datasetName}
                onChange={(event) => {
                  setDatasetName(event.target.value);
                  setPreview(null);
                  setPreviewFingerprint('');
                }}
                disabled={!canEdit}
                placeholder="2026 engineering survey"
              />
            </label>
            <label>
              Source
              <Input
                className="office-input"
                value={source}
                onChange={(event) => {
                  setSource(event.target.value);
                  setPreview(null);
                  setPreviewFingerprint('');
                }}
                disabled={!canEdit}
                placeholder="Purchased survey provider"
              />
            </label>
            <label>
              Source market label{' '}
              <span className="office-muted">· optional exact match</span>
              <Input
                className="office-input"
                value={sourceMarketLabel}
                onChange={(event) => {
                  setSourceMarketLabel(event.target.value);
                  setPreview(null);
                  setPreviewFingerprint('');
                }}
                disabled={!canEdit}
                placeholder={market.name}
              />
            </label>
            <label>
              Effective date
              <Input
                className="office-input"
                type="date"
                value={effectiveDate}
                onChange={(event) => {
                  setEffectiveDate(event.target.value);
                  setPreview(null);
                  setPreviewFingerprint('');
                }}
                disabled={!canEdit}
              />
            </label>
          </div>
          <div className="office-actions">
            <Input
              aria-label="Survey file"
              className="office-input"
              type="file"
              accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void loadFile(file);
              }}
              disabled={!canEdit}
            />
            {sheets.length > 1 && (
              <select
                aria-label="Worksheet"
                className="office-input"
                value={sheetIndex}
                onChange={(event) => {
                  const nextIndex = Number(event.target.value);
                  setSheetIndex(nextIndex);
                  selectHeader(
                    sheets[nextIndex],
                    detectHeader(sheets[nextIndex].rows).index,
                  );
                }}
              >
                {sheets.map((sheet, index) => (
                  <option key={sheet.name} value={index}>
                    {sheet.name}
                  </option>
                ))}
              </select>
            )}
            {sheets.length > 0 && (
              <label>
                Header row{' '}
                <select
                  aria-label="Header row"
                  className="office-input"
                  value={headerIndex}
                  onChange={(event) =>
                    selectHeader(currentSheet, Number(event.target.value))
                  }
                >
                  {currentSheet.rows.slice(0, 100).map((_, index) => (
                    <option key={index} value={index}>
                      Row {index + 1}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {headers.length > 0 && (
            <>
              <h2 className="office-heading">2. Map columns and jobs</h2>
              <div className="office-form-grid">
                {fields.map(([field, label]) => (
                  <label key={field}>
                    {label}
                    <select
                      aria-label={label}
                      className="office-input"
                      value={mapping[field] ?? ''}
                      onChange={(event) => {
                        setMapping({
                          ...mapping,
                          [field]: event.target.value || undefined,
                        });
                        setPreview(null);
                        setPreviewFingerprint('');
                      }}
                    >
                      <option value="">Not supplied</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className="office-actions">
                <select
                  aria-label="Saved import mapping"
                  className="office-input"
                  defaultValue=""
                  onChange={(event) => {
                    const saved = mappings.find(
                      (item) => item.name === event.target.value,
                    );
                    if (saved) applySavedMapping(saved);
                  }}
                >
                  <option value="">Use saved mapping…</option>
                  {mappings.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <Input
                  className="office-input"
                  value={saveMappingAs}
                  onChange={(event) => setSaveMappingAs(event.target.value)}
                  placeholder="Save mappings as (optional)"
                />
              </div>
              <div className="office-table-scroll">
                <table className="office-table">
                  <thead>
                    <tr>
                      <th>Survey job</th>
                      <th>Internal level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappingRows.map((row) => {
                      const job = surveyRowKey(
                        row.values,
                        mapping,
                        row.rowNumber,
                      );
                      return (
                        <tr key={row.rowNumber}>
                          <td>{job}</td>
                          <td>
                            <select
                              aria-label={`Internal level for ${job}`}
                              className="office-input"
                              value={matches[job] ?? ''}
                              onChange={(event) => {
                                setMatches({
                                  ...matches,
                                  [job]: event.target.value || null,
                                });
                                setPreview(null);
                                setPreviewFingerprint('');
                              }}
                            >
                              <option value="">Skip until matched</option>
                              {levelGroups.map((group) => (
                                <optgroup key={group.id} label={group.label}>
                                  {group.levels.map((level) => (
                                    <option key={level.id} value={level.id}>
                                      {level.code === level.name
                                        ? level.code
                                        : `${level.code} · ${level.name}`}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="office-actions">
                <Button
                  onClick={() => void requestPreview()}
                  disabled={
                    !canEdit ||
                    busy ||
                    (!mapping.job && !mapping.jobCode) ||
                    !mapping.p50 ||
                    !datasetName.trim() ||
                    !source.trim()
                  }
                >
                  Review import
                </Button>
              </div>
            </>
          )}
        </>
      )}
      {preview && (
        <>
          <h2 className="office-heading">3. Review changes</h2>
          <p className="office-muted">
            {datasetName} · {source} · Effective {effectiveDate} · {market.name}{' '}
            · {workspace.organization.currency}
          </p>
          <div className="office-status">
            {selected.size} to apply · {preview.unchanged} unchanged ·{' '}
            {unresolved.length} to review
          </div>
          {unresolved.length > 0 && (
            <div className="office-actions">
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  setIgnored(
                    new Set([
                      ...ignored,
                      ...unresolved.map((row) => row.rowNumber),
                    ]),
                  )
                }
              >
                Skip {unresolved.length} unresolved{' '}
                {unresolved.length === 1 ? 'row' : 'rows'}
              </Button>
            </div>
          )}
          <div className="office-table-scroll">
            <table className="office-table">
              <thead>
                <tr>
                  <th>Apply</th>
                  <th>Job</th>
                  <th>Level</th>
                  <th scope="col" className="office-number">
                    P25
                  </th>
                  <th scope="col" className="office-number">
                    P50
                  </th>
                  <th scope="col" className="office-number">
                    P75
                  </th>
                  {datasetId && (
                    <th scope="col" className="office-number">
                      Current P25 / P50 / P75
                    </th>
                  )}
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td>
                      <input
                        aria-label={`Apply row ${row.rowNumber}, ${row.job}`}
                        type="checkbox"
                        checked={selected.has(row.rowNumber)}
                        disabled={
                          row.action === 'skip' ||
                          row.action === 'unchanged' ||
                          row.action === 'conflict'
                        }
                        onChange={(event) => {
                          const next = new Set(selected);
                          if (event.target.checked) next.add(row.rowNumber);
                          else next.delete(row.rowNumber);
                          setSelected(next);
                        }}
                      />
                    </td>
                    <td>
                      <span className="office-muted">Row {row.rowNumber}</span>
                      <br />
                      {row.job}
                    </td>
                    <td>
                      {levels.find((level) => level.id === row.levelId)?.code ??
                        '—'}
                    </td>
                    <td className="office-number">
                      {row.p25 === null ? '—' : pay.format(row.p25)}
                    </td>
                    <td className="office-number">
                      {row.p50 === null ? '—' : pay.format(row.p50)}
                    </td>
                    <td className="office-number">
                      {row.p75 === null ? '—' : pay.format(row.p75)}
                    </td>
                    {datasetId && (
                      <td className="office-number">
                        {row.previous
                          ? [
                              row.previous.p25,
                              row.previous.p50,
                              row.previous.p75,
                            ]
                              .map((value) =>
                                value === null ? '—' : pay.format(value),
                              )
                              .join(' / ')
                          : '—'}
                      </td>
                    )}
                    <td>
                      {row.action === 'conflict' &&
                      row.levelId &&
                      conflictChoices[row.levelId] === row.rowNumber
                        ? row.resolutionAction === 'unchanged'
                          ? 'Keep current values'
                          : 'Selected for import'
                        : ignored.has(row.rowNumber)
                          ? 'Skipped'
                          : (row.reason ?? row.action)}
                      {(row.requiresReview || row.action === 'conflict') && (
                        <div className="office-actions">
                          {!ignored.has(row.rowNumber) && (
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              onClick={() => {
                                const next = new Set(ignored);
                                next.add(row.rowNumber);
                                setIgnored(next);
                                const selectedNext = new Set(selected);
                                selectedNext.delete(row.rowNumber);
                                setSelected(selectedNext);
                                if (
                                  row.levelId &&
                                  conflictChoices[row.levelId] === row.rowNumber
                                ) {
                                  const nextChoices = { ...conflictChoices };
                                  delete nextChoices[row.levelId];
                                  setConflictChoices(nextChoices);
                                }
                              }}
                            >
                              Skip row
                            </Button>
                          )}
                          {row.action === 'conflict' && row.levelId && (
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={() => chooseConflict(row)}
                            >
                              Use this row
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="office-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setPreviewFingerprint('');
                setMessage('');
              }}
            >
              Back to mapping
            </Button>
            <Button
              onClick={() => void apply()}
              disabled={!canEdit || busy || unresolved.length > 0}
            >
              {selected.size ? 'Apply checked rows' : 'Finish without applying'}
            </Button>
          </div>
        </>
      )}
      {message && (
        <p
          className={
            message.includes('failed') ||
            message.includes('required') ||
            message.includes('Resolve')
              ? 'office-error'
              : 'office-status'
          }
        >
          {message}
        </p>
      )}
    </section>
  );
}
