'use client';

import { useState } from 'react';
import { CopyPlus, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Employee, HiringAssumption, MarketPoint, Workspace } from '@/lib/domain';
import { validateMarketPoint } from '@/lib/domain';
import {
  createWorkspaceContext,
  type ContextCreationKind,
} from '@/lib/context-management';
import type { WorkspaceContexts } from '@/lib/workspace-repository';

const contextCreationLabels: Record<ContextCreationKind, string> = {
  organization: 'Organization',
  laborMarket: 'Labor market',
  discipline: 'Discipline',
  ladder: 'Career ladder',
  dataset: 'Market dataset',
};

function numericValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumericValue(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function EmployeeDialog({
  open,
  onOpenChange,
  workspace,
  contexts,
  employee,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  contexts: WorkspaceContexts;
  employee?: Employee | null;
  onSave: (employee: Employee) => Promise<boolean>;
  onDelete?: (employeeId: string) => Promise<boolean>;
}) {
  const blankEmployee: Employee = {
    id: crypto.randomUUID(),
    name: '',
    title: '',
    disciplineId: workspace.discipline.id,
    careerLadderId: workspace.ladder.id,
    levelId: workspace.levels[0]?.id ?? '',
    salary: 0,
    notes: '',
  };
  const [draft, setDraft] = useState<Employee>(employee ?? blankEmployee);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const disciplines = contexts.disciplines.filter(
    (discipline) => discipline.organizationId === workspace.organization.id,
  );
  const ladders = contexts.ladders.filter(
    (ladder) => ladder.disciplineId === draft.disciplineId,
  );
  const levels = [
    ...contexts.levels.filter(
      (level) => level.careerLadderId === draft.careerLadderId,
    ),
    ...(draft.careerLadderId === workspace.ladder.id
      ? workspace.levels.map((level) => ({
          ...level,
          careerLadderId: workspace.ladder.id,
        }))
      : []),
  ].filter(
    (level, index, items) => items.findIndex((item) => item.id === level.id) === index,
  );

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    if (submitting) return;
    if (!draft.name.trim() || !Number.isFinite(draft.salary) || draft.salary <= 0 || !levels.some((level) => level.id === draft.levelId)) {
      setError('Name, discipline, career ladder, level, and a positive base salary are required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const saved = await onSave({ ...draft, name: draft.name.trim() });
      if (saved) onOpenChange(false);
      else setError('The employee could not be saved. Please try again.');
    } catch {
      setError('The employee could not be saved. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteEmployee() {
    if (!employee || !onDelete || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (await onDelete(employee.id)) {
        setDeleteOpen(false);
        onOpenChange(false);
      } else setError('The employee could not be deleted. Please try again.');
    } catch {
      setError('The employee could not be deleted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
        <DialogContent className="management-modal employee-modal">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{employee ? 'Edit employee' : 'Add employee'}</DialogTitle>
              <DialogDescription>
                Employee observations are shown as points and remain separate from the estimated team curve.
              </DialogDescription>
            </DialogHeader>
            <fieldset className="form-grid" disabled={submitting}>
              <label className="field-wide">
                <span>Name</span>
                <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Employee name" />
              </label>
              <label>
                <span>Title <small>optional</small></span>
                <Input value={draft.title ?? ''} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Senior Software Engineer" />
              </label>
              {employee && <label>
                <span>Discipline</span>
                <Select value={draft.disciplineId} onValueChange={(value) => {
                  const disciplineId = String(value);
                  const careerLadderId = contexts.ladders.find((ladder) => ladder.disciplineId === disciplineId)?.id ?? '';
                  const levelId = contexts.levels.find((level) => level.careerLadderId === careerLadderId)?.id ?? '';
                  setDraft({ ...draft, disciplineId, careerLadderId, levelId });
                }}>
                  <SelectTrigger className="dialog-select" aria-label="Employee discipline"><SelectValue>{disciplines.find((discipline) => discipline.id === draft.disciplineId)?.name ?? 'Select discipline'}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {disciplines.map((discipline) => <SelectItem key={discipline.id} value={discipline.id}>{discipline.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>}
              {employee && <label>
                <span>Career ladder</span>
                <Select value={draft.careerLadderId} onValueChange={(value) => {
                  const careerLadderId = String(value);
                  const levelId = contexts.levels.find((level) => level.careerLadderId === careerLadderId)?.id ?? '';
                  setDraft({ ...draft, careerLadderId, levelId });
                }}>
                  <SelectTrigger className="dialog-select" aria-label="Employee career ladder"><SelectValue>{ladders.find((ladder) => ladder.id === draft.careerLadderId)?.name ?? 'Select career ladder'}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {ladders.map((ladder) => <SelectItem key={ladder.id} value={ladder.id}>{ladder.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>}
              <label>
                <span>Career level</span>
                <Select value={draft.levelId} onValueChange={(value) => setDraft({ ...draft, levelId: String(value) })}>
                  <SelectTrigger className="dialog-select" aria-label="Employee career level"><SelectValue>{levels.find((level) => level.id === draft.levelId)?.name ?? 'Select career level'}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {[...levels].sort((a, b) => a.order - b.order).map((level) => (
                      <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label>
                <span>Annual base salary</span>
                <Input type="number" min="0.01" step="0.01" value={draft.salary || ''} onChange={(event) => setDraft({ ...draft, salary: numericValue(event.target.value) })} placeholder="165000" />
              </label>
              <label>
                <span>Employee number <small>optional</small></span>
                <Input value={draft.employeeNumber ?? ''} onChange={(event) => setDraft({ ...draft, employeeNumber: event.target.value || undefined })} placeholder="E-1042" />
              </label>
              <label>
                <span>Annual bonus <small>optional</small></span>
                <Input type="number" min="0" step="0.01" value={draft.annualBonus ?? ''} onChange={(event) => setDraft({ ...draft, annualBonus: optionalNumericValue(event.target.value) ?? undefined })} placeholder="15000" />
              </label>
              <label>
                <span>Annual equity <small>optional</small></span>
                <Input type="number" min="0" step="0.01" value={draft.annualEquity ?? ''} onChange={(event) => setDraft({ ...draft, annualEquity: optionalNumericValue(event.target.value) ?? undefined })} placeholder="25000" />
              </label>
              <label>
                <span>Annual benefits <small>optional</small></span>
                <Input type="number" min="0" step="0.01" value={draft.annualBenefits ?? ''} onChange={(event) => setDraft({ ...draft, annualBenefits: optionalNumericValue(event.target.value) ?? undefined })} placeholder="18000" />
              </label>
              <label>
                <span>Location <small>optional</small></span>
                <Input value={draft.location ?? ''} onChange={(event) => setDraft({ ...draft, location: event.target.value || undefined })} placeholder="Chicago, IL" />
              </label>
              <label>
                <span>Start date <small>optional</small></span>
                <Input type="date" value={draft.startDate ?? ''} onChange={(event) => setDraft({ ...draft, startDate: event.target.value || undefined })} />
              </label>
              <label>
                <span>Team <small>optional</small></span>
                <Input value={draft.team ?? ''} onChange={(event) => setDraft({ ...draft, team: event.target.value || undefined })} placeholder="Platform" />
              </label>
              <label>
                <span>Manager <small>optional</small></span>
                <Select value={draft.managerId ? `employee:${draft.managerId}` : 'none'} onValueChange={(value) => setDraft({ ...draft, managerId: value === 'none' ? undefined : String(value).slice(9) })}>
                  <SelectTrigger className="dialog-select" aria-label="Employee manager"><SelectValue>{draft.managerId ? workspace.employees.find((item) => item.id === draft.managerId)?.name ?? 'Select manager' : 'No manager'}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No manager</SelectItem>
                    {workspace.employees.filter((item) => item.id !== draft.id).map((item) => <SelectItem key={item.id} value={`employee:${item.id}`}>{item.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              <label>
                <span>Performance rating <small>0–5, optional</small></span>
                <Input type="number" min="0" max="5" step="0.1" value={draft.performanceRating ?? ''} onChange={(event) => setDraft({ ...draft, performanceRating: optionalNumericValue(event.target.value) ?? undefined })} placeholder="4.2" />
              </label>
              <label className="field-wide">
                <span>Notes <small>optional</small></span>
                <Textarea value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Context that should accompany this observation" />
              </label>
            </fieldset>
            {error && !deleteOpen && <p className="form-error" role="alert">{error}</p>}
            <DialogFooter className="management-footer">
              {employee && onDelete ? (
                <Button type="button" variant="ghost" className="delete-button" disabled={submitting} onClick={() => { setError(null); setDeleteOpen(true); }}><Trash2 /> Delete</Button>
              ) : <span />}
              <div>
                <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}><Save /> {submitting ? 'Saving…' : 'Save employee'}</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteOpen} onOpenChange={(next) => { if (!submitting) setDeleteOpen(next); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {employee?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the employee observation from every analysis view. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="form-error" role="alert">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={submitting} onClick={deleteEmployee}>{submitting ? 'Deleting…' : 'Delete employee'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function MarketEditor({ draft, setDraft }: { draft: Workspace; setDraft: (next: Workspace) => void }) {
  function updateMarket(levelId: string, field: keyof Omit<MarketPoint, 'levelId'>, value: number) {
    const existing = draft.market.find((point) => point.levelId === levelId) ?? { levelId, p25: 0, p50: 0, p75: 0 };
    const nextPoint = { ...existing, [field]: value };
    setDraft({ ...draft, market: [...draft.market.filter((point) => point.levelId !== levelId), nextPoint] });
  }
  function clearMarket(levelId: string) {
    setDraft({
      ...draft,
      market: draft.market.filter((point) => point.levelId !== levelId),
    });
  }
  return (
    <div className="editor-panel">
      <div className="editor-intro">
        <div><strong>Market compensation</strong><p>Enter annual base salary percentiles for each level.</p></div>
        <span className="data-badge market-badge">Market data</span>
      </div>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead><tr><th>Level</th><th>P25</th><th>P50</th><th>P75</th><th>Status</th></tr></thead>
          <tbody>
              {[...draft.levels].sort((a, b) => a.order - b.order).map((level) => {
                const existingPoint = draft.market.find((item) => item.levelId === level.id);
                const point = existingPoint ?? { levelId: level.id, p25: 0, p50: 0, p75: 0 };
                const valid = Boolean(existingPoint && validateMarketPoint(existingPoint));
                return <tr key={level.id}>
                  <td><strong>{level.name}</strong><small>{level.description}</small></td>
                  {(['p25', 'p50', 'p75'] as const).map((field) => <td key={field}><Input aria-label={`${level.name} ${field}`} type="number" min="0" step="1000" value={point[field] || ''} onChange={(event) => updateMarket(level.id, field, numericValue(event.target.value))} /></td>)}
                  <td><div className="market-row-status"><span className={`validation-state ${valid ? 'valid' : existingPoint ? 'invalid' : 'missing'}`}>{valid ? 'Ready' : existingPoint ? 'Check range' : 'Not available'}</span>{existingPoint && <Button type="button" variant="ghost" size="sm" onClick={() => clearMarket(level.id)}>Clear</Button>}</div></td>
                </tr>;
              })}
          </tbody>
        </table>
      </div>
      <p className="editor-note">Rows left blank remain unavailable. Entered rows require positive values satisfying P25 ≤ P50 ≤ P75.</p>
    </div>
  );
}

function AssumptionEditor({ draft, setDraft }: { draft: Workspace; setDraft: (next: Workspace) => void }) {
  const fields: Array<{ key: keyof Omit<HiringAssumption, 'levelId'>; label: string; suffix?: string }> = [
    { key: 'timeToHireDays', label: 'Time to hire', suffix: 'days' },
    { key: 'rampDays', label: 'Ramp time', suffix: 'days' },
    { key: 'vacancyMultiplier', label: 'Vacancy multiplier' },
    { key: 'rampLossFactor', label: 'Ramp loss factor' },
    { key: 'recruitingCost', label: 'Recruiting cost' },
    { key: 'interviewCost', label: 'Interview cost' },
    { key: 'signingCost', label: 'Signing / relocation' },
    { key: 'otherCost', label: 'Other hiring cost' },
  ];
  function update(levelId: string, key: keyof Omit<HiringAssumption, 'levelId'>, value: number | null) {
    const existing = draft.assumptions.find((item) => item.levelId === levelId) ?? {
      levelId, timeToHireDays: null, rampDays: null, vacancyMultiplier: null, rampLossFactor: null,
      recruitingCost: null, interviewCost: null, signingCost: null, otherCost: null,
    };
    setDraft({ ...draft, assumptions: [...draft.assumptions.filter((item) => item.levelId !== levelId), { ...existing, [key]: value }] });
  }
  return <div className="editor-panel">
    <div className="editor-intro">
      <div><strong>Replacement assumptions</strong><p>Planning estimates by level—not observed productivity measures.</p></div>
      <span className="data-badge assumption-badge">Planning assumptions</span>
    </div>
    <div className="assumption-list">
      {[...draft.levels].sort((a, b) => a.order - b.order).map((level) => {
        const assumption = draft.assumptions.find((item) => item.levelId === level.id);
        return <section key={level.id} className="assumption-card">
          <div className="assumption-level"><strong>{level.name}</strong><span>{level.description}</span></div>
          <div className="assumption-grid">
            {fields.map((field) => <label key={field.key}>
              <span>{field.label}</span>
              <div className="input-suffix"><Input type="number" min="0" step={field.key.includes('Factor') || field.key.includes('Multiplier') ? '0.1' : '1'} value={assumption?.[field.key] ?? ''} onChange={(event) => update(level.id, field.key, optionalNumericValue(event.target.value))} />{field.suffix && <small>{field.suffix}</small>}</div>
            </label>)}
          </div>
        </section>;
      })}
    </div>
  </div>;
}

export function WorkspaceDialog({
  open,
  onOpenChange,
  workspace,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  onSave: (workspace: Workspace) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(workspace);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creationKind, setCreationKind] = useState<ContextCreationKind>('dataset');
  const isNewContext =
    draft.organization.id !== workspace.organization.id ||
    draft.laborMarket.id !== workspace.laborMarket.id ||
    draft.discipline.id !== workspace.discipline.id ||
    draft.ladder.id !== workspace.ladder.id ||
    draft.dataset.id !== workspace.dataset.id;

  function startNewContext() {
    setDraft(
      createWorkspaceContext(workspace, creationKind, () => crypto.randomUUID()),
    );
    setError(null);
  }

  function addLevel() {
    const order = Math.max(0, ...draft.levels.map((level) => level.order)) + 1;
    const id = crypto.randomUUID();
    setDraft({
      ...draft,
      levels: [...draft.levels, { id, name: `L${order}`, order, description: '' }],
      assumptions: [...draft.assumptions, { levelId: id, timeToHireDays: null, rampDays: null, vacancyMultiplier: null, rampLossFactor: null, recruitingCost: null, interviewCost: null, signingCost: null, otherCost: null }],
    });
  }

  function removeLevel(levelId: string) {
    if (draft.employees.some((employee) => employee.levelId === levelId)) {
      setError('Move employees out of this level before deleting it.');
      return;
    }
    setDraft({ ...draft, levels: draft.levels.filter((level) => level.id !== levelId), market: draft.market.filter((point) => point.levelId !== levelId), assumptions: draft.assumptions.filter((item) => item.levelId !== levelId) });
  }

  async function save() {
    if (!draft.organization.name.trim() || !draft.laborMarket.name.trim() || !draft.discipline.name.trim() || !draft.ladder.name.trim() || !draft.dataset.name.trim()) {
      setError('Organization, market, discipline, ladder, and dataset names are required.');
      return;
    }
    if (!/^[A-Z]{3}$/.test(draft.organization.currency)) {
      setError('Currency must be a three-letter code such as USD or EUR.');
      return;
    }
    if (!draft.levels.length || draft.levels.some((level) => !level.name.trim() || !Number.isFinite(level.order))) {
      setError('Add at least one named, ordered level.');
      return;
    }
    if (new Set(draft.levels.map((level) => level.order)).size !== draft.levels.length) {
      setError('Each level needs a unique ordering value.');
      return;
    }
    if (draft.market.some((point) => !validateMarketPoint(point))) {
      setError('Entered market ranges must be positive and satisfy P25 ≤ P50 ≤ P75.');
      return;
    }
    setSubmitting(true);
    const saved = await onSave(draft);
    setSubmitting(false);
    if (saved) onOpenChange(false);
    else setError('The workspace could not be saved. Please try again.');
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="management-modal workspace-modal">
      <DialogHeader>
        <DialogTitle>Configure workspace</DialogTitle>
        <DialogDescription>Keep observed employee data, external market data, and planning assumptions explicit and separate.</DialogDescription>
      </DialogHeader>
      <Tabs defaultValue="structure" className="management-tabs">
        <TabsList>
          <TabsTrigger value="structure">Career structure</TabsTrigger>
          <TabsTrigger value="market">Market data</TabsTrigger>
          <TabsTrigger value="assumptions">Assumptions</TabsTrigger>
        </TabsList>
        <TabsContent value="structure">
          <div className="editor-panel structure-editor">
            <div className="editor-intro"><div><strong>Analysis context</strong><p>The active organization, market, and career path.</p></div><span className="data-badge observed-badge">{isNewContext ? 'New context' : 'Configuration'}</span></div>
            <div className="context-create-row">
              <div><strong>Create another context</strong><p>Start a related scope, then review its names and levels before saving.</p></div>
              <Select value={creationKind} onValueChange={(value) => setCreationKind(value as ContextCreationKind)}>
                <SelectTrigger className="dialog-select"><SelectValue>{contextCreationLabels[creationKind]}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="organization">Organization</SelectItem>
                  <SelectItem value="laborMarket">Labor market</SelectItem>
                  <SelectItem value="discipline">Discipline</SelectItem>
                  <SelectItem value="ladder">Career ladder</SelectItem>
                  <SelectItem value="dataset">Market dataset</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={startNewContext}><CopyPlus /> Start new</Button>
            </div>
            <div className="form-grid context-fields">
              <label><span>Organization</span><Input value={draft.organization.name} onChange={(event) => setDraft({ ...draft, organization: { ...draft.organization, name: event.target.value } })} /></label>
              <label><span>Labor market</span><Input value={draft.laborMarket.name} onChange={(event) => setDraft({ ...draft, laborMarket: { ...draft.laborMarket, name: event.target.value } })} /></label>
              <label><span>Discipline</span><Input value={draft.discipline.name} onChange={(event) => setDraft({ ...draft, discipline: { ...draft.discipline, name: event.target.value } })} /></label>
              <label><span>Career ladder</span><Input value={draft.ladder.name} onChange={(event) => setDraft({ ...draft, ladder: { ...draft.ladder, name: event.target.value } })} /></label>
              <label><span>Dataset name</span><Input value={draft.dataset.name} onChange={(event) => setDraft({ ...draft, dataset: { ...draft.dataset, name: event.target.value } })} /></label>
              <label><span>Effective date</span><Input type="date" value={draft.dataset.effectiveDate ?? ''} onChange={(event) => setDraft({ ...draft, dataset: { ...draft.dataset, effectiveDate: event.target.value } })} /></label>
              <label><span>Dataset status</span><Select value={draft.dataset.active ? 'active' : 'inactive'} onValueChange={(value) => setDraft({ ...draft, dataset: { ...draft.dataset, active: value === 'active' } })}><SelectTrigger className="dialog-select" aria-label="Dataset status"><SelectValue>{draft.dataset.active ? 'Active' : 'Inactive'}</SelectValue></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></label>
              <label><span>Currency</span><Input maxLength={3} value={draft.organization.currency} onChange={(event) => setDraft({ ...draft, organization: { ...draft.organization, currency: event.target.value.toUpperCase() } })} placeholder="USD" /></label>
              <label><span>Dataset source <small>optional</small></span><Input value={draft.dataset.source ?? ''} onChange={(event) => setDraft({ ...draft, dataset: { ...draft.dataset, source: event.target.value } })} placeholder="Survey or estimate source" /></label>
              <label><span>Labor market description <small>optional</small></span><Input value={draft.laborMarket.description ?? ''} onChange={(event) => setDraft({ ...draft, laborMarket: { ...draft.laborMarket, description: event.target.value } })} /></label>
              <label><span>Discipline description <small>optional</small></span><Input value={draft.discipline.description ?? ''} onChange={(event) => setDraft({ ...draft, discipline: { ...draft.discipline, description: event.target.value } })} /></label>
              <label><span>Ladder description <small>optional</small></span><Input value={draft.ladder.description ?? ''} onChange={(event) => setDraft({ ...draft, ladder: { ...draft.ladder, description: event.target.value } })} /></label>
              <label className="field-wide"><span>Dataset description <small>optional</small></span><Textarea value={draft.dataset.description ?? ''} onChange={(event) => setDraft({ ...draft, dataset: { ...draft.dataset, description: event.target.value } })} /></label>
            </div>
            <div className="level-heading"><div><strong>Ordered levels</strong><p>Ordering controls horizontal chart position.</p></div><Button variant="outline" size="sm" onClick={addLevel}><Plus /> Add level</Button></div>
            <div className="level-list">
              {[...draft.levels].sort((a, b) => a.order - b.order).map((level) => <div key={level.id} className="level-row">
                <Input aria-label="Level order" className="order-input" type="number" value={level.order} onChange={(event) => setDraft({ ...draft, levels: draft.levels.map((item) => item.id === level.id ? { ...item, order: numericValue(event.target.value) } : item) })} />
                <Input aria-label="Level name" value={level.name} onChange={(event) => setDraft({ ...draft, levels: draft.levels.map((item) => item.id === level.id ? { ...item, name: event.target.value } : item) })} />
                <Input aria-label="Level description" value={level.description ?? ''} placeholder="Description" onChange={(event) => setDraft({ ...draft, levels: draft.levels.map((item) => item.id === level.id ? { ...item, description: event.target.value } : item) })} />
                <Button aria-label={`Delete ${level.name}`} variant="ghost" size="icon-sm" onClick={() => removeLevel(level.id)}><Trash2 /></Button>
              </div>)}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="market"><MarketEditor draft={draft} setDraft={setDraft} /></TabsContent>
        <TabsContent value="assumptions"><AssumptionEditor draft={draft} setDraft={setDraft} /></TabsContent>
      </Tabs>
      {error && <p className="form-error modal-error">{error}</p>}
      <DialogFooter className="management-footer"><span /><div><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} disabled={submitting}><Save /> {submitting ? 'Saving…' : isNewContext ? 'Create context' : 'Save workspace'}</Button></div></DialogFooter>
    </DialogContent>
  </Dialog>;
}
