import type { Employee, Level } from './domain';

/** Directory filters never change the observations used by the analysis. */
export function filterEmployees(
  employees: Employee[],
  levels: Level[],
  query: string,
  levelId: string | null,
): Employee[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const levelNames = new Map(levels.map((level) => [level.id, level.name]));
  return employees.filter((employee) => {
    if (levelId !== null && employee.levelId !== levelId) return false;
    const searchable = [employee.name, employee.title ?? '', levelNames.get(employee.levelId) ?? '']
      .join(' ').toLowerCase();
    return terms.every((term) => searchable.includes(term));
  }).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
