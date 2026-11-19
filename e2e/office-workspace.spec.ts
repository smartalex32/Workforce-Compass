import { expect, test } from '@playwright/test';
import type {
  OfficeWorkspaceCommand,
  OfficeWorkspaceData,
} from '../lib/office-workspace';

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
        workspace.people.push({
          id: entityId,
          name: command.name,
          title: command.title,
          officeId: command.officeId,
          levelId: command.levelId,
          salary: command.salary,
          disciplineId: null,
          careerLadderId: null,
        });
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
  });
  await page.getByRole('searchbox', { name: 'Search people' }).fill('Taylor');
  await expect(page.getByText('1 of 1 person')).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Taylor Briggs' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Analysis', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Analysis' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Open full analysis' }),
  ).toBeVisible();
});
