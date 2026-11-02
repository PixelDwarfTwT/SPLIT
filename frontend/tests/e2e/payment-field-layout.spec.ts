import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const paymentStyles = await readFile(new URL("../../src/app/globals.css", import.meta.url), "utf8");

test("keeps the full Rp10.000.000 payment field visible on mobile and desktop", async ({ page }) => {
  for (const width of [360, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(`
      <main class="app-shell">
        <article class="payment-card">
          <div class="payment-title">
            <div><h3>Juan</h3><span>Tagihan Rp10.000.000</span></div>
            <label class="payment-field">
              <span class="field-label">Uang dibayar</span>
              <span class="payment-input"><span>Rp</span><input value="10.000.000" /></span>
            </label>
          </div>
        </article>
      </main>
    `);
    await page.addStyleTag({ content: paymentStyles.replace(/^@import[^;]+;\s*/gm, "") });

    const card = await page.locator(".payment-card").boundingBox();
    const field = await page.locator(".payment-input").boundingBox();
    const input = await page.locator(".payment-input input").boundingBox();
    const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

    expect(field?.width, `payment box at ${width}px`).toBeGreaterThanOrEqual(220);
    expect(input?.width, `amount input at ${width}px`).toBeGreaterThanOrEqual(120);
    expect(field!.x + field!.width, `payment box stays in card at ${width}px`).toBeLessThanOrEqual(card!.x + card!.width);
    expect(pageOverflows, `page has no horizontal overflow at ${width}px`).toBe(false);
  }
});
