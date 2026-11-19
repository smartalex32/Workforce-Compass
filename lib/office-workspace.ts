import type { Employee, Workspace } from './domain';
import type { PlanningRole } from './workforce-planning';

export type Office = { id: string; name: string; laborMarketId: string | null };
export type OfficeLadder = { id: string; name: string; disciplineId: string };
export type OfficeLevel = {
  id: string;
  ladderId: string;
  code: string;
  name: string;
  order: number;
  description?: string;
  retired: boolean;
};
export type OfficeDataset = Workspace['dataset'] & { laborMarketId: string };
export type RosterPerson = Omit<
  Employee,
  'disciplineId' | 'careerLadderId' | 'levelId' | 'salary'
> & {
  officeId: string | null;
  disciplineId: string | null;
  careerLadderId: string | null;
  levelId: string | null;
  salary: number | null;
};
export type BandValues = {
  levelId: string;
  min: number;
  mid: number | null;
  max: number;
};
export type PayBandVersion = {
  levelId: string;
  marketId: string | null;
  date: string;
  values: BandValues | null;
};

export type OfficeWorkspaceData = {
  organization: Workspace['organization'];
  revision?: number;
  role: PlanningRole;
  offices: Office[];
  markets: Workspace['laborMarket'][];
  disciplines: Workspace['discipline'][];
  ladders: OfficeLadder[];
  levels: OfficeLevel[];
  datasets: OfficeDataset[];
  people: RosterPerson[];
  bands: PayBandVersion[];
};
export type OfficeWorkspaceResponse = {
  organizations: { id: string; name: string }[];
  workspace: OfficeWorkspaceData | null;
  entityId?: string;
};

export type OfficeWorkspaceScopedCommand =
  | {
      action: 'office';
      id?: string;
      name: string;
      laborMarketId: string | null;
    }
  | { action: 'market'; name: string }
  | {
      action: 'person';
      id?: string;
      name: string;
      officeId: string;
      title?: string;
      levelId: string | null;
      salary: number | null;
    }
  | { action: 'assign'; assignments: { personId: string; officeId: string }[] }
  | {
      action: 'ladder';
      disciplineId?: string;
      disciplineName?: string;
      name: string;
      template: 'engineering' | 'blank';
    }
  | {
      action: 'level';
      ladderId: string;
      id?: string;
      code: string;
      name: string;
      description?: string;
      position: number;
    }
  | { action: 'retire-level' | 'delete-level'; id: string }
  | {
      action: 'publish-bands';
      marketId: string | null;
      date: string;
      rows: BandValues[];
    }
  | {
      action: 'end-band-override';
      marketId: string;
      date: string;
      levelId: string;
    };

export type OfficeWorkspaceCommand =
  | { action: 'organization'; name: string; currency: string }
  | (OfficeWorkspaceScopedCommand & { organizationId: string; revision?: number });
export type OfficeWorkspaceSave = (
  command: OfficeWorkspaceScopedCommand,
) => Promise<boolean>;

export function formText(form: FormData, field: string) {
  const value = form.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

export function utcDate() {
  return new Date().toISOString().slice(0, 10);
}

export function bandAt(
  bands: PayBandVersion[],
  levelId: string,
  marketId: string | null,
  date: string,
): PayBandVersion | undefined {
  return bands.reduce<PayBandVersion | undefined>(
    (latest, band) =>
      band.levelId === levelId &&
      band.marketId === marketId &&
      band.date <= date &&
      (!latest || band.date > latest.date)
        ? band
        : latest,
    undefined,
  );
}

export function effectivePayBand(
  bands: PayBandVersion[],
  levelId: string,
  marketId: string | null,
  date: string,
): PayBandVersion | undefined {
  const override = marketId
    ? bandAt(bands, levelId, marketId, date)
    : undefined;
  return override?.values ? override : bandAt(bands, levelId, null, date);
}

export function suggestOfficeMatches(
  people: RosterPerson[],
  offices: Office[],
) {
  const normalize = (value: string) =>
    value.trim().replace(/\s+/g, ' ').toLowerCase();
  return people.flatMap((person) => {
    if (person.officeId || !person.location?.trim()) return [];
    const location = normalize(person.location);
    const matches = offices.filter(
      (office) => normalize(office.name) === location,
    );
    return matches.length === 1
      ? [{ personId: person.id, officeId: matches[0].id }]
      : [];
  });
}
