import { expect, test } from '@playwright/test';
import { sampleWorkspace } from '../lib/sample-data';
import type { Workspace } from '../lib/domain';

test('completes the primary compensation planning workflow and reloads saved data', async ({ page }) => {
  let persisted = structuredClone(sampleWorkspace) as Workspace;

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/workspace/contexts') {
      await route.fulfill({
        json: {
          contexts: {
            organizations: [{ ...persisted.organization, defaultLaborMarketId: persisted.laborMarket.id }],
            laborMarkets: [{ ...persisted.laborMarket, organizationId: persisted.organization.id }],
            disciplines: [
              { ...persisted.discipline, organizationId: persisted.organization.id },
              { id: 'discipline-product', name: 'Product Management', organizationId: persisted.organization.id },
            ],
            ladders: [
              { ...persisted.ladder, disciplineId: persisted.discipline.id },
              { id: 'ladder-product', name: 'Product IC', disciplineId: 'discipline-product' },
            ],
            levels: [
              ...persisted.levels.map((level) => ({ ...level, careerLadderId: persisted.ladder.id })),
              { id: 'product-p1', name: 'P1', order: 1, careerLadderId: 'ladder-product' },
            ],
            datasets: [{ ...persisted.dataset, laborMarketId: persisted.laborMarket.id }],
          },
        },
      });
      return;
    }
    if (url.pathname === '/api/planning') {
      await route.fulfill({ json: {
        state: { version: 1, members: [], scenarios: [], hiringHistory: [], productivityCurves: [], geographicDifferentials: [], integrations: [] },
        role: 'admin',
        history: { snapshots: [], salaryChanges: [], auditEvents: [] },
      } });
      return;
    }
    if (url.pathname === '/api/workspace' && request.method() === 'PUT') {
      const body = request.postDataJSON() as { workspace: Workspace };
      persisted = structuredClone(body.workspace);
      await route.fulfill({ json: { workspace: persisted, savedAt: new Date().toISOString() } });
      return;
    }
    if (url.pathname === '/api/workspace') {
      await route.fulfill({ json: { workspace: persisted } });
      return;
    }
    if (url.pathname === '/api/employees/reassign' && request.method() === 'POST') {
      const body = request.postDataJSON() as { employee: Workspace['employees'][number] };
      persisted.employees = persisted.employees.filter((employee) => employee.id !== body.employee.id);
      await route.fulfill({ json: { employee: body.employee } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: 'Not mocked' } });
  });

  await page.goto('/');
  await expect(page.getByText('Workforce Compass', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Compensation curve' })).toBeVisible();
  await expect(page.getByLabel('Employee compensation plotted against the selected market range and team median curve')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workforce planning center' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Employees', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add employee' }).first()).toBeEnabled();
  const contextSelects = page.getByRole('region', { name: 'Analysis filters' }).getByRole('combobox');
  await expect(contextSelects.nth(0)).toContainText('Northstar Systems');
  await expect(contextSelects.nth(1)).toContainText('Huntsville, AL');
  await expect(contextSelects.nth(2)).toContainText('Software Engineering');
  await expect(contextSelects.nth(3)).toContainText('Individual Contributor');
  await expect(contextSelects.nth(4)).toContainText('2026 Market Survey');

  const fixedLayoutBeforeScroll = await page.evaluate(() => ({
    documentScrollTop: document.scrollingElement?.scrollTop ?? 0,
    headerTop: document.querySelector('.app-header')?.getBoundingClientRect().top,
    sidebarTop: document.querySelector('.workspace-sidebar')?.getBoundingClientRect().top,
  }));
  await page.locator('.app-main-scroll').evaluate((element) => element.scrollTo({ top: 500 }));
  const fixedLayoutAfterScroll = await page.evaluate(() => ({
    documentScrollTop: document.scrollingElement?.scrollTop ?? 0,
    headerTop: document.querySelector('.app-header')?.getBoundingClientRect().top,
    sidebarTop: document.querySelector('.workspace-sidebar')?.getBoundingClientRect().top,
    mainScrollTop: document.querySelector('.app-main-scroll')?.scrollTop ?? 0,
  }));
  expect(fixedLayoutAfterScroll).toMatchObject({
    documentScrollTop: fixedLayoutBeforeScroll.documentScrollTop,
    headerTop: fixedLayoutBeforeScroll.headerTop,
    sidebarTop: fixedLayoutBeforeScroll.sidebarTop,
  });
  expect(fixedLayoutAfterScroll.mainScrollTop).toBeGreaterThan(0);
  await page.locator('.app-main-scroll').evaluate((element) => element.scrollTo({ top: 0 }));

  await page.locator('.workspace-sidebar').hover();
  await page.mouse.wheel(0, 500);
  await expect.poll(() => page.evaluate(() => ({
    documentScrollTop: document.scrollingElement?.scrollTop ?? 0,
    mainScrollTop: document.querySelector('.app-main-scroll')?.scrollTop ?? 0,
  }))).toEqual({ documentScrollTop: 0, mainScrollTop: 0 });

  const appNavigation = page.getByRole('navigation', { name: 'Application pages' });
  await page.locator('.app-main-scroll').evaluate((element) => element.scrollTo({ top: 500 }));
  await appNavigation.getByRole('button', { name: 'Employees' }).click();
  await expect(page.getByRole('heading', { name: 'Employees', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Compensation curve' })).toHaveCount(0);
  await expect(appNavigation.getByRole('button', { name: 'Employees' })).toHaveAttribute('aria-current', 'page');
  expect(await page.locator('.app-main-scroll').evaluate((element) => element.scrollTop)).toBe(0);
  expect(await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0)).toBe(0);

  await page.getByRole('button', { name: 'Add employee' }).first().click();
  await expect(page.getByRole('heading', { name: 'Add employee' })).toBeVisible();
  await expect(page.getByLabel('Employee career level')).toContainText('L1');
  await page.getByLabel('Name').fill('Taylor Morgan');
  await page.getByLabel('Title').fill('Software Engineer');
  await page.getByLabel('Employee career level').click();
  await page.getByRole('option', { name: 'L3' }).click();
  await page.getByLabel('Annual base salary').fill('137500');
  await page.getByLabel('Annual bonus').fill('12500');
  await page.getByLabel('Location').fill('Chicago, IL');
  await page.getByLabel('Start date').fill('2024-06-15');
  await page.getByRole('button', { name: 'Save employee' }).click();
  await expect(page.getByRole('button', { name: 'View Taylor Morgan' })).toBeVisible();
  expect(persisted.employees.find((employee) => employee.name === 'Taylor Morgan')).toMatchObject({ annualBonus: 12500, location: 'Chicago, IL', startDate: '2024-06-15' });

  await page.getByRole('button', { name: 'View Taylor Morgan' }).click();
  const employeeDetail = page.getByRole('dialog', { name: 'Taylor Morgan' });
  await expect(employeeDetail.getByText('Estimated replacement cost', { exact: true })).toBeVisible();
  await expect(employeeDetail.getByText('Market gap', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Edit Maya Chen' }).click();
  await expect(page.getByLabel('Employee discipline')).toContainText('Software Engineering');
  await expect(page.getByLabel('Employee career ladder')).toContainText('Individual Contributor');
  await page.getByLabel('Employee discipline').click();
  await page.getByRole('option', { name: 'Product Management' }).click();
  await page.getByRole('button', { name: 'Save employee' }).click();
  await expect(page.getByRole('button', { name: 'View Maya Chen' })).toHaveCount(0);

  await appNavigation.getByRole('button', { name: 'Planning center' }).click();
  await expect(page.getByRole('heading', { name: 'Workforce planning center' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Employees', exact: true })).toHaveCount(0);
  expect(await page.locator('.app-main-scroll').evaluate((element) => element.scrollTop)).toBe(0);

  await appNavigation.getByRole('button', { name: 'Replacement exposure' }).click();
  await expect(page.getByRole('heading', { name: 'Replacement exposure' })).toBeVisible();
  await page.locator('.app-main-scroll').evaluate((element) => element.scrollTo({ top: 500 }));
  await appNavigation.getByRole('button', { name: 'Market gap × cost' }).click();
  await expect(page.getByRole('heading', { name: 'Where gaps and costs compound' })).toBeVisible();
  expect(await page.locator('.app-main-scroll').evaluate((element) => element.scrollTop)).toBe(0);

  await page.getByRole('button', { name: 'Configure workspace' }).last().click();
  await page.getByLabel('Dataset status').click();
  await page.getByRole('option', { name: 'Inactive' }).click();
  await page.getByRole('button', { name: 'Save workspace' }).click();
  expect(persisted.dataset.active).toBe(false);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Add employee' }).first()).toBeEnabled();
  await appNavigation.getByRole('button', { name: 'Employees' }).click();
  await expect(page.getByRole('button', { name: 'View Taylor Morgan' })).toBeVisible();
});
