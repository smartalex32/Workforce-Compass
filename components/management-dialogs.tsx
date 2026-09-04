'use client';

import { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
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
  employee,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  employee?: Employee | null;
  onSave: (employee: Employee) => Promise<boolean>;
  onDelete?: (employeeId: string) => Promise<boolean>;
}) {
  const blankEmployee: Employee = {
    id: crypto.randomUUID(),
    name: '',
    title: '',
    levelId: workspace.levels[0]?.id ?? '',
    salary: 0,
    notes: '',
  };
  const [draft, setDraft] = useState<Employee>(employee ?? blankEmployee);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!draft.name.trim() || draft.salary <= 0 || !draft.levelId) {
      setError('Name, level, and a positive base salary are required.');
      return;
    }
    setSubmitting(true);
    const saved = await onSave({ ...draft, name: draft.name.trim() });
    setSubmitting(false);
    if (saved) onOpenChange(false);
    else setError('The employee could not be saved. Please try again.');
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="management-modal employee-modal">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{employee ? 'Edit employee' : 'Add employee'}</DialogTitle>
              <DialogDescription>
                Employee observations are shown as points and remain separate from the estimated team curve.
              </DialogDescription>
            </DialogHeader>
            <div className="form-grid">
              <label className="field-wide">
                <span>Name</span>
                <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Employee name" />
              </label>
              <label>
                <span>Title <small>optional</small></span>
                <Input value={draft.title ?? ''} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Senior Software Engineer" />
              </label>
              <label>
                <span>Career level</span>
                <Select value={draft.levelId} onValueChange={(value) => setDraft({ ...draft, levelId: String(value) })}>
                  <SelectTrigger className="dialog-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[...workspace.levels].sort((a, b) => a.order - b.order).map((level) => (
                      <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label>
                <span>Annual base salary</span>
                <Input type="number" min="1" step="1000" value={draft.salary || ''} onChange={(event) => setDraft({ ...draft, salary: numericValue(event.target.value) })} placeholder="165000" />
              </label>
              <label className="field-wide">
                <span>Notes <small>optional</small></span>
                <Textarea value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Context that should accompany this observation" />
              </label>
            </div>
            {error && <p className="form-error">{error}</p>}
            <DialogFooter className="management-footer">
              {employee && onDelete ? (
                <Button type="button" variant="ghost" className="delete-button" onClick={() => setDeleteOpen(true)}><Trash2 /> Delete</Button>
              ) : <span />}
              <div>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}><Save /> {submitting ? 'Saving…' : 'Save employee'}</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {employee?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the employee observation from every analysis view. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={async () => {
              if (!employee || !onDelete) return;
              const deleted = await onDelete(employee.id);
              if (deleted) {
                setDeleteOpen(false);
                onOpenChange(false);
              }
            }}>Delete employee</AlertDialogAction>
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
                  <td><span className={`validation-state ${valid ? 'valid' : existingPoint ? 'invalid' : 'missing'}`}>{valid ? 'Ready' : existingPoint ? 'Check range' : 'Not available'}</span></td>
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
            <div className="editor-intro"><div><strong>Analysis context</strong><p>The active organization, market, and career path.</p></div><span className="data-badge observed-badge">Configuration</span></div>
            <div className="form-grid context-fields">
              <label><span>Organization</span><Input value={draft.organization.name} onChange={(event) => setDraft({ ...draft, organization: { ...draft.organization, name: event.target.value } })} /></label>
              <label><span>Labor market</span><Input value={draft.laborMarket.name} onChange={(event) => setDraft({ ...draft, laborMarket: { ...draft.laborMarket, name: event.target.value } })} /></label>
              <label><span>Discipline</span><Input value={draft.discipline.name} onChange={(event) => setDraft({ ...draft, discipline: { ...draft.discipline, name: event.target.value } })} /></label>
              <label><span>Career ladder</span><Input value={draft.ladder.name} onChange={(event) => setDraft({ ...draft, ladder: { ...draft.ladder, name: event.target.value } })} /></label>
              <label><span>Dataset name</span><Input value={draft.dataset.name} onChange={(event) => setDraft({ ...draft, dataset: { ...draft.dataset, name: event.target.value } })} /></label>
              <label><span>Effective date</span><Input type="date" value={draft.dataset.effectiveDate ?? ''} onChange={(event) => setDraft({ ...draft, dataset: { ...draft.dataset, effectiveDate: event.target.value } })} /></label>
              <label><span>Currency</span><Input maxLength={3} value={draft.organization.currency} onChange={(event) => setDraft({ ...draft, organization: { ...draft.organization, currency: event.target.value.toUpperCase() } })} placeholder="USD" /></label>
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
      <DialogFooter className="management-footer"><span /><div><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} disabled={submitting}><Save /> {submitting ? 'Saving…' : 'Save workspace'}</Button></div></DialogFooter>
    </DialogContent>
  </Dialog>;
}
