import { env } from 'cloudflare:workers';
import { authorizeApiRequest } from '@/lib/api-auth';
import type { Employee } from '@/lib/domain';
import { reassignEmployee } from '@/lib/workspace-repository';
import { canEditPlanning, loadPlanningState, planningActor, planningRoleFor } from '@/lib/planning-repository';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isEmployee(value: unknown): value is Employee {
  return Boolean(
    isRecord(value) &&
      typeof value.id === 'string' &&
      typeof value.name === 'string' &&
      typeof value.disciplineId === 'string' &&
      typeof value.careerLadderId === 'string' &&
      typeof value.levelId === 'string' &&
      typeof value.salary === 'number' &&
      Number.isFinite(value.salary) &&
      (value.employeeNumber === undefined || typeof value.employeeNumber === 'string') &&
      (value.title === undefined || typeof value.title === 'string') &&
      [value.annualBonus, value.annualEquity, value.annualBenefits, value.performanceRating].every((item) => item === undefined || (typeof item === 'number' && Number.isFinite(item))) &&
      (value.location === undefined || typeof value.location === 'string') &&
      (value.startDate === undefined || typeof value.startDate === 'string') &&
      (value.team === undefined || typeof value.team === 'string') &&
      (value.managerId === undefined || typeof value.managerId === 'string') &&
      (value.notes === undefined || typeof value.notes === 'string'),
  );
}

export async function POST(request: Request) {
  const unauthorized = authorizeApiRequest(request, env);
  if (unauthorized) return unauthorized;

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json(
      { error: 'The request body must be valid JSON.' },
      { status: 400 },
    );
  }

  if (
    !isRecord(input) ||
    typeof input.organizationId !== 'string' ||
    typeof input.sourceDisciplineId !== 'string' ||
    typeof input.sourceCareerLadderId !== 'string' ||
    !isEmployee(input.employee) ||
    !input.organizationId.trim() ||
    !input.sourceDisciplineId.trim() ||
    !input.sourceCareerLadderId.trim() ||
    !input.employee.id.trim() ||
    !input.employee.name.trim() ||
    !input.employee.disciplineId.trim() ||
    !input.employee.careerLadderId.trim() ||
    !input.employee.levelId.trim() ||
    input.employee.salary <= 0 ||
    [input.employee.annualBonus, input.employee.annualEquity, input.employee.annualBenefits].some((value) => value !== undefined && value < 0) ||
    (input.employee.performanceRating !== undefined && (input.employee.performanceRating < 0 || input.employee.performanceRating > 5)) ||
    (input.employee.startDate !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(input.employee.startDate) || !Number.isFinite(new Date(`${input.employee.startDate}T00:00:00Z`).getTime()) || new Date(`${input.employee.startDate}T00:00:00Z`).toISOString().slice(0, 10) !== input.employee.startDate)) ||
    input.employee.managerId === input.employee.id
  ) {
    return Response.json(
      { error: 'A complete employee reassignment is required.' },
      { status: 400 },
    );
  }

  const planning = await loadPlanningState(env.DB, input.organizationId);
  if (!canEditPlanning(planningRoleFor(planning, planningActor(request, env.WORKFORCE_COMPASS_TRUSTED_USER_HEADER)))) {
    return Response.json({ error: 'Analyst or admin access is required.' }, { status: 403 });
  }

  const employee = { ...input.employee, name: input.employee.name.trim() };
  const moved = await reassignEmployee(env.DB, {
    organizationId: input.organizationId,
    sourceDisciplineId: input.sourceDisciplineId,
    sourceCareerLadderId: input.sourceCareerLadderId,
    employee,
    actor: planningActor(request, env.WORKFORCE_COMPASS_TRUSTED_USER_HEADER),
  });

  if (!moved) {
    return Response.json(
      { error: 'The employee or target career scope was not found.' },
      { status: 404 },
    );
  }

  return Response.json({ employee });
}
