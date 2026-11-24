import { expect, test } from '@playwright/test';
import type {
  OfficeWorkspaceCommand,
  OfficeWorkspaceData,
} from '../lib/office-workspace';
import { sampleWorkspace } from '../lib/sample-data';

test('keeps the office roster primary and saves people before they are leveled or paid', async ({
  page,
}) => {
  const workspace: OfficeWorkspaceData = {
    organization: {
      id: 'test-org',
      name: 'Northstar Systems',
      currency: 'USD',
    },
    role: 'admin',
    offices: [],
    markets: [],
    disciplines: [],
    ladders: [],
    levels: [],
    datasets: [],
    people: [],
    bands: [],
  };
  await page.route('**/api/office-workspace*', async (route) => {
    let entityId: string | undefined;
    if (route.request().method() === 'POST') {
      const command = route.request().postDataJSON() as OfficeWorkspaceCommand;
      if (command.action === 'office') {
        entityId = 'chicago';
        workspace.offices.push({
          id: entityId,
          name: command.name,
          laborMarketId: command.laborMarketId,
        });
      }
      if (command.action === 'person') {
        entityId = 'taylor';
        workspace.people[0] = {
          id: entityId,
          name: command.name,
          title: command.title,
          officeId: command.officeId,
          levelId: command.levelId,
          salary: command.salary,
          clearanceLevel: command.clearanceLevel,
          yearsExperience: command.yearsExperience,
          disciplineId: null,
          careerLadderId: null,
        };
      }
      if (command.action === 'organization-settings') {
        workspace.organization.companySize = command.companySize;
      }
    }
    await route.fulfill({
      json: { workspace, organizations: [workspace.organization], entityId },
    });
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'People', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Set up office' }).click();
  await page.getByLabel('Office name').fill('Chicago');
  await page.getByRole('button', { name: 'Create office' }).click();
  await expect(
    page.getByRole('heading', { name: 'No people in this office' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add person' }).click();
  await expect(
    page.getByRole('textbox', { name: 'Name', exact: true }),
  ).toBeFocused();
  await page
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Taylor Briggs');
  await page.getByRole('button', { name: 'Save person' }).click();
  await expect(
    page.getByRole('button', { name: 'Taylor Briggs' }),
  ).toBeVisible();
  expect(workspace.people[0]).toMatchObject({
    officeId: 'chicago',
    levelId: null,
    salary: null,
    clearanceLevel: null,
    yearsExperience: null,
  });
  const profile = page.getByRole('region', { name: 'Person details' });
  await expect(profile.getByText('Not recorded', { exact: true })).toHaveCount(
    2,
  );
  await profile.getByRole('button', { name: 'Edit person' }).click();
  await page
    .getByRole('spinbutton', { name: 'Years of experience' })
    .fill('5.5');
  await page
    .getByRole('combobox', { name: 'Security clearance' })
    .selectOption({ label: 'Secret' });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(profile.getByText('5.5 years', { exact: true })).toBeVisible();
  await expect(profile.getByText('Secret', { exact: true })).toBeVisible();

  const settings = page.getByRole('button', {
    name: 'Organization settings for Northstar Systems',
  });
  await settings.click();
  const companySize = page.getByRole('combobox', { name: 'Company size' });
  await companySize.selectOption({ label: 'Mid-size' });
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Organization settings saved.' }),
  ).toBeVisible();
  expect(workspace.organization.companySize).toBe('mid');

  await page.getByRole('searchbox', { name: 'Search people' }).fill('Taylor');
  await expect(page.getByText('1 of 1 person')).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Taylor Briggs' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Taylor Briggs' }).click();
  await expect(profile.getByText('5.5 years', { exact: true })).toBeVisible();
  await expect(profile.getByText('Secret', { exact: true })).toBeVisible();
  await settings.click();
  await expect(companySize).toHaveValue('mid');
  await page.getByRole('button', { name: 'Analysis', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Analysis' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Open full analysis' }),
  ).toBeVisible();
});

test('shows published pay bands and a separate market median, including when the survey is unavailable', async ({
  page,
}) => {
  const { organization, discipline, ladder, laborMarket, dataset } =
    sampleWorkspace;
  const levels = sampleWorkspace.levels.slice(0, 4);
  const officeId = 'office-bands';
  const bands = [0, 1, 3].map((index) => ({
    levelId: levels[index].id,
    marketId: null,
    date: '2020-01-01',
    values: {
      levelId: levels[index].id,
      min: 70000 + index * 10000,
      mid: null,
      max: 100000 + index * 17000,
    },
  }));
  const workspace: OfficeWorkspaceData = {
    organization,
    role: 'viewer',
    offices: [{ id: officeId, name: 'Chicago', laborMarketId: laborMarket.id }],
    markets: [laborMarket],
    disciplines: [discipline],
    ladders: [{ ...ladder, disciplineId: discipline.id }],
    levels: levels.map((level) => ({
      ...level,
      ladderId: ladder.id,
      code: level.name,
      retired: false,
    })),
    datasets: [{ ...dataset, laborMarketId: laborMarket.id }],
    people: [],
    bands,
  };
  await page.route('**/api/office-workspace*', (route) =>
    route.fulfill({ json: { workspace, organizations: [organization] } }),
  );
  await page.route('**/api/workspace?*', (route) =>
    route.fulfill({ json: { workspace: sampleWorkspace } }),
  );

  await page.goto('/');
  await page.getByRole('button', { name: 'Analysis', exact: true }).click();
  await expect(
    page.getByText('Effective pay band', { exact: true }),
  ).toBeVisible();
  const chart = page.getByRole('img', {
    name: /Employee compensation plotted/,
  });
  const wedges = chart.locator('path.compensation-band');
  await expect(wedges).toHaveCount(2);
  await expect(wedges.last()).toBeVisible();
  await expect(chart.locator('path.market-curve')).toBeVisible();
  await expect(page.getByText('Market P25–P75', { exact: true })).toHaveCount(
    0,
  );

  workspace.bands = [];
  await page.reload();
  await page.getByRole('button', { name: 'Analysis', exact: true }).click();
  await expect(page.getByText('Market P25–P75', { exact: true })).toBeVisible();
  await expect(wedges).toHaveCount(1);

  workspace.datasets = [];
  workspace.bands = bands;
  await page.reload();
  await page.getByRole('button', { name: 'Analysis', exact: true }).click();
  await expect(wedges).toHaveCount(2);
  await expect(page.getByText('Market median', { exact: true })).toHaveCount(0);
  await expect(chart.locator('path.market-curve')).toHaveCount(0);
});
