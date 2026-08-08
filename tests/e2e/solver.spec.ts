import { expect, type Page, test } from "@playwright/test";

const versions = [
  { name: "v1", path: "/v1/", quickChoice: false },
  { name: "v2", path: "/v2/", quickChoice: true }
] as const;

async function openSolver(page: Page, path: string): Promise<void> {
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  await page.goto(path);
  await page.getByRole("button", { name: "Начать пьесу" }).click();
  await expect(page.getByRole("heading", { name: "Следующая реплика" })).toBeVisible();
}

for (const version of versions) {
  test.describe(version.name, () => {
    test("записывает анонимный ход и отменяет его", async ({ page }) => {
      await openSolver(page, version.path);
      await page.getByRole("tab", { name: "Вижу только выбор" }).click();
      const input = page.getByLabel("Какая реплика была выбрана?");
      await input.fill("ck");
      await expect(input).toHaveValue("СК");
      await page.getByRole("button", { name: "Записать", exact: true }).click();

      await expect(page.locator(".history-item")).toHaveCount(1);
      await expect(page.locator(".score-number")).toHaveText("0");
      await page.getByRole("button", { name: "Отменить последний ход" }).click();
      await expect(page.locator(".history-item")).toHaveCount(0);
    });

    test("создаёт пригодный для диагностики Base64-снепшот", async ({ page }) => {
      await openSolver(page, `${version.path}?private=must-not-leak#fragment`);
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Скачать снимок игры для диагностики" }).click();
      const download = await downloadPromise;
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      const snapshot = JSON.parse(Buffer.from(Buffer.concat(chunks).toString("ascii"), "base64").toString("utf8"));

      expect(snapshot.schema).toBe("airin-play-debug-snapshot");
      expect(snapshot.application.variant).toBe(version.quickChoice ? "strategy-tree" : "classic");
      expect(snapshot.session.turnCount).toBe(0);
      expect(snapshot.environment.page).not.toContain("private");
      expect(snapshot.environment.page).not.toContain("fragment");
    });
  });
}

test("v1 очищает ввод и отклоняет одинаковые варианты", async ({ page }) => {
  await openSolver(page, "/v1/");
  const input = page.getByLabel("Введите 3 варианта из игры");
  await input.fill("КЗ ЗК ЗК УКУ У");
  await expect(input).toHaveValue("КЗ ЗК ЗК");
  await expect(page.getByRole("alert")).toContainText("КЗ и ЗК — один вариант");

  await input.fill("СС СК СЗ");
  await page.getByRole("button", { name: "Рассчитать" }).click();
  await expect(page.locator(".option-card")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: /Что выбрать|Лучшие варианты/ })).toBeVisible();
});

test("v2 рассчитывает рекомендацию после выбора трёх вариантов", async ({ page }) => {
  await openSolver(page, "/v2/");
  await expect(page.locator(".route-step")).toHaveCount(16);
  for (const reply of ["СС", "СК", "СЗ"]) {
    await page.getByRole("button", { name: `Реплика ${reply}`, exact: true }).click();
  }
  await expect(page.locator(".quick-option.is-selected")).toHaveCount(3);
  await expect(page.locator(".option-card")).toHaveCount(3);
});

test("пьеса завершается ровно после 16 реплик", async ({ page }) => {
  test.setTimeout(60_000);
  await openSolver(page, "/v2/");
  await page.getByRole("tab", { name: "Вижу только выбор" }).click();
  const input = page.getByLabel("Какая реплика была выбрана?");
  for (let turn = 0; turn < 16; turn += 1) {
    await input.fill("СС");
    await input.press("Enter");
  }

  await expect(page.locator(".history-item")).toHaveCount(16);
  await expect(page.locator(".score-number")).toHaveText("15");
  await expect(page.getByRole("heading", { name: "Занавес" })).toBeVisible();
  await expect(input).toBeDisabled();
});
