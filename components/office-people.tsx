'use client';

import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { MapPin, Pencil, Plus, Search, UserRoundPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  effectivePayBand,
  formText,
  suggestOfficeMatches,
  utcDate,
  type Office,
  type OfficeWorkspaceData,
  type OfficeWorkspaceSave,
  type RosterPerson,
} from '@/lib/office-workspace';

export function officeMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function BandStatus({
  workspace,
  person,
  office,
}: {
  workspace: OfficeWorkspaceData;
  person: RosterPerson;
  office?: Office;
}) {
  if (!person.levelId)
    return (
      <span className="office-status" data-tone="pending">
        Level pending
      </span>
    );
  if (person.salary === null)
    return (
      <span className="office-status" data-tone="pending">
        Salary pending
      </span>
    );
  const band = effectivePayBand(
    workspace.bands,
    person.levelId,
    office?.laborMarketId ?? null,
    utcDate(),
  )?.values;
  if (!band) return <span className="office-status">No pay band</span>;
  if (person.salary < band.min)
    return (
      <span className="office-status" data-tone="below">
        Below band
      </span>
    );
  if (person.salary > band.max)
    return (
      <span className="office-status" data-tone="pending">
        Above band
      </span>
    );
  return (
    <span className="office-status" data-tone="good">
      In band
    </span>
  );
}

function PersonEditor({
  workspace,
  person,
  office,
  save,
  close,
}: {
  workspace: OfficeWorkspaceData;
  person?: RosterPerson;
  office?: Office;
  save: OfficeWorkspaceSave;
  close: () => void;
}) {
  const nameField = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameField.current?.focus();
  }, []);
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const salary = formText(form, 'salary');
    const saved = await save({
      action: 'person',
      id: person?.id,
      name: formText(form, 'name'),
      title: formText(form, 'title'),
      officeId: formText(form, 'officeId'),
      levelId: formText(form, 'levelId') || null,
      salary: salary === '' ? null : Number(salary),
    });
    if (saved) close();
  }

  return (
    <form
      className="office-panel office-panel-pad office-stack"
      onSubmit={submit}
    >
      <h2>{person ? 'Edit person' : 'Add person'}</h2>
      <div className="office-form-grid">
        <label>
          Name
          <input
            ref={nameField}
            className="office-input"
            name="name"
            required
            maxLength={160}
            defaultValue={person?.name}
            autoComplete="off"
          />
        </label>
        <label>
          Office
          <select
            className="office-input"
            name="officeId"
            required
            defaultValue={person ? (person.officeId ?? '') : (office?.id ?? '')}
          >
            <option value="">Choose an office</option>
            {workspace.offices.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <details open={person ? true : undefined} className="office-disclosure">
        <summary>
          Job and pay details <span className="office-muted">· optional</span>
        </summary>
        <div className="office-form-grid">
          <label>
            Job title
            <input
              className="office-input"
              name="title"
              maxLength={160}
              defaultValue={person?.title}
            />
          </label>
          <label>
            Job level
            <select
              className="office-input"
              name="levelId"
              defaultValue={person?.levelId ?? ''}
            >
              <option value="">Level pending</option>
              {workspace.ladders.map((ladder) => {
                const levels = workspace.levels.filter(
                  (level) =>
                    level.ladderId === ladder.id &&
                    (!level.retired || level.id === person?.levelId),
                );
                const discipline = workspace.disciplines.find(
                  (item) => item.id === ladder.disciplineId,
                );
                return (
                  levels.length > 0 && (
                    <optgroup
                      key={ladder.id}
                      label={[discipline?.name, ladder.name]
                        .filter(Boolean)
                        .join(' · ')}
                    >
                      {levels.map((level) => (
                        <option key={level.id} value={level.id}>
                          {level.code === level.name
                            ? level.name
                            : `${level.code} · ${level.name}`}
                          {level.retired ? ' (retired)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  )
                );
              })}
            </select>
          </label>
          <label>
            Annual base salary ({workspace.organization.currency})
            <input
              className="office-input"
              name="salary"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={person?.salary ?? ''}
            />
          </label>
        </div>
      </details>
      <div className="office-actions">
        <Button type="submit">{person ? 'Save changes' : 'Save person'}</Button>
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AssignmentReview({
  workspace,
  close,
  save,
}: {
  workspace: OfficeWorkspaceData;
  close: () => void;
  save: OfficeWorkspaceSave;
}) {
  const matches = suggestOfficeMatches(
    workspace.people,
    workspace.offices,
  ).slice(0, 50);
  const [excluded, setExcluded] = useState<string[]>([]);
  const chosen = matches.filter((item) => !excluded.includes(item.personId));

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      chosen.length &&
      (await save({ action: 'assign', assignments: chosen }))
    )
      close();
  }

  return (
    <form
      className="office-panel office-panel-pad office-stack"
      onSubmit={submit}
    >
      <div>
        <h2>Review office matches</h2>
        <p className="office-muted">
          Confirm the people and offices in this batch. Other records stay in
          Unassigned.
        </p>
      </div>
      {matches.length ? (
        <div className="office-table-scroll">
          <table className="office-table">
            <thead>
              <tr>
                <th scope="col">Include</th>
                <th scope="col">Person</th>
                <th scope="col">Existing location</th>
                <th scope="col">Suggested office</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => {
                const person = workspace.people.find(
                  (item) => item.id === match.personId,
                );
                const office = workspace.offices.find(
                  (item) => item.id === match.officeId,
                );
                return (
                  <tr key={match.personId}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Include ${person?.name}`}
                        checked={!excluded.includes(match.personId)}
                        onChange={(event) => {
                          setExcluded((current) =>
                            event.target.checked
                              ? current.filter((id) => id !== match.personId)
                              : [...current, match.personId],
                          );
                        }}
                      />
                    </td>
                    <th scope="row">{person?.name}</th>
                    <td>{person?.location}</td>
                    <td>{office?.name}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="office-muted">
          No exact matches. Open a person’s record to choose their office.
        </p>
      )}
      <div className="office-actions">
        {matches.length > 0 && (
          <Button type="submit" disabled={!chosen.length}>
            Confirm {chosen.length}{' '}
            {chosen.length === 1 ? 'assignment' : 'assignments'}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={close}>
          Close review
        </Button>
      </div>
    </form>
  );
}

export function OfficePeople({
  workspace,
  office,
  canEdit,
  save,
  newOffice,
  editOffice,
  personId,
  onSelectPerson,
}: {
  workspace: OfficeWorkspaceData;
  office?: Office;
  canEdit: boolean;
  save: OfficeWorkspaceSave;
  newOffice: () => void;
  editOffice: () => void;
  personId: string | null;
  onSelectPerson: (id: string | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [editor, setEditor] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const roster = workspace.people.filter(
    (person) => person.officeId === (office?.id ?? null),
  );
  const activePerson = roster.find((person) => person.id === personId);
  const editingPerson = roster.find((person) => person.id === editor);
  const levels = new Map(workspace.levels.map((level) => [level.id, level]));
  const market = workspace.markets.find(
    (item) => item.id === office?.laborMarketId,
  );
  const needsDetails = (person: RosterPerson) =>
    !person.levelId || person.salary === null;
  const pending = roster.filter(needsDetails).length;
  const search = query.trim().toLowerCase();
  const visible = roster.filter((person) => {
    const level = levels.get(person.levelId ?? '');
    return (
      (!pendingOnly || needsDetails(person)) &&
      [person.name, person.title, level?.code, level?.name].some((value) =>
        value?.toLowerCase().includes(search),
      )
    );
  });
  const levelLabel = (levelId: string | null) => {
    const level = levels.get(levelId ?? '');
    return level
      ? level.code === level.name
        ? level.name
        : `${level.code} · ${level.name}`
      : 'Level pending';
  };
  const addPerson = () => setEditor('');
  const format = (salary: number) =>
    officeMoney(salary, workspace.organization.currency);

  return (
    <>
      <div className="office-heading">
        <div>
          <h1>People</h1>
          <p className="office-muted">
            {office
              ? `${office.name} office · ${market?.name ?? 'No labor market selected'}`
              : 'Unassigned · People awaiting an office assignment'}
          </p>
        </div>
        {canEdit && (
          <div className="office-actions">
            {office ? (
              <>
                <Button type="button" variant="outline" onClick={editOffice}>
                  {market ? <Pencil /> : <MapPin />}
                  {market ? 'Office settings' : 'Choose labor market'}
                </Button>
                {roster.length > 0 && (
                  <Button type="button" onClick={addPerson}>
                    <Plus /> Add person
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button type="button" onClick={newOffice}>
                  <Plus /> Set up office
                </Button>
                {workspace.offices.length > 0 && roster.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setReviewing(!reviewing)}
                  >
                    Review office matches
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {reviewing && canEdit && (
        <AssignmentReview
          workspace={workspace}
          save={save}
          close={() => setReviewing(false)}
        />
      )}
      {editor !== null && canEdit && (
        <PersonEditor
          key={editor}
          workspace={workspace}
          person={editingPerson}
          office={office}
          save={save}
          close={() => setEditor(null)}
        />
      )}
      {activePerson && editor === null && (
        <section
          className="office-panel office-panel-pad office-stack"
          aria-label="Person details"
        >
          <div className="office-heading office-heading-compact">
            <div>
              <h2>{activePerson.name}</h2>
              {activePerson.title && (
                <p className="office-muted">{activePerson.title}</p>
              )}
            </div>
            <div className="office-actions">
              {canEdit && workspace.offices.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditor(activePerson.id)}
                >
                  <Pencil /> Edit person
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => onSelectPerson(null)}
              >
                Close details
              </Button>
            </div>
          </div>
          <dl className="office-person-details">
            <div>
              <dt>Office</dt>
              <dd>{office?.name ?? 'Unassigned'}</dd>
            </div>
            <div>
              <dt>Job level</dt>
              <dd>{levelLabel(activePerson.levelId)}</dd>
            </div>
            <div>
              <dt>Annual base salary</dt>
              <dd>
                {activePerson.salary === null
                  ? 'Salary pending'
                  : format(activePerson.salary)}
              </dd>
            </div>
            <div>
              <dt>Pay band</dt>
              <dd>
                <BandStatus
                  workspace={workspace}
                  person={activePerson}
                  office={office}
                />
              </dd>
            </div>
          </dl>
        </section>
      )}
      {!roster.length && editor === null && (
        <div className="office-panel office-empty">
          <h2>
            {office
              ? 'No people in this office'
              : workspace.offices.length
                ? 'No unassigned people'
                : 'No offices yet'}
          </h2>
          {office && (
            <p className="office-muted">Add someone to start the roster.</p>
          )}
          {!office && !workspace.offices.length && (
            <p className="office-muted">
              Set up your first office to start the roster.
            </p>
          )}
          {office && canEdit && (
            <Button type="button" onClick={addPerson}>
              <UserRoundPlus /> Add person
            </Button>
          )}
        </div>
      )}
      {roster.length > 0 && (
        <section className="office-panel" aria-label="Office roster">
          <div className="office-toolbar">
            <label className="office-search">
              <Search aria-hidden="true" />
              <input
                type="search"
                className="office-input"
                aria-label="Search people"
                placeholder="Search people"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <select
              className="office-input"
              aria-label="Filter people"
              value={pendingOnly ? 'pending' : 'all'}
              onChange={(event) =>
                setPendingOnly(event.target.value === 'pending')
              }
            >
              <option value="all">All people</option>
              <option value="pending">Missing details</option>
            </select>
            <p className="office-roster-count office-muted" role="status">
              {search || pendingOnly
                ? `${visible.length} of ${roster.length} ${roster.length === 1 ? 'person' : 'people'}`
                : `${roster.length} ${roster.length === 1 ? 'person' : 'people'}${pending ? ` · ${pending} ${pending === 1 ? 'needs' : 'need'} details` : ''}`}
            </p>
          </div>
          {visible.length ? (
            <div className="office-table-scroll">
              <table className="office-table office-roster">
                <thead>
                  <tr>
                    <th scope="col">Person</th>
                    <th scope="col">Level</th>
                    <th scope="col" className="office-base-pay office-number">
                      Base salary
                    </th>
                    <th scope="col">
                      {office ? 'Pay band' : 'Existing location'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((person) => (
                    <tr
                      key={person.id}
                      data-selected={person.id === personId || undefined}
                    >
                      <th scope="row">
                        <button
                          className="office-person"
                          type="button"
                          aria-label={person.name}
                          onClick={() =>
                            onSelectPerson(
                              person.id === personId ? null : person.id,
                            )
                          }
                          aria-expanded={person.id === personId}
                        >
                          <span className="office-initials" aria-hidden="true">
                            {person.name
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((part) => Array.from(part)[0])
                              .join('')
                              .toUpperCase()}
                          </span>
                          <span>
                            <strong>{person.name}</strong>
                            {person.title && <small>{person.title}</small>}
                          </span>
                        </button>
                      </th>
                      <td>{levelLabel(person.levelId)}</td>
                      <td className="office-base-pay office-number">
                        {person.salary === null ? '—' : format(person.salary)}
                      </td>
                      <td>
                        {office ? (
                          <BandStatus
                            workspace={workspace}
                            person={person}
                            office={office}
                          />
                        ) : (
                          person.location || '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="office-empty">
              <h2>No matching people</h2>
              <Button
                variant="outline"
                onClick={() => {
                  setQuery('');
                  setPendingOnly(false);
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
