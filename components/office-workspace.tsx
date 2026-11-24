'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SubmitEvent,
} from 'react';
import {
  BarChart3,
  Compass,
  Database,
  Layers3,
  ListChecks,
  Plus,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { OfficeAnalysis } from '@/components/office-analysis';
import { OfficeMarketData } from '@/components/office-market-data';
import { OfficePeople } from '@/components/office-people';
import { OfficeJobLevels, OfficePayBands } from '@/components/office-structure';
import { Button } from '@/components/ui/button';
import { hasMarketRange } from '@/lib/domain';
import { sampleWorkspace } from '@/lib/sample-data';
import {
  COMPANY_SIZES,
  formText,
  type CompanySize,
  type Office,
  type OfficeWorkspaceCommand,
  type OfficeWorkspaceData,
  type OfficeWorkspaceResponse,
  type OfficeWorkspaceSave,
} from '@/lib/office-workspace';

const sections = [
  { id: 'people', label: 'People', Icon: Users },
  { id: 'levels', label: 'Job Levels', Icon: Layers3 },
  { id: 'bands', label: 'Pay Bands', Icon: ListChecks },
  { id: 'market', label: 'Market Data', Icon: Database },
  { id: 'analysis', label: 'Analysis', Icon: BarChart3 },
] as const;
type Section = (typeof sections)[number]['id'];
type WorkspaceError = { error?: string };

const demoData: OfficeWorkspaceData = {
  organization: sampleWorkspace.organization,
  role: 'viewer',
  offices: [
    {
      id: 'demo-office',
      name: 'Huntsville',
      laborMarketId: sampleWorkspace.laborMarket.id,
    },
    { id: 'demo-new-office', name: 'Denver', laborMarketId: null },
  ],
  markets: [sampleWorkspace.laborMarket],
  disciplines: [sampleWorkspace.discipline],
  ladders: [
    { ...sampleWorkspace.ladder, disciplineId: sampleWorkspace.discipline.id },
  ],
  levels: sampleWorkspace.levels.map((level) => ({
    ...level,
    ladderId: sampleWorkspace.ladder.id,
    code: level.name,
    name: level.description ?? level.name,
    retired: false,
  })),
  datasets: [
    {
      ...sampleWorkspace.dataset,
      laborMarketId: sampleWorkspace.laborMarket.id,
    },
  ],
  people: [
    ...sampleWorkspace.employees.map((person) => ({
      ...person,
      officeId: 'demo-office',
    })),
    {
      id: 'demo-pending',
      name: 'Taylor Briggs',
      officeId: 'demo-office',
      levelId: null,
      salary: null,
      disciplineId: null,
      careerLadderId: null,
    },
  ],
  bands: sampleWorkspace.market.filter(hasMarketRange).map((point) => ({
    levelId: point.levelId,
    marketId: null,
    date: '2026-01-01',
    values: {
      levelId: point.levelId,
      min: point.p25,
      mid: point.p50,
      max: point.p75,
    },
  })),
};

async function workspaceRequest(
  path: string,
  options?: RequestInit,
): Promise<OfficeWorkspaceResponse> {
  const response = await fetch(path, { cache: 'no-store', ...options });
  const body = (await response.json()) as OfficeWorkspaceResponse &
    WorkspaceError;
  if (!response.ok)
    throw new Error(
      body.error ?? 'The workspace request could not be completed.',
    );
  return body;
}

function officePreference(organizationId: string) {
  return `workforce-compass:office:${organizationId}`;
}

function preferredOffice(workspace: OfficeWorkspaceData) {
  try {
    const saved = localStorage.getItem(
      officePreference(workspace.organization.id),
    );
    if (saved === '' || workspace.offices.some((office) => office.id === saved))
      return saved ?? '';
  } catch {
    /* Storage can be unavailable in a private session. */
  }
  return workspace.offices[0]?.id ?? '';
}

function CompanySizeField({ value }: { value?: CompanySize | null }) {
  return (
    <label>
      Company size
      <select
        className="office-input"
        name="companySize"
        defaultValue={value ?? ''}
      >
        <option value="">Not set</option>
        {Object.entries(COMPANY_SIZES).map(([size, label]) => (
          <option key={size} value={size}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function OrganizationEditor({
  busy,
  save,
  close,
}: {
  busy: boolean;
  save: (
    name: string,
    currency: string,
    companySize: CompanySize | null,
  ) => Promise<void>;
  close?: () => void;
}) {
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const companySize = formText(form, 'companySize') as CompanySize | '';
    void save(
      formText(form, 'name'),
      formText(form, 'currency').toUpperCase(),
      companySize || null,
    );
  }
  return (
    <form
      className="office-panel office-panel-pad office-stack"
      onSubmit={submit}
    >
      <div>
        <h1>{close ? 'New organization' : 'Set up your workspace'}</h1>
        <p className="office-muted">
          Create an organization, then set up its first office.
        </p>
      </div>
      <fieldset className="office-stack" disabled={busy}>
        <div className="office-form-grid">
          <label>
            Organization name
            <input
              className="office-input"
              name="name"
              maxLength={160}
              required
              autoComplete="organization"
            />
          </label>
          <label>
            Currency
            <input
              className="office-input office-currency"
              name="currency"
              pattern="[A-Za-z]{3}"
              defaultValue="USD"
              maxLength={3}
              required
            />
          </label>
          <CompanySizeField />
        </div>
        <div className="office-actions">
          <Button type="submit">
            {busy ? 'Creating…' : 'Create organization'}
          </Button>
          {close ? (
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
          ) : (
            <Link className="office-link" href="/demo">
              Open demo
            </Link>
          )}
        </div>
      </fieldset>
    </form>
  );
}

function OrganizationSettings({
  organization,
  save,
  close,
}: {
  organization: OfficeWorkspaceData['organization'];
  save: OfficeWorkspaceSave;
  close: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const companySize = formText(form, 'companySize') as CompanySize | '';
    if (
      await save({
        action: 'organization-settings',
        companySize: companySize || null,
      })
    )
      close();
  }

  return (
    <form
      id="office-organization-settings"
      className="office-panel office-panel-pad office-stack"
      onSubmit={submit}
    >
      <div>
        <h2 ref={heading} tabIndex={-1}>
          Organization settings
        </h2>
        <p className="office-muted">{organization.name}</p>
      </div>
      <div className="office-form-grid">
        <CompanySizeField value={organization.companySize} />
      </div>
      <div className="office-actions">
        <Button type="submit">Save settings</Button>
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function OfficeEditor({
  office,
  data,
  save,
  createMarket,
  close,
}: {
  office?: Office;
  data: OfficeWorkspaceData;
  save: (office: {
    id?: string;
    name: string;
    laborMarketId: string | null;
  }) => Promise<void>;
  createMarket: (name: string) => Promise<string | undefined>;
  close: () => void;
}) {
  const [market, setMarket] = useState(office?.laborMarketId ?? '');
  const [addingMarket, setAddingMarket] = useState(false);
  const [marketName, setMarketName] = useState('');
  const nameField = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameField.current?.focus();
  }, []);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void save({
      id: office?.id,
      name: formText(form, 'name'),
      laborMarketId: market || null,
    });
  }
  return (
    <form
      className="office-panel office-panel-pad office-stack"
      onSubmit={submit}
    >
      <h2>{office ? 'Office settings' : 'Set up office'}</h2>
      <div className="office-form-grid">
        <label>
          Office name
          <input
            ref={nameField}
            className="office-input"
            name="name"
            required
            maxLength={160}
            defaultValue={office?.name}
            placeholder="e.g. Chicago"
          />
        </label>
        <label>
          Comparison labor market{' '}
          <span className="office-muted">· optional</span>
          <select
            className="office-input"
            value={market}
            onChange={(event) => setMarket(event.target.value)}
          >
            <option value="">No labor market selected</option>
            {data.markets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {addingMarket ? (
        <div className="office-inline-field">
          <label>
            New labor market
            <input
              className="office-input"
              value={marketName}
              maxLength={160}
              onChange={(event) => setMarketName(event.target.value)}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={!marketName.trim()}
            onClick={async () => {
              const id = await createMarket(marketName.trim());
              if (id) {
                setMarket(id);
                setAddingMarket(false);
                setMarketName('');
              }
            }}
          >
            Save labor market
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="office-link"
          onClick={() => setAddingMarket(true)}
        >
          <Plus /> New labor market
        </button>
      )}
      <div className="office-actions">
        <Button type="submit">
          {office ? 'Save office' : 'Create office'}
        </Button>
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function OfficeWorkspace({
  demo = false,
  initialOrganizationId,
}: {
  demo?: boolean;
  initialOrganizationId?: string;
}) {
  const [request, setRequest] = useState(initialOrganizationId);
  const [response, setResponse] = useState<OfficeWorkspaceResponse | null>(
    demo ? { organizations: [], workspace: demoData } : null,
  );
  const [section, setSection] = useState<Section>('people');
  const [officeId, setOfficeId] = useState(demo ? demoData.offices[0].id : '');
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [officeEditor, setOfficeEditor] = useState<'create' | 'edit' | null>(
    null,
  );
  const [newOrganization, setNewOrganization] = useState(false);
  const [organizationSettings, setOrganizationSettings] = useState(false);
  const organizationSettingsTrigger = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const inFlight = useRef(false);
  const data = response?.workspace ?? null;
  const organizationId = data?.organization.id;
  const office = data?.offices.find((item) => item.id === officeId);
  const canEdit = !demo && (data?.role === 'admin' || data?.role === 'analyst');

  const selectOffice = useCallback(
    (workspace: OfficeWorkspaceData, id: string) => {
      setOfficeId(id);
      setSelectedPerson(null);
      setOfficeEditor(null);
      if (!demo) {
        try {
          localStorage.setItem(officePreference(workspace.organization.id), id);
        } catch {
          /* Optional preference. */
        }
      }
    },
    [demo],
  );

  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    const suffix = request
      ? `?${new URLSearchParams({ organizationId: request })}`
      : '';
    void workspaceRequest(`/api/office-workspace${suffix}`, {
      signal: controller.signal,
    })
      .then((next) => {
        if (controller.signal.aborted) return;
        setResponse(next);
        if (next.workspace)
          selectOffice(next.workspace, preferredOffice(next.workspace));
      })
      .catch((reason: Error) => {
        if (!controller.signal.aborted) setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [demo, reload, request, selectOffice]);

  const refresh = useCallback(async () => {
    if (demo || !organizationId) return;
    try {
      const next = await workspaceRequest(
        `/api/office-workspace?${new URLSearchParams({ organizationId })}`,
      );
      setResponse((current) =>
        current?.workspace?.organization.id === organizationId ? next : current,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Reload the workspace to see saved changes.',
      );
    }
  }, [demo, organizationId]);

  async function mutate(command: OfficeWorkspaceCommand) {
    if (demo || inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await workspaceRequest('/api/office-workspace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          'organizationId' in command
            ? { ...command, revision: data?.revision }
            : command,
        ),
      });
      setResponse(next);
      return next;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Changes could not be saved.',
      );
      return null;
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  const save: OfficeWorkspaceSave = async (command) => {
    if (!organizationId) return false;
    const next = await mutate({ ...command, organizationId });
    if (!next?.workspace) return false;
    if (command.action === 'person') {
      if (command.officeId !== officeId)
        selectOffice(next.workspace, command.officeId);
      setSelectedPerson(next.entityId ?? null);
      setNotice(command.id ? 'Person updated.' : 'Person added to the office.');
    } else if (command.action === 'organization-settings') {
      setNotice('Organization settings saved.');
    } else if (command.action === 'assign') {
      setNotice(
        `${command.assignments.length} ${command.assignments.length === 1 ? 'office assignment' : 'office assignments'} confirmed.`,
      );
    } else setNotice('Changes saved.');
    return true;
  };

  function navigate(next: Section) {
    setSection(next);
    setOfficeEditor(null);
    setNewOrganization(false);
    setOrganizationSettings(false);
    setSelectedPerson(null);
    setNotice('');
    setError('');
  }

  function chooseOrganization(id: string) {
    if (id === 'new') {
      setOrganizationSettings(false);
      setNewOrganization(true);
      return;
    }
    setRequest(id);
    setLoading(true);
    setError('');
    navigate('people');
  }

  const startOffice = () => {
    setOfficeEditor('create');
    setNewOrganization(false);
    setOrganizationSettings(false);
    setSection('people');
  };

  return (
    <div className="office-shell">
      <header className="office-header">
        <div className="office-container office-header-content">
          <div className="office-brand">
            <span className="office-logo">
              <Compass aria-hidden="true" />
            </span>
            <strong>Workforce Compass</strong>
            {demo && <span className="office-demo-label">Demo</span>}
            {data && !demo && (
              <span className="office-organization-name">
                {canEdit ? (
                  <Button
                    ref={organizationSettingsTrigger}
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Organization settings for ${data.organization.name}`}
                    title="Organization settings"
                    aria-expanded={organizationSettings}
                    aria-controls={
                      organizationSettings
                        ? 'office-organization-settings'
                        : undefined
                    }
                    disabled={busy || loading}
                    onClick={() => {
                      setOfficeEditor(null);
                      setNewOrganization(false);
                      setOrganizationSettings((open) => !open);
                    }}
                  >
                    <span className="office-organization-label">
                      {data.organization.name}
                    </span>
                    <Settings aria-hidden="true" />
                  </Button>
                ) : (
                  <>
                    {data.organization.name}
                    {data.organization.companySize &&
                      ` · ${COMPANY_SIZES[data.organization.companySize]}`}
                  </>
                )}
              </span>
            )}
          </div>
          <div className="office-context">
            {!demo && data && (response?.organizations.length ?? 0) > 1 && (
              <label>
                Organization
                <select
                  className="office-input"
                  value={data.organization.id}
                  disabled={busy || loading}
                  onChange={(event) => chooseOrganization(event.target.value)}
                >
                  {response?.organizations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                  {canEdit && <option value="new">New organization…</option>}
                </select>
              </label>
            )}
            {data && (
              <label>
                Office
                <select
                  className="office-input"
                  aria-label="Office"
                  value={officeId}
                  disabled={busy || loading}
                  onChange={(event) => selectOffice(data, event.target.value)}
                >
                  {data.offices.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                  <option value="">Unassigned</option>
                </select>
              </label>
            )}
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={startOffice}
                disabled={busy || loading}
              >
                <Plus /> New office
              </Button>
            )}
            {demo && (
              <Link className="office-link" href="/?workspace=offices">
                Exit demo
              </Link>
            )}
            {!demo && data && (
              <Link className="office-link office-demo-link" href="/demo">
                Demo
              </Link>
            )}
          </div>
        </div>
      </header>
      {data && (
        <div className="office-nav-bar">
          <nav className="office-container office-nav" aria-label="Workspace">
            {sections.map(({ id, label, Icon }) => (
              <button
                type="button"
                key={id}
                aria-current={section === id ? 'page' : undefined}
                onClick={() => navigate(id)}
              >
                <Icon aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      )}
      <main
        className="office-container office-content"
        aria-busy={loading || busy}
      >
        {error && (
          <p className="office-error" role="alert">
            {error}
            {!data && !response && (
              <button
                type="button"
                className="office-link"
                onClick={() => {
                  setError('');
                  setLoading(true);
                  setReload((number) => number + 1);
                }}
              >
                Retry
              </button>
            )}
          </p>
        )}
        {notice && (
          <p className="office-notice" role="status">
            {notice}
          </p>
        )}
        {loading ? (
          <div
            className="office-loading-chart"
            role="status"
            aria-label="Loading office workspace"
          />
        ) : (
          response &&
          (!data || newOrganization ? (
            <OrganizationEditor
              busy={busy}
              close={data ? () => setNewOrganization(false) : undefined}
              save={async (name, currency, companySize) => {
                const next = await mutate({
                  action: 'organization',
                  name,
                  currency,
                  companySize,
                });
                if (next?.workspace) {
                  selectOffice(next.workspace, '');
                  navigate('people');
                  setNotice('Organization created.');
                }
              }}
            />
          ) : (
            <fieldset className="office-stack office-page" disabled={busy}>
              <div className="office-stack">
                {organizationSettings && canEdit && (
                  <OrganizationSettings
                    key={data.organization.id}
                    organization={data.organization}
                    save={save}
                    close={() => {
                      setOrganizationSettings(false);
                      requestAnimationFrame(() =>
                        organizationSettingsTrigger.current?.focus(),
                      );
                    }}
                  />
                )}
                {officeEditor && canEdit && (
                  <OfficeEditor
                    key={officeEditor === 'edit' ? office?.id : 'create'}
                    office={officeEditor === 'edit' ? office : undefined}
                    data={data}
                    close={() => setOfficeEditor(null)}
                    save={async (values) => {
                      const next = await mutate({
                        action: 'office',
                        ...values,
                        organizationId: data.organization.id,
                      });
                      if (next?.workspace && next.entityId) {
                        selectOffice(next.workspace, next.entityId);
                        setNotice('Office saved.');
                      }
                    }}
                    createMarket={async (name) =>
                      (
                        await mutate({
                          action: 'market',
                          name,
                          organizationId: data.organization.id,
                        })
                      )?.entityId
                    }
                  />
                )}
                {section === 'people' && (
                  <OfficePeople
                    key={`${data.organization.id}:${officeId}`}
                    workspace={data}
                    office={office}
                    canEdit={canEdit}
                    save={save}
                    newOffice={startOffice}
                    editOffice={() => {
                      setOrganizationSettings(false);
                      setOfficeEditor('edit');
                    }}
                    personId={selectedPerson}
                    onSelectPerson={setSelectedPerson}
                  />
                )}
                {section === 'levels' && (
                  <OfficeJobLevels
                    workspace={data}
                    officeMarketId={office?.laborMarketId ?? null}
                    canEdit={canEdit}
                    save={save}
                  />
                )}
                {section === 'bands' && (
                  <OfficePayBands
                    key={`${data.organization.id}:${officeId}`}
                    workspace={data}
                    officeMarketId={office?.laborMarketId ?? null}
                    canEdit={canEdit}
                    save={save}
                  />
                )}
                {section === 'market' && (
                  <OfficeMarketData
                    key={`${data.organization.id}:${officeId}`}
                    workspace={data}
                    officeMarketId={office?.laborMarketId ?? null}
                    canEdit={canEdit}
                    onRefresh={refresh}
                  />
                )}
                {section === 'analysis' && (
                  <OfficeAnalysis
                    key={`${data.organization.id}:${officeId}`}
                    data={data}
                    office={office}
                    demoWorkspace={demo ? sampleWorkspace : undefined}
                  />
                )}
              </div>
            </fieldset>
          ))
        )}
      </main>
    </div>
  );
}
