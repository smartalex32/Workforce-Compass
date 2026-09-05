import type { HiringAssumption, Workspace } from './domain';

export type ContextCreationKind =
  | 'organization'
  | 'laborMarket'
  | 'discipline'
  | 'ladder'
  | 'dataset';

type IdFactory = (entity: string) => string;

function blankAssumption(levelId: string): HiringAssumption {
  return {
    levelId,
    timeToHireDays: null,
    rampDays: null,
    vacancyMultiplier: null,
    rampLossFactor: null,
    recruitingCost: null,
    interviewCost: null,
    signingCost: null,
    otherCost: null,
  };
}

function blankCareerData(idFactory: IdFactory) {
  const levelId = idFactory('level');
  return {
    levels: [{ id: levelId, name: 'L1', order: 1, description: '' }],
    market: [],
    employees: [],
    assumptions: [blankAssumption(levelId)],
  };
}

/**
 * Starts a new analysis context without mutating or replacing its source.
 * IDs are regenerated only for the selected entity and any children that must
 * belong to it; reusable parents remain shared across contexts.
 */
export function createWorkspaceContext(
  source: Workspace,
  kind: ContextCreationKind,
  idFactory: IdFactory,
): Workspace {
  if (kind === 'dataset') {
    return {
      ...source,
      dataset: {
        id: idFactory('dataset'),
        name: 'New market dataset',
        description: '',
        source: '',
        effectiveDate: '',
      },
      market: [],
    };
  }

  if (kind === 'laborMarket') {
    return {
      ...source,
      laborMarket: {
        id: idFactory('laborMarket'),
        name: 'New labor market',
        description: '',
      },
      dataset: {
        id: idFactory('dataset'),
        name: 'New market dataset',
        description: '',
        source: '',
        effectiveDate: '',
      },
      market: [],
    };
  }

  if (kind === 'ladder') {
    return {
      ...source,
      ladder: {
        id: idFactory('ladder'),
        name: 'New career ladder',
        description: '',
      },
      ...blankCareerData(idFactory),
    };
  }

  if (kind === 'discipline') {
    return {
      ...source,
      discipline: {
        id: idFactory('discipline'),
        name: 'New discipline',
        description: '',
      },
      ladder: {
        id: idFactory('ladder'),
        name: 'Individual contributor',
        description: '',
      },
      ...blankCareerData(idFactory),
    };
  }

  return {
    organization: {
      id: idFactory('organization'),
      name: 'New organization',
      currency: source.organization.currency,
    },
    laborMarket: {
      id: idFactory('laborMarket'),
      name: 'New labor market',
      description: '',
    },
    discipline: {
      id: idFactory('discipline'),
      name: 'New discipline',
      description: '',
    },
    ladder: {
      id: idFactory('ladder'),
      name: 'Individual contributor',
      description: '',
    },
    dataset: {
      id: idFactory('dataset'),
      name: 'New market dataset',
      description: '',
      source: '',
      effectiveDate: '',
    },
    ...blankCareerData(idFactory),
  };
}
