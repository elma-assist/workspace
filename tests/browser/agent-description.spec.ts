import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("agent editor saves a public description separately from private instructions", async ({
  page,
}) => {
  const password = readFileSync("infra/local/runtime.env", "utf8")
    .split("\n")
    .find((line) => line.startsWith("SEED_PASSWORD="))!
    .slice("SEED_PASSWORD=".length);
  await page.request.post("/api/auth/login", {
    data: { email: "admin@example.com", password },
  });
  const org = await (
    await page.request.post("/api/organizations", {
      data: { name: `Avatar test ${Date.now()}` },
    })
  ).json();
  const agent = await (
    await page.request.post(`/api/organizations/${org.id}/agents`, {
      data: { name: "Helper", instruction: "Private instructions" },
    })
  ).json();
  const url = `/app/${org.slug}/agents/${agent.id}/edit`;
  await page.goto(url);
  await page
    .getByLabel("Short description", { exact: true })
    .fill("Helps your team with customer questions.");
  await page.getByRole("button", { name: "Save agent", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto(url);
  await expect(
    page.getByLabel("Short description", { exact: true }),
  ).toHaveValue("Helps your team with customer questions.");
  await expect(page.getByLabel(/^Role & instructions/)).toHaveValue(
    "Private instructions",
  );
});

test("mobile header shows description, keeps status visually hidden and respects reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Open agent widget" }).click();
  await page.getByRole("button", { name: "Start a chat" }).click();
  const frame = page.frameLocator("iframe");
  await expect(frame.locator(".agent-description")).toContainText("Nordhaus");
  await expect(frame.locator(".chat-state")).toContainText(
    /Ready|responding/i,
    { timeout: 30000 },
  );
  const sizes = await frame.locator(".conversation-header").evaluate((el) => {
    const status = el.querySelector(".chat-state")!;
    const description = el.querySelector(".agent-description")!;
    const avatar = el.querySelector(".agent-avatar")!;
    return {
      statusWidth: status.getBoundingClientRect().width,
      descriptionWidth: description.getBoundingClientRect().width,
      ringWidth: avatar.getBoundingClientRect().width,
      overflow: document.body.scrollWidth > innerWidth,
      animation: getComputedStyle(el.querySelector(".agent-avatar-signal")!)
        .animationName,
    };
  });
  expect(sizes.statusWidth).toBeLessThanOrEqual(1);
  expect(sizes.descriptionWidth).toBeGreaterThan(200);
  expect(sizes.ringWidth).toBe(48);
  expect(sizes.overflow).toBe(false);
  expect(sizes.animation).toBe("none");
  await page.screenshot({ path: "artifacts/avatar-status/mobile-header.png" });
});
