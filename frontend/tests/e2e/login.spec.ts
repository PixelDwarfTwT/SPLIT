import { expect, test } from "@playwright/test";

test("login page has no public registration path", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Masuk ke Patungan" })).toBeVisible();
  await expect(page.getByLabel("Email administrator")).toBeVisible();
  await expect(page.getByLabel("Kata sandi")).toBeVisible();
  await expect(page.getByRole("button", { name: /daftar|buat akun/i })).toHaveCount(0);
});

test("the calculator route requires an administrator session", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("the login page fits a mobile viewport without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  const scrollWidth = await page.locator("html").evaluate((element) => element.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
  await expect(page.getByRole("button", { name: /masuk/i })).toBeVisible();
});
