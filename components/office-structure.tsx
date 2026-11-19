'use client';

import { type SyntheticEvent, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  bandAt,
  effectivePayBand,
  utcDate,
  type BandValues,
  type OfficeLevel,
  type OfficeWorkspaceData,
  type OfficeWorkspaceSave,
} from '@/lib/office-workspace';

type StructureProps = {
  workspace: OfficeWorkspaceData;
  canEdit: boolean;
  officeMarketId: string | null;
  save: OfficeWorkspaceSave;
};

type LevelDraft = {
  id?: string;
  code: string;
  name: string;
  description: string;
  position: number;
};

type BandDraft = Record<string, { min: string; mid: string; max: string }>;

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function levelLabel(level: OfficeLevel) {
  return level.code === level.name
    ? level.code
    : `${level.code} · ${level.name}`;
}

export function OfficeJobLevels({ workspace, canEdit, save }: StructureProps) {
  const [disciplineId, setDisciplineId] = useState('');
  const [ladderId, setLadderId] = useState('');
  const [showNewLadder, setShowNewLadder] = useState(false);
  const [createNewFamily, setCreateNewFamily] = useState(false);
  const [newFamily, setNewFamily] = useState('Software Engineering');
  const [newLadderName, setNewLadderName] = useState('Individual contributor');
  const [template, setTemplate] = useState<'engineering' | 'blank'>(
    'engineering',
  );
  const [draft, setDraft] = useState<LevelDraft | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedDisciplineId = workspace.disciplines.some(
    (discipline) => discipline.id === disciplineId,
  )
    ? disciplineId
    : (workspace.disciplines[0]?.id ?? '');
  const ladders = useMemo(
    () =>
      workspace.ladders.filter(
        (ladder) => ladder.disciplineId === selectedDisciplineId,
      ),
    [selectedDisciplineId, workspace.ladders],
  );
  const selectedLadderId = ladders.some((ladder) => ladder.id === ladderId)
    ? ladderId
    : (ladders[0]?.id ?? '');
  const levels = useMemo(
    () =>
      workspace.levels
        .filter((level) => level.ladderId === selectedLadderId)
        .sort((left, right) => left.order - right.order),
    [selectedLadderId, workspace.levels],
  );
  const selectedDiscipline = workspace.disciplines.find(
    (discipline) => discipline.id === selectedDisciplineId,
  );
  const selectedLadder = ladders.find(
    (ladder) => ladder.id === selectedLadderId,
  );

  const beginLevel = (level?: OfficeLevel) => {
    setError('');
    setStatus('');
    setDraft(
      level
        ? {
            id: level.id,
            code: level.code,
            name: level.name,
            description: level.description ?? '',
            position: level.order,
          }
        : { code: '', name: '', description: '', position: levels.length + 1 },
    );
  };

  const saveLadder = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newLadderName.trim()) {
      setError('Enter a ladder name.');
      return;
    }
    if ((createNewFamily || !selectedDisciplineId) && !newFamily.trim()) {
      setError('Enter a job family before creating its first ladder.');
      return;
    }
    setSaving(true);
    setError('');
    const ok = await save({
      action: 'ladder',
      ...(!createNewFamily && selectedDisciplineId
        ? { disciplineId: selectedDisciplineId }
        : { disciplineName: newFamily.trim() }),
      name: newLadderName.trim(),
      template,
    });
    setSaving(false);
    if (ok) {
      setShowNewLadder(false);
      setStatus(
        template === 'engineering'
          ? 'Engineering L1–L6 starter ladder created.'
          : 'Blank ladder created.',
      );
    } else {
      setError('Could not create this ladder. Check the name and try again.');
    }
  };

  const saveLevel = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || !selectedLadderId) return;
    if (!draft.code.trim() || !draft.name.trim()) {
      setError('Enter a level code and display name.');
      return;
    }
    if (
      !Number.isInteger(draft.position) ||
      draft.position < 1 ||
      draft.position > levels.length + (draft.id ? 0 : 1)
    ) {
      setError('Choose a valid position in this ladder.');
      return;
    }
    setSaving(true);
    setError('');
    const ok = await save({
      action: 'level',
      ladderId: selectedLadderId,
      ...(draft.id ? { id: draft.id } : {}),
      code: draft.code.trim(),
      name: draft.name.trim(),
      ...(draft.description.trim()
        ? { description: draft.description.trim() }
        : {}),
      position: draft.position,
    });
    setSaving(false);
    if (ok) {
      setDraft(null);
      setStatus(`${draft.code.trim()} saved.`);
    } else {
      setError(
        'Could not save this level. Codes must be unique within a ladder.',
      );
    }
  };

  const changeLevelStatus = async (
    action: 'retire-level' | 'delete-level',
    level: OfficeLevel,
  ) => {
    setSaving(true);
    setError('');
    const ok = await save({ action, id: level.id });
    setSaving(false);
    if (ok) {
      setStatus(
        action === 'retire-level'
          ? `${level.code} retired. Existing assignments and history remain visible.`
          : `${level.code} deleted.`,
      );
    } else {
      setError(
        action === 'delete-level'
          ? 'This level is still in use and cannot be deleted. Retire it instead.'
          : 'Could not retire this level.',
      );
    }
  };

  return (
    <div className="office-stack">
      <div className="office-stack">
        <div className="office-heading">
          <div>
            <h1>Job Levels</h1>
            <p className="office-muted">
              Shared company structure by job family. Offices use the same
              levels.
            </p>
          </div>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => {
                setShowNewLadder(true);
                setDraft(null);
              }}
            >
              New ladder
            </Button>
          )}
        </div>
        {workspace.disciplines.length > 0 && (
          <div className="office-panel office-panel-pad office-form-grid">
            <label>
              Job family
              <select
                className="office-input"
                value={selectedDisciplineId}
                onChange={(event) => {
                  setDisciplineId(event.target.value);
                  setLadderId('');
                  setDraft(null);
                }}
                disabled={!workspace.disciplines.length}
              >
                {workspace.disciplines.map((discipline) => (
                  <option key={discipline.id} value={discipline.id}>
                    {discipline.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ladder
              <select
                className="office-input"
                value={selectedLadderId}
                onChange={(event) => {
                  setLadderId(event.target.value);
                  setDraft(null);
                }}
                disabled={!ladders.length}
              >
                {ladders.map((ladder) => (
                  <option key={ladder.id} value={ladder.id}>
                    {ladder.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {showNewLadder && canEdit && (
        <form className="office-panel office-stack" onSubmit={saveLadder}>
          <div className="office-heading">
            <h2>New ladder</h2>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => setShowNewLadder(false)}
            >
              Cancel
            </Button>
          </div>
          <p className="office-muted">
            Choose the editable L1–L6 engineering starter, or begin with a blank
            ladder. A managerial ladder can live alongside an
            individual-contributor ladder.
          </p>
          <div className="office-form-grid">
            {selectedDisciplineId && (
              <label>
                Add to
                <select
                  className="office-input"
                  value={createNewFamily ? 'new' : 'current'}
                  onChange={(event) =>
                    setCreateNewFamily(event.target.value === 'new')
                  }
                >
                  <option value="current">
                    {selectedDiscipline?.name ?? 'Selected job family'}
                  </option>
                  <option value="new">New job family</option>
                </select>
              </label>
            )}
            {(createNewFamily || !selectedDisciplineId) && (
              <label>
                Job family
                <Input
                  className="office-input"
                  value={newFamily}
                  onChange={(event) => setNewFamily(event.target.value)}
                />
              </label>
            )}
            <label>
              Ladder name
              <Input
                className="office-input"
                value={newLadderName}
                onChange={(event) => setNewLadderName(event.target.value)}
                placeholder="e.g. Management"
              />
            </label>
            <label>
              Starting point
              <select
                className="office-input"
                value={template}
                onChange={(event) =>
                  setTemplate(event.target.value as 'engineering' | 'blank')
                }
              >
                <option value="engineering">Engineering starter (L1–L6)</option>
                <option value="blank">Blank ladder</option>
              </select>
            </label>
          </div>
          <div className="office-actions">
            <Button disabled={saving} type="submit">
              Create ladder
            </Button>
          </div>
        </form>
      )}

      {draft && canEdit && (
        <form className="office-panel office-stack" onSubmit={saveLevel}>
          <div className="office-heading">
            <h2>{draft.id ? 'Edit level' : 'Add level'}</h2>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
          </div>
          <p className="office-muted">
            Renaming, recoding, or reordering preserves assignments and pay
            history. Create a new level for a materially different role, then
            explicitly reassign people.
          </p>
          <div className="office-form-grid">
            <label>
              Level code
              <Input
                className="office-input"
                value={draft.code}
                onChange={(event) =>
                  setDraft({ ...draft, code: event.target.value })
                }
                maxLength={12}
                placeholder="e.g. L7"
              />
            </label>
            <label>
              Display name
              <Input
                className="office-input"
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                maxLength={45}
              />
            </label>
            <label>
              Position
              <Input
                className="office-input"
                type="number"
                min="1"
                max={levels.length + (draft.id ? 0 : 1)}
                value={draft.position}
                onChange={(event) =>
                  setDraft({ ...draft, position: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Expectations <span className="office-muted">· optional</span>
              <Input
                className="office-input"
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
                maxLength={200}
              />
            </label>
          </div>
          <div className="office-actions">
            <Button disabled={saving} type="submit">
              Save level
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p className="office-error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="office-status" role="status">
          {status}
        </p>
      )}

      <section className="office-panel office-panel-pad office-stack">
        <div className="office-heading">
          <h2>
            {selectedLadder
              ? `${selectedLadder.name} levels`
              : 'Set up a ladder'}
          </h2>
          {canEdit && selectedLadderId && (
            <Button size="sm" variant="outline" onClick={() => beginLevel()}>
              Add level
            </Button>
          )}
        </div>
        {!selectedLadderId ? (
          <p className="office-muted">
            Create a job family and its first ladder to begin defining levels.
          </p>
        ) : (
          <div className="office-table-scroll">
            <table className="office-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Level</th>
                  <th>Expectations</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((level) => (
                  <tr key={level.id}>
                    <td>{level.order}</td>
                    <th scope="row">{levelLabel(level)}</th>
                    <td>{level.description || '—'}</td>
                    <td>
                      <span className="office-status">
                        {level.retired ? 'Retired' : 'Active'}
                      </span>
                    </td>
                    <td className="office-actions">
                      {canEdit && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => beginLevel(level)}
                        >
                          Edit
                        </Button>
                      )}
                      {canEdit && !level.retired && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            changeLevelStatus('retire-level', level)
                          }
                          disabled={saving}
                        >
                          Retire
                        </Button>
                      )}
                      {canEdit && level.retired && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            changeLevelStatus('delete-level', level)
                          }
                          disabled={saving}
                        >
                          Delete
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!levels.length && (
                  <tr>
                    <td colSpan={5} className="office-muted">
                      No levels yet. Add the first level to this ladder.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function OfficePayBands({
  workspace,
  canEdit,
  officeMarketId,
  save,
}: StructureProps) {
  const [scope, setScope] = useState<'effective' | 'company' | 'override'>(
    'effective',
  );
  const [asOf, setAsOf] = useState(utcDate());
  const [editing, setEditing] = useState(false);
  const [reviewRows, setReviewRows] = useState<BandValues[]>([]);
  const reviewing = reviewRows.length > 0;
  const [draftScope, setDraftScope] = useState<'company' | 'override'>(
    'company',
  );
  const [effectiveDate, setEffectiveDate] = useState(utcDate());
  const [draft, setDraft] = useState<BandDraft>({});
  const [changed, setChanged] = useState<string[]>([]);
  const [endLevelId, setEndLevelId] = useState('');
  const [endDate, setEndDate] = useState(utcDate());
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const market = workspace.markets.find((item) => item.id === officeMarketId);
  const levels = useMemo(
    () => [...workspace.levels].sort((left, right) => left.order - right.order),
    [workspace.levels],
  );
  const ladderLabel = (ladderId: string) => {
    if (workspace.ladders.length < 2) return '';
    const ladder = workspace.ladders.find((item) => item.id === ladderId);
    const family = workspace.disciplines.find(
      (item) => item.id === ladder?.disciplineId,
    );
    return [family?.name, ladder?.name].filter(Boolean).join(' · ');
  };
  const bandLevel = (level: OfficeLevel) => (
    <>
      {levelLabel(level)}
      {ladderLabel(level.ladderId) && (
        <small className="office-muted office-level-context">
          {ladderLabel(level.ladderId)}
        </small>
      )}
    </>
  );
  const displayBand = (levelId: string) =>
    scope === 'effective'
      ? effectivePayBand(workspace.bands, levelId, officeMarketId, asOf)
      : bandAt(
          workspace.bands,
          levelId,
          scope === 'company' ? null : officeMarketId,
          asOf,
        );
  const overrideRows = levels.filter((level) =>
    Boolean(
      officeMarketId &&
      bandAt(workspace.bands, level.id, officeMarketId, asOf)?.values,
    ),
  );

  const startDraft = (nextScope: 'company' | 'override', date: string) => {
    const next: BandDraft = {};
    for (const level of levels.filter((level) => !level.retired)) {
      const values = bandAt(
        workspace.bands,
        level.id,
        nextScope === 'override' ? officeMarketId : null,
        date,
      )?.values;
      next[level.id] = {
        min: values?.min?.toString() ?? '',
        mid: values?.mid?.toString() ?? '',
        max: values?.max?.toString() ?? '',
      };
    }
    setDraftScope(nextScope);
    setEffectiveDate(date);
    setDraft(next);
    setChanged([]);
    setEditing(true);
    setReviewRows([]);
    setError('');
    setStatus('');
  };
  const startEditing = () =>
    startDraft(
      scope === 'override' && officeMarketId ? 'override' : 'company',
      asOf,
    );

  const changedRows = (): BandValues[] | null => {
    const rows: BandValues[] = [];
    for (const level of levels.filter(
      (item) => !item.retired && changed.includes(item.id),
    )) {
      const values = draft[level.id] ?? { min: '', mid: '', max: '' };
      const empty =
        !values.min.trim() && !values.mid.trim() && !values.max.trim();
      if (empty) continue;
      const min = Number(values.min);
      const max = Number(values.max);
      const mid = values.mid.trim() ? Number(values.mid) : null;
      if (
        !Number.isFinite(min) ||
        !Number.isFinite(max) ||
        min <= 0 ||
        max <= 0 ||
        min > max ||
        (mid !== null && (!Number.isFinite(mid) || mid < min || mid > max))
      ) {
        setError(
          `Check ${level.code}. Enter a minimum and maximum, with an optional midpoint inside the range.`,
        );
        return null;
      }
      const previous = bandAt(
        workspace.bands,
        level.id,
        draftScope === 'override' ? officeMarketId : null,
        effectiveDate,
      )?.values;
      if (
        !previous ||
        previous.min !== min ||
        previous.mid !== mid ||
        previous.max !== max
      )
        rows.push({ levelId: level.id, min, mid, max });
    }
    return rows;
  };

  const review = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!effectiveDate) {
      setError('Choose an effective date.');
      return;
    }
    const rows = changedRows();
    if (!rows) return;
    if (!rows.length) {
      setError('Change at least one pay band before reviewing.');
      return;
    }
    setReviewRows(rows);
  };

  const publish = async () => {
    const rows = reviewRows;
    if (!rows.length) return;
    setSaving(true);
    setError('');
    const ok = await save({
      action: 'publish-bands',
      marketId: draftScope === 'override' ? officeMarketId : null,
      date: effectiveDate,
      rows,
    });
    setSaving(false);
    if (ok) {
      setEditing(false);
      setReviewRows([]);
      setStatus(
        `${rows.length} ${rows.length === 1 ? 'pay band' : 'pay bands'} published.`,
      );
    } else setError('Could not publish these pay bands.');
  };

  const endOverride = async () => {
    if (!officeMarketId || !endLevelId || !endDate) return;
    setSaving(true);
    setError('');
    const ok = await save({
      action: 'end-band-override',
      marketId: officeMarketId,
      levelId: endLevelId,
      date: endDate,
    });
    setSaving(false);
    if (ok) {
      setEndLevelId('');
      setStatus(
        'Geography override ended. The level now follows its company band from that date.',
      );
    } else setError('Could not end this geography override.');
  };

  const scopeLabel =
    draftScope === 'override'
      ? `${market?.name ?? 'Office market'} override`
      : 'Company bands';

  return (
    <div className="office-stack">
      <div className="office-heading">
        <div>
          <h1>Pay Bands</h1>
          <p className="office-muted">
            Annual base salary · {workspace.organization.currency}
          </p>
        </div>
        {canEdit && levels.some((level) => !level.retired) && (
          <Button size="sm" onClick={startEditing}>
            Edit pay bands
          </Button>
        )}
      </div>
      <section className="office-panel">
        <div className="office-panel-pad office-form-grid">
          <label>
            Band scope
            <select
              className="office-input"
              value={scope}
              onChange={(event) => setScope(event.target.value as typeof scope)}
            >
              <option value="effective">Effective for this office</option>
              <option value="company">Company bands</option>
              {officeMarketId && (
                <option value="override">
                  {market?.name ?? 'Office market'} overrides
                </option>
              )}
            </select>
          </label>
          <label>
            As of
            <Input
              className="office-input"
              type="date"
              value={asOf}
              onChange={(event) => setAsOf(event.target.value)}
            />
          </label>
        </div>
        <div className="office-table-scroll">
          <table className="office-table">
            <thead>
              <tr>
                <th>Level</th>
                <th className="office-number">Minimum</th>
                <th className="office-number">Midpoint</th>
                <th className="office-number">Maximum</th>
                <th>Source</th>
                <th>Effective from</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => {
                const band = displayBand(level.id);
                return (
                  <tr key={level.id}>
                    <th scope="row">{bandLevel(level)}</th>
                    <td className="office-number">
                      {band?.values ? money.format(band.values.min) : '—'}
                    </td>
                    <td className="office-number">
                      {band?.values?.mid != null
                        ? money.format(band.values.mid)
                        : '—'}
                    </td>
                    <td className="office-number">
                      {band?.values ? money.format(band.values.max) : '—'}
                    </td>
                    <td>
                      {band?.values
                        ? band.marketId
                          ? (market?.name ?? 'Geography override')
                          : 'Company'
                        : 'No pay band'}
                    </td>
                    <td>{band?.values ? band.date : '—'}</td>
                  </tr>
                );
              })}
              {!levels.length && (
                <tr>
                  <td colSpan={6} className="office-muted">
                    Create job levels before defining pay bands.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing && canEdit && !reviewing && (
        <form className="office-panel office-stack" onSubmit={review}>
          <div className="office-heading">
            <div>
              <h2>Edit pay bands</h2>
              <p className="office-muted">
                Publish dated versions without replacing historical bands.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
          <div className="office-form-grid">
            <label>
              Applies to
              <select
                className="office-input"
                value={draftScope}
                onChange={(event) =>
                  startDraft(
                    event.target.value as 'company' | 'override',
                    effectiveDate,
                  )
                }
              >
                <option value="company">Company</option>
                {officeMarketId && (
                  <option value="override">
                    {market?.name ?? 'Office market'} override
                  </option>
                )}
              </select>
            </label>
            <label>
              Effective date
              <Input
                className="office-input"
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
              />
            </label>
          </div>
          <div className="office-table-scroll">
            <table className="office-table office-band-editor">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Minimum</th>
                  <th>
                    Midpoint <span className="office-muted">· optional</span>
                  </th>
                  <th>Maximum</th>
                </tr>
              </thead>
              <tbody>
                {levels
                  .filter((level) => !level.retired)
                  .map((level) => {
                    const row = draft[level.id] ?? {
                      min: '',
                      mid: '',
                      max: '',
                    };
                    const update = (field: keyof typeof row, value: string) => {
                      setDraft((current) => ({
                        ...current,
                        [level.id]: { ...row, [field]: value },
                      }));
                      setChanged((current) =>
                        current.includes(level.id)
                          ? current
                          : [...current, level.id],
                      );
                    };
                    return (
                      <tr key={level.id}>
                        <th scope="row">{bandLevel(level)}</th>
                        <td>
                          <Input
                            className="office-input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            inputMode="decimal"
                            aria-label={`${level.code} minimum`}
                            value={row.min}
                            onChange={(event) =>
                              update('min', event.target.value)
                            }
                          />
                        </td>
                        <td>
                          <Input
                            className="office-input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            inputMode="decimal"
                            aria-label={`${level.code} midpoint`}
                            value={row.mid}
                            onChange={(event) =>
                              update('mid', event.target.value)
                            }
                          />
                        </td>
                        <td>
                          <Input
                            className="office-input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            inputMode="decimal"
                            aria-label={`${level.code} maximum`}
                            value={row.max}
                            onChange={(event) =>
                              update('max', event.target.value)
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <div className="office-actions">
            <Button type="submit">Review changes</Button>
          </div>
        </form>
      )}

      {editing && canEdit && reviewing && (
        <section className="office-panel office-stack">
          <div className="office-heading">
            <div>
              <h2>Review band changes</h2>
              <p className="office-muted">
                {scopeLabel} · Effective {effectiveDate}
              </p>
            </div>
          </div>
          <div className="office-table-scroll">
            <table className="office-table">
              <thead>
                <tr>
                  <th>Level</th>
                  <th className="office-number">Minimum</th>
                  <th className="office-number">Midpoint</th>
                  <th className="office-number">Maximum</th>
                </tr>
              </thead>
              <tbody>
                {reviewRows.map((row) => {
                  const level = levels.find((item) => item.id === row.levelId);
                  return (
                    <tr key={row.levelId}>
                      <th scope="row">
                        {level ? bandLevel(level) : row.levelId}
                      </th>
                      <td className="office-number">{money.format(row.min)}</td>
                      <td className="office-number">
                        {row.mid == null ? '—' : money.format(row.mid)}
                      </td>
                      <td className="office-number">{money.format(row.max)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="office-actions">
            <Button disabled={saving} onClick={publish}>
              Publish {reviewRows.length}{' '}
              {reviewRows.length === 1 ? 'band' : 'bands'}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => setReviewRows([])}
            >
              Back to editing
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </section>
      )}

      {officeMarketId && overrideRows.length > 0 && canEdit && (
        <section className="office-panel office-stack">
          <div className="office-heading">
            <div>
              <h2>End a geography override</h2>
              <p className="office-muted">
                Ending an override returns the level to the company band on the
                selected date. Historical override versions remain visible.
              </p>
            </div>
          </div>
          <div className="office-form-grid">
            <label>
              Level
              <select
                className="office-input"
                value={endLevelId}
                onChange={(event) => setEndLevelId(event.target.value)}
              >
                <option value="">Select a level</option>
                {overrideRows.map((level) => (
                  <option key={level.id} value={level.id}>
                    {[ladderLabel(level.ladderId), levelLabel(level)]
                      .filter(Boolean)
                      .join(' · ')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              End date
              <Input
                className="office-input"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
          </div>
          <div className="office-actions">
            <Button
              variant="outline"
              disabled={!endLevelId || saving}
              onClick={endOverride}
            >
              End override
            </Button>
          </div>
        </section>
      )}
      {error && (
        <p className="office-error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="office-status" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
