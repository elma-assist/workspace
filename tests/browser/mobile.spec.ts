import { test, expect, devices, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const password = readFileSync("infra/local/runtime.env", "utf8").match(
  /^SEED_PASSWORD=(.+)$/m,
)![1];
const sizes = [
  {
    name: "small-android",
    browserName: "chromium" as const,
    viewport: { width: 320, height: 640 },
  },
  {
    name: "android",
    browserName: "chromium" as const,
    viewport: { width: 360, height: 740 },
  },
  {
    name: "iphone",
    browserName: "webkit" as const,
    viewport: { width: 390, height: 844 },
  },
  {
    name: "tablet",
    browserName: "webkit" as const,
    viewport: { width: 768, height: 1024 },
  },
];
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const clipped = await page
    .locator(".mantine-Button-label")
    .evaluateAll((nodes) =>
      nodes
        .filter(
          (e) =>
            e.getBoundingClientRect().width > 0 &&
            e.scrollWidth > e.clientWidth + 1,
        )
        .map((e) => e.textContent),
    );
  expect(clipped).toEqual([]);
}
async function navigate(page: Page, name: string) {
  const burger = page.getByRole("button", { name: "Toggle navigation" });
  if (await burger.isVisible()) await burger.click();
  await page.getByRole("link", { name, exact: true }).click();
}
for (const size of sizes) {
  test.describe(size.name, () => {
    test.use({
      viewport: size.viewport,
      isMobile: true,
      hasTouch: true,
    });
    test("landing, workspace, dialogs and table actions fit a touch screen", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page.locator(".login svg use")).toHaveAttribute(
        "href",
        "/icons.svg#arrow-up-right",
      );
      expect((await page.request.get("/icons.svg")).status()).toBe(200);
      await fits(page);
      if (size.viewport.width < 650) {
        const card = (await page.locator(".workflow").boundingBox())!;
        const caption = (await page
          .locator(".workflow-caption")
          .boundingBox())!;
        expect(card.y + card.height).toBeLessThan(caption.y);
        for (let step = 0; step < 4; step++) {
          await page.locator(`[data-step-button="${step}"]`).click();
          await expect(page.locator(".workflow")).toHaveAttribute(
            "data-step",
            String(step),
          );
          const clipped = await page
            .locator(".scene.is-active")
            .evaluate((el) => el.scrollHeight > el.clientHeight + 1);
          expect(clipped).toBe(false);
          await fits(page);
        }
      }
      await page.getByRole("button", { name: "Open agent widget" }).click();
      const panel = page.locator(".elma-panel");
      await expect(panel.locator('button[data-mode="text"] svg')).toBeVisible();
      const rect = (await panel.boundingBox())!;
      expect(rect.x).toBeGreaterThanOrEqual(7);
      expect(rect.x + rect.width).toBeLessThanOrEqual(size.viewport.width - 7);
      await page.screenshot({
        path: `artifacts/mobile/${size.name}-widget.png`,
      });
      await page.setViewportSize({ width: size.viewport.height, height: 320 });
      await panel
        .getByRole("button", { name: "Start a voice conversation" })
        .scrollIntoViewIfNeeded();
      await expect(
        panel.getByRole("button", { name: "Start a voice conversation" }),
      ).toBeInViewport();
      await panel.getByRole("button", { name: "Close", exact: true }).click();
      await page.setViewportSize(size.viewport);
      await page.context().request.post("/api/auth/login", {
        data: { email: "admin@example.com", password },
      });
      await page.goto("/app");
      await page
        .getByRole("button", { name: "Open Nordhaus", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Edit agent", exact: true })
        .click();
      const editor = page.getByRole("main");
      await expect(editor.getByLabel("Agent name")).toHaveValue("Emma");
      await editor
        .getByLabel("Agent name")
        .fill("A deliberately long agent name for a narrow mobile screen");
      await editor
        .getByRole("button", { name: "Save agent", exact: true })
        .scrollIntoViewIfNeeded();
      await fits(page);
      await expect(
        editor.getByRole("button", { name: "Save agent", exact: true }),
      ).toBeInViewport();
      await page
        .getByLabel("Breadcrumbs")
        .getByRole("link", { name: "Agents", exact: true })
        .click();
      await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();
      await fits(page);
      await page.screenshot({
        path: `artifacts/mobile/${size.name}-agents.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Publish agent", exact: true })
        .click();
      await expect(
        page.getByRole("main").getByLabel("Allowed website origins"),
      ).toBeVisible();
      await fits(page);
      await page
        .getByLabel("Breadcrumbs")
        .getByRole("link", { name: "Agents", exact: true })
        .click();
      await navigate(page, "Knowledge");
      await page
        .getByRole("button", { name: "Open Resident handbook" })
        .click();
      const download = page.getByRole("button", { name: /^Download / }).first();
      await download.scrollIntoViewIfNeeded();
      await expect(download).toBeInViewport();
      await fits(page);
      await page
        .getByRole("button", { name: "Add document", exact: true })
        .click();
      await expect(
        page.getByRole("main").getByLabel("Choose a text document"),
      ).toBeVisible();
      await page
        .getByRole("main")
        .getByRole("button", { name: "Add & index document" })
        .scrollIntoViewIfNeeded();
      await fits(page);
      await page
        .getByLabel("Breadcrumbs")
        .getByRole("link", { name: "Knowledge", exact: true })
        .click();
      await navigate(page, "Employees");
      await expect(
        page.getByText("admin@example.com", { exact: true }),
      ).toBeVisible();
      await fits(page);
      await page.getByRole("button", { name: "Invite teammate" }).click();
      await expect(page.getByRole("main").getByLabel(/^Email/)).toBeVisible();
      await fits(page);
      await page
        .getByLabel("Breadcrumbs")
        .getByRole("link", { name: "Employees", exact: true })
        .click();
      await navigate(page, "Usage");
      await expect(page.locator(".stats")).toBeVisible();
      await fits(page);
      await page.screenshot({
        path: `artifacts/mobile/${size.name}-usage.png`,
        fullPage: true,
      });
      await navigate(page, "Conversations");
      await fits(page);
      await navigate(page, "Settings");
      await fits(page);
      await page.setViewportSize({ width: 740, height: 320 });
      await navigate(page, "Settings");
      await expect(
        page.getByRole("heading", { name: "Organization settings" }),
      ).toBeVisible();
      await fits(page);
      await page.setViewportSize(size.viewport);
      await page
        .getByRole("link", { name: "My organizations", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "My organizations", exact: true }),
      ).toBeVisible();
      await fits(page);
    });
    if (size.name === "small-android" || size.name === "iphone") {
      test("embedded chat works after viewport shrinks and orientation changes", async ({
        page,
      }) => {
        await page.goto("/");
        await page.getByRole("button", { name: "Open agent widget" }).click();
        await page
          .getByRole("button", { name: "Start a chat", exact: true })
          .click();
        const frame = page.frameLocator("iframe");
        await expect(frame.locator(".chat-state")).toContainText(
          /Ready for your message|Agent is responding/,
          { timeout: 30000 },
        );
        await page.setViewportSize({ width: size.viewport.width, height: 420 });
        const input = frame.getByRole("textbox", {
          name: "Message",
          exact: true,
        });
        await input.fill("When is the next resident meeting?");
        await expect(input).toBeInViewport();
        await frame
          .getByRole("textbox", { name: "Message", exact: true })
          .press("Enter");
        await expect(frame.locator(".message.assistant").last()).toContainText(
          /18:30|6:30/,
          { timeout: 45000 },
        );
        await expect(frame.locator(".chat-state")).toContainText(
          "Ready for your message",
        );
        expect(
          await frame
            .locator("html")
            .evaluate((e) => e.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.screenshot({
          path: `artifacts/mobile/${size.name}-chat-short.png`,
        });
        await page.setViewportSize({ width: 740, height: 360 });
        await expect(input).toBeInViewport();
        await expect(
          frame.getByRole("button", { name: "Close conversation" }),
        ).toBeInViewport();
        await frame.getByRole("button", { name: "Close conversation" }).click();
        await expect(page.locator("iframe")).toHaveCount(0);
      });
    }
  });
}
