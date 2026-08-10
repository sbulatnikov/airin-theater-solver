import { expect, type Page, test } from '@playwright/test';

async function openSolver(page: Page, path: string): Promise<void> {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.goto(path);
  await page.getByRole('button', { name: 'Начать пьесу' }).click();
  await expect(page.getByRole('heading', { name: 'Следующая реплика' })).toBeVisible();
}

test.describe('v2', () => {
  test('записывает анонимный ход и отменяет его', async ({ page }) => {
    await openSolver(page, '/v2/');
    await page.getByRole('tab', { name: 'Вижу только выбор' }).click();
    const input = page.getByLabel('Какая реплика была выбрана?');
    await input.fill('ck');
    await expect(input).toHaveValue('СК');
    await page.getByRole('button', { name: 'Записать', exact: true }).click();

    await expect(page.locator('.history-item')).toHaveCount(1);
    await expect(page.locator('.score-number')).toHaveText('0');
    await page.getByRole('button', { name: 'Отменить последний ход' }).click();
    await expect(page.locator('.history-item')).toHaveCount(0);
  });

  test('создаёт пригодный для диагностики Base64-снепшот', async ({ page }) => {
    await openSolver(page, '/v2/?private=must-not-leak#fragment');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Скачать снимок игры для диагностики' }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const snapshot = JSON.parse(Buffer.from(Buffer.concat(chunks).toString('ascii'), 'base64').toString('utf8'));

    expect(snapshot.schema).toBe('airin-play-debug-snapshot');
    expect(snapshot.schemaVersion).toBe('1.2.0');
    expect(snapshot.application.variant).toBe('strategy-tree');
    expect(snapshot.session.turnCount).toBe(0);
    expect(snapshot.rules.turnOutcomes).toEqual(['player', 'ai', 'missed']);
    expect(snapshot.environment.page).not.toContain('private');
    expect(snapshot.environment.page).not.toContain('fragment');
  });

  test('учитывает ход ИИ и подтверждённую непрознесённую реплику', async ({ page }) => {
    await openSolver(page, '/v2/');

    const aiInput = page.getByLabel('Какую реплику выбрал ИИ?');
    await aiInput.fill('cc');
    await page.getByRole('button', { name: 'Записать ход ИИ' }).click();
    await expect(page.locator('.history-meta strong').first()).toHaveText('ход ИИ');
    await expect(page.locator('.color-value')).toHaveText(['2', '0', '0']);
    await expect(page.locator('.score-number')).toHaveText('0');

    await page.getByRole('tab', { name: 'Вижу только выбор' }).click();
    const playerInput = page.getByLabel('Какая реплика была выбрана?');
    await playerInput.fill('СС');
    await playerInput.press('Enter');
    await expect(page.locator('.score-number')).toHaveText('1');

    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Реплика не произнесена' }).click();
    await expect(page.locator('.history-item')).toHaveCount(2);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Реплика не произнесена' }).click();
    await expect(page.locator('.history-item')).toHaveCount(3);
    await expect(page.locator('.history-meta strong').first()).toHaveText('реплика не произнесена');
    await expect(page.locator('.history-gain').first()).toHaveText('−1');
    await expect(page.locator('.color-value')).toHaveText(['4', '0', '0']);
    await expect(page.locator('.score-number')).toHaveText('0');

    await playerInput.fill('СС');
    await playerInput.press('Enter');
    await expect(page.locator('.score-number')).toHaveText('1');
    await expect(page.getByText('Предыдущая реплика').locator('..')).toContainText('СС');

    const snapshot = await page.evaluate(() =>
      (
        window as unknown as {
          AirinPlayDebug: {
            buildDebugPayload(): {
              calculations: { turns: Array<{ gain: number; reply: string | null }> };
              integrity: Record<string, boolean>;
              session: { turns: Array<{ outcome?: string }> };
            };
          };
        }
      ).AirinPlayDebug.buildDebugPayload(),
    );
    expect(snapshot.session.turns.map((turn) => turn.outcome)).toEqual(['ai', 'player', 'missed', 'player']);
    expect(snapshot.calculations.turns[2]).toMatchObject({ reply: null, gain: -1 });
    expect(Object.values(snapshot.integrity).every(Boolean)).toBe(true);
  });
});

test('корень направляет на актуальное приложение v2', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/v2\/$/);
  await expect(page.getByRole('button', { name: 'Начать пьесу' })).toBeVisible();
});

test('production artifact не обслуживает удалённый путь v1', async ({ page }) => {
  const response = await page.goto('/v1/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('button', { name: 'Начать пьесу' })).toHaveCount(0);
});

test('v2 рассчитывает рекомендацию после выбора трёх вариантов', async ({ page }) => {
  await openSolver(page, '/v2/');
  await expect(page.locator('.route-step')).toHaveCount(16);
  for (const reply of ['СС', 'СК', 'СЗ']) {
    await page.getByRole('button', { name: `Реплика ${reply}`, exact: true }).click();
  }
  await expect(page.locator('.quick-option.is-selected')).toHaveCount(3);
  await expect(page.locator('.option-card')).toHaveCount(3);
});

test('пьеса завершается ровно после 16 ходов', async ({ page }) => {
  test.setTimeout(60_000);
  await openSolver(page, '/v2/');
  await page.getByRole('tab', { name: 'Вижу только выбор' }).click();
  const input = page.getByLabel('Какая реплика была выбрана?');
  for (let turn = 0; turn < 16; turn += 1) {
    await input.fill('СС');
    await input.press('Enter');
  }

  await expect(page.locator('.history-item')).toHaveCount(16);
  await expect(page.locator('.score-number')).toHaveText('15');
  await expect(page.getByRole('heading', { name: 'Занавес' })).toBeVisible();
  await expect(input).toBeDisabled();
  await expect(page.getByLabel('Какую реплику выбрал ИИ?')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Реплика не произнесена' })).toBeDisabled();
});

test('тема следует системе и сохраняет ручной выбор', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/v2/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Включить светлую тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f4f1eb');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
