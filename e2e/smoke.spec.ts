import { expect, test } from "@playwright/test";

const COMING_SOON = ["/sybil", "/whales", "/momentum", "/alerts", "/doctor", "/ecosystem", "/developers", "/developers/api", "/about", "/privacy", "/terms", "/status"];
const ADDR = "0x3c1b3e4383f3Fa90b314dD451332c86b1C779725";

test("landing page renders per SRS 6 without fake metrics", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Know the Risk Behind Every Token.");
  await expect(page.getByRole("button", { name: /Scan a Token/ })).toBeVisible();
  await expect(page.getByText("illustrative data, not a real token")).toBeVisible();
  await expect(page.getByText("not an audit", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Robinhood Chain Testnet").first()).toBeVisible();
});

test("hero search forwards a valid address to the scanner", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Token contract address").fill(ADDR);
  await page.getByRole("button", { name: /Scan a Token/ }).click();
  await expect(page).toHaveURL(new RegExp(`/scan\\?address=${ADDR}`));
  await expect(page.getByLabel("Token contract address")).toHaveValue(ADDR);
});

for (const path of COMING_SOON) {
  test(`${path} shows honest unavailable state`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByText(/Coming in phase \d/)).toBeVisible();
  });
}

test("scanner shows a helpful error for invalid input", async ({ page }) => {
  await page.goto("/scan");
  await page.getByLabel("Token contract address").fill("0x123");
  await page.getByRole("button", { name: "Scan token" }).click();
  await expect(page.locator("#scan-error")).toContainText("not a valid address");
  await expect(page).toHaveURL(/\/scan$/);
});

test("methodology page documents weights, levels and rules", async ({ page }) => {
  await page.goto("/methodology");
  await expect(page.getByRole("heading", { name: "Risk methodology" })).toBeVisible();
  await expect(page.getByText("Contract permissions and behavior").first()).toBeVisible();
  await expect(page.getByText("Critical risk")).toBeVisible();
  await expect(page.getByText("VG-HLD-001")).toBeVisible();
  await expect(page.getByText("Unknown is never safe", { exact: false })).toBeVisible();
});

for (const base of ["/token", "/creator", "/wallet"]) {
  test(`${base}/[address] validates address`, async ({ page }) => {
    expect((await page.goto(`${base}/${ADDR}`))?.status()).toBe(200);
    expect((await page.goto(`${base}/not-an-address`))?.status()).toBe(404);
    expect((await page.goto(`${base}/${"0x" + "g".repeat(40)}`))?.status()).toBe(404);
  });
}

test("token report route loads directly and states scan availability honestly", async ({ page }) => {
  await page.goto(`/token/${"0x" + "1".repeat(40)}`);
  await expect(page.getByText(/No scan yet|Scanning is unavailable|Scan queued|Scanning…/)).toBeVisible();
});

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

test("no horizontal overflow on mobile for core pages", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  for (const p of ["/", "/scan", "/methodology", `/token/${ADDR}`]) {
    await page.goto(p);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, p).toBeLessThanOrEqual(0);
  }
});
