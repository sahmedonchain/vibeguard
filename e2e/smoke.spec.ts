import { expect, test } from "@playwright/test";

const STATIC = ["/scan", "/methodology", "/sybil", "/whales", "/momentum", "/alerts", "/doctor", "/ecosystem", "/developers", "/developers/api", "/about", "/privacy", "/terms", "/status"];
const ADDR = "0x3c1b3e4383f3Fa90b314dD451332c86b1C779725";

test("landing page renders without fake metrics", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("VibeVibe");
  await expect(page.getByText("not an audit", { exact: false }).first()).toBeVisible();
});

for (const path of STATIC) {
  test(`${path} shows honest unavailable state`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByText(/Coming in phase \d/)).toBeVisible();
  });
}

for (const base of ["/token", "/creator", "/wallet"]) {
  test(`${base}/[address] validates address`, async ({ page }) => {
    expect((await page.goto(`${base}/${ADDR}`))?.status()).toBe(200);
    expect((await page.goto(`${base}/not-an-address`))?.status()).toBe(404);
  });
}

test("every internal nav link resolves", async ({ page, request }) => {
  await page.goto("/");
  const hrefs = await page.$$eval("header a[href^='/'], footer a[href^='/']", (as) => [...new Set(as.map((a) => a.getAttribute("href")!))]);
  expect(hrefs.length).toBeGreaterThan(5);
  for (const h of hrefs) expect((await request.get(h)).status(), h).toBe(200);
});

test("mobile nav opens", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
});
