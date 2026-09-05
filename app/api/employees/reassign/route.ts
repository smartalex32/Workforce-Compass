import { env } from 'cloudflare:workers';
import { authorizeApiRequest } from '@/lib/api-auth';
import type { Employee } from '@/lib/domain';
import { reassignEmployee } from '@/lib/workspace-repository';

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
      (value.title === undefined || typeof value.title === 'string') &&
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
    input.employee.salary <= 0
  ) {
    return Response.json(
      { error: 'A complete employee reassignment is required.' },
      { status: 400 },
    );
  }

  const employee = { ...input.employee, name: input.employee.name.trim() };
  const moved = await reassignEmployee(env.DB, {
    organizationId: input.organizationId,
    sourceDisciplineId: input.sourceDisciplineId,
    sourceCareerLadderId: input.sourceCareerLadderId,
    employee,
  });

  if (!moved) {
    return Response.json(
      { error: 'The employee or target career scope was not found.' },
      { status: 404 },
    );
  }

  return Response.json({ employee });
}
