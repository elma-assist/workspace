import { test, expect } from "@playwright/test";

test("privacy consent appears once without changing the live demo", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("elma-site-privacy-v1"));
  await page.reload();
  const popup = page.getByRole("dialog", {
    name: "Your data. Your choice.",
  });
  await expect(popup).toBeVisible();
  await page
    .getByRole("button", { name: "Try Elma", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Start a chat", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Accept all", exact: true }).click();
  await expect(popup).toBeHidden();
  await page.reload();
  await expect(popup).toBeHidden();
  await page
    .getByRole("button", { name: "Privacy choices", exact: true })
    .click();
  await expect(popup).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accept all", exact: true }),
  ).toBeVisible();
});

test("workflow animation advances, pauses and supports manual navigation without moving layout", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  const demo = page.locator(".workflow");
  await demo.scrollIntoViewIfNeeded();
  await expect(demo).toHaveAttribute("data-playing", "true");
  const initial = (await demo.boundingBox())!;
  await page.clock.runFor(6800);
  await expect(demo).toHaveAttribute("data-step", "1");
  await page
    .getByRole("button", { name: "Pause animation", exact: true })
    .click();
  const progress = await demo.getAttribute("style");
  await page.clock.runFor(7000);
  await expect(demo).toHaveAttribute("data-step", "1");
  expect(await demo.getAttribute("style")).toBe(progress);
  for (let step = 0; step < 4; step++) {
    await page.locator(`[data-step-button="${step}"]`).click();
    await expect(demo).toHaveAttribute("data-step", String(step));
    expect((await demo.boundingBox())!.height).toBe(initial.height);
    await expect(page.locator('.scene[aria-hidden="false"]')).toHaveCount(1);
  }
  await expect(page.locator(".scene.is-active")).toContainText("Staff review");
  await page
    .getByRole("button", { name: "Play animation", exact: true })
    .click();
  await page.clock.runFor(6800);
  await expect(
    page.getByRole("button", { name: "Replay animation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Replay animation" }).click();
  await expect(demo).toHaveAttribute("data-step", "0");
  await page.locator("footer").scrollIntoViewIfNeeded();
  await expect(demo).toHaveAttribute("data-playing", "false");
  const offscreenProgress = await demo.getAttribute("style");
  await page.clock.runFor(1000);
  expect(await demo.getAttribute("style")).toBe(offscreenProgress);
  await demo.scrollIntoViewIfNeeded();
  await expect(demo).toHaveAttribute("data-playing", "true");
  await page.clock.runFor(1500);
  await page.screenshot({
    path: "artifacts/landing-redesign/desktop.png",
    fullPage: true,
  });
});

test("reduced motion stays still and live demo is distinct from the workflow concept", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".workflow")).toHaveAttribute(
    "data-playing",
    "false",
  );
  await expect(
    page.getByRole("button", { name: "Play animation", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Step 3: Collect" }).click();
  await expect(page.locator(".scene.is-active")).toContainText(
    "Resident checks details and submits",
  );
  await expect(page.locator(".workflow-caption")).toContainText(
    "Try real forms in the live widget",
  );
  await page
    .getByRole("button", { name: "Try Elma", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Start a chat", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const ids = await page.locator("svg use").evaluateAll((nodes) =>
    nodes
      .map((n) => n.getAttribute("href")!)
      .filter((h) => h.startsWith("/icons.svg#"))
      .map((h) => h.split("#")[1]),
  );
  const sprite = await (await page.request.get("/icons.svg")).text();
  for (const id of ids) expect(sprite).toContain(`id="${id}"`);
});
