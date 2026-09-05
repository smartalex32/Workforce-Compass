import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EmployeeDirectory } from '../components/employee-directory';
import { filterEmployees } from './employee-directory';
import { sampleWorkspace } from './sample-data';
import type { Employee, Level } from './domain';

const levels: Level[] = [{ id: 'jr', name: 'Junior', order: -5 }, { id: 'sr', name: 'Principal', order: 20 }];
const employees: Employee[] = [
  { id: 'b', name: 'Zoe Rivera', title: 'Software Engineer', levelId: 'sr', salary: 123456.78 },
  { id: 'a', name: 'Alex Chen', levelId: 'jr', salary: 90000, notes: 'Private context' },
  { id: 'c', name: 'Alex Chen', title: 'Systems Engineer', levelId: 'sr', salary: 150000 },
].map((employee) => ({ ...employee, disciplineId: 'discipline', careerLadderId: 'ladder' }));

describe('employee directory', () => {
  it('combines case-insensitive search terms across name, title, and arbitrary levels', () => {
    expect(filterEmployees(employees, levels, '  ZOE   engineer PRINCIPAL ', null).map((item) => item.id)).toEqual(['b']);
    expect(filterEmployees(employees, levels, 'engineer', 'sr')).toHaveLength(2);
    expect(filterEmployees(employees, levels, 'engineer', 'jr')).toEqual([]);
  });

  it('preserves duplicate names and original observations while sorting results', () => {
    const before = structuredClone(employees);
    expect(filterEmployees(employees, levels, ' ', null).map((item) => item.id)).toEqual(['a', 'c', 'b']);
    expect(employees).toEqual(before);
    expect(filterEmployees(employees, levels, 'private', null)).toEqual([]);
  });

  it('handles empty collections and missing optional titles or unknown levels', () => {
    expect(filterEmployees([], levels, '', null)).toEqual([]);
    expect(filterEmployees(employees, [], 'alex', null)).toHaveLength(2);
    expect(filterEmployees(employees, levels, '', 'deleted')).toEqual([]);
  });

  function render(observations: Employee[]) {
    return renderToStaticMarkup(createElement(EmployeeDirectory, {
      workspace: { ...sampleWorkspace, levels, employees: observations, market: [], assumptions: [] },
      disabled: false, onSelect: () => {}, onEdit: () => {}, onAdd: () => {},
    }));
  }

  it('renders accessible employee actions, precise salaries, and explicit missing comparison states', () => {
    const html = render([employees[0]]);
    expect(html).toContain('aria-label="View Zoe Rivera"');
    expect(html).toContain('aria-label="Edit Zoe Rivera"');
    expect(html).toContain('$123,456.78');
    expect(html).toContain('Not available');
    expect(html).toContain('Insufficient data');
    expect(html).toContain('scope="col"');
  });

  it('explains how to start an empty career ladder', () => {
    expect(render([])).toContain('No employees in this career ladder');
    expect(render([])).toContain('Add employee');
  });
});
