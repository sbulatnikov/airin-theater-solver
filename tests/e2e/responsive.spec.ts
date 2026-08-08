import { expect, type Page, test } from "@playwright/test";

const viewports = [
  { name: "ultrawide-3440", width: 3440, height: 1440, twoColumns: true },
  { name: "full-hd", width: 1920, height: 1080, twoColumns: true },
  { name: "square", width: 1024, height: 1024, twoColumns: false },
  { name: "four-three", width: 1024, height: 768, twoColumns: false },
  { name: "phone-portrait", width: 390, height: 844, twoColumns: false },
  { name: "phone-landscape", width: 844, height: 390, twoColumns: false }
] as const;

async function open(page: Page, path: string): Promise<void> {
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  await page.goto(path);
  await page.getByRole("button", { name: "Начать пьесу" }).click();
}

for (const path of ["/v1/", "/v2/"]) {
  for (const viewport of viewports) {
    test(`${path} не переполняет ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await open(page, path);

      const metrics = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      }));
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);

      const turnPanel = await page.locator(".turn-panel").boundingBox();
      const sideStack = await page.locator(".side-stack").boundingBox();
      expect(turnPanel).not.toBeNull();
      expect(sideStack).not.toBeNull();
      if (!turnPanel || !sideStack) return;
      if (viewport.twoColumns) expect(sideStack.x).toBeGreaterThan(turnPanel.x + turnPanel.width - 2);
      else expect(sideStack.y).toBeGreaterThan(turnPanel.y + turnPanel.height - 2);

      if (viewport.width === 3440) {
        const shell = await page.locator(".app-shell").boundingBox();
        expect(shell?.width).toBeGreaterThanOrEqual(2600);
      }

      if (viewport.width < 900) {
        const undersizedTargets = await page
          .locator("button:visible, input:visible, summary:visible")
          .evaluateAll((elements) =>
            elements
              .map((element) => ({
                label: element.getAttribute("aria-label") ?? element.textContent?.trim(),
                rect: element.getBoundingClientRect()
              }))
              .filter(({ rect }) => rect.width < 44 || rect.height < 44)
              .map(({ label, rect }) => ({ label, width: rect.width, height: rect.height }))
          );
        expect(undersizedTargets).toEqual([]);
      }
    });
  }
}
