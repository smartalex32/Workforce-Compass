'use client';

import { useState } from 'react';
import { Pencil, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Employee, Workspace } from '@/lib/domain';
import { employeeMetrics } from '@/lib/domain';
import { filterEmployees } from '@/lib/employee-directory';

export function EmployeeDirectory({ workspace, disabled, onSelect, onEdit, onAdd }: {
  workspace: Workspace;
  disabled: boolean;
  onSelect: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onAdd: () => void;
}) {
  const [query, setQuery] = useState('');
  const [levelId, setLevelId] = useState<string | null>(null);
  // A removed level must not leave the directory trapped behind a stale filter.
  const activeLevelId = workspace.levels.some((level) => level.id === levelId) ? levelId : null;
  const employees = filterEmployees(workspace.employees, workspace.levels, query, activeLevelId);
  const levels = [...workspace.levels].sort((a, b) => a.order - b.order);
  const currency = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: workspace.organization.currency, maximumFractionDigits: 2,
  });
  const clearFilters = () => { setQuery(''); setLevelId(null); };

  return <section className="employee-directory" aria-labelledby="employee-directory-title" aria-busy={disabled}>
    <div className="employee-directory-heading">
      <div>
        <h2 id="employee-directory-title">Employees</h2>
        <p>Observed salaries · {workspace.discipline.name} / {workspace.ladder.name}</p>
      </div>
      <Button variant="outline" onClick={onAdd} disabled={disabled}><Plus /> Add employee</Button>
    </div>
    <div className="employee-directory-filters">
      <label className="employee-search">
        <span>Search employees</span>
        <div><Search aria-hidden="true" /><Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, title, or level" /></div>
      </label>
      <label>
        <span>Career level</span>
        <Select value={activeLevelId === null ? 'all' : `level:${activeLevelId}`} onValueChange={(value) => setLevelId(value === 'all' ? null : String(value).slice(6))}>
          <SelectTrigger aria-label="Filter employees by career level"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            {levels.map((level) => <SelectItem key={level.id} value={`level:${level.id}`}>{level.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>
      {(query || activeLevelId !== null) && <Button variant="ghost" onClick={clearFilters}>Clear filters</Button>}
      <p role="status">{employees.length} of {workspace.employees.length} employees</p>
    </div>
    <p className="employee-directory-note">Search filters this list only. Charts and team medians use every employee in the selected career ladder.</p>
    {/* Keyboard focus allows scrolling the bounded table on narrow screens. */}
    {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
    <div className="employee-directory-scroll" role="region" aria-label="Employee observations table" tabIndex={0}>
      <table>
        <caption className="sr-only">Employee salary observations with calculated market and internal team comparisons</caption>
        <thead><tr><th scope="col">Employee</th><th scope="col">Level</th><th scope="col">Base salary</th><th scope="col">Market gap</th><th scope="col">Team gap</th><th scope="col">Actions</th></tr></thead>
        <tbody>
          {employees.map((employee) => {
            const metrics = employeeMetrics(workspace, employee);
            const level = workspace.levels.find((item) => item.id === employee.levelId);
            const percent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
            return <tr key={employee.id}>
              <th scope="row"><button className="employee-name-button" disabled={disabled} onClick={() => onSelect(employee)} aria-label={`View ${employee.name}`}>{employee.name}</button><small>{employee.title || 'No title'}</small></th>
              <td>{level?.name ?? 'Not available'}</td>
              <td>{currency.format(employee.salary)}</td>
              <td>{metrics.marketGap ? percent(metrics.marketGap.percent) : 'Not available'}<small>vs. market median</small></td>
              <td>{metrics.teamSampleSize < 2 ? 'Insufficient data' : metrics.teamGap ? percent(metrics.teamGap.percent) : 'Not available'}<small>{metrics.teamSampleSize} at this level</small></td>
              <td><Button variant="ghost" size="sm" disabled={disabled} onClick={() => onEdit(employee)} aria-label={`Edit ${employee.name}`}><Pencil /> Edit</Button></td>
            </tr>;
          })}
          {!employees.length && <tr><td colSpan={6} className="employee-directory-empty">
            <strong>{workspace.employees.length ? 'No matching employees' : 'No employees in this career ladder'}</strong>
            <p>{workspace.employees.length ? 'Try another name, title, or level, or clear the filters.' : 'Add an employee to compare their salary with market data and your team.'}</p>
            {workspace.employees.length > 0 && <Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
          </td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}
