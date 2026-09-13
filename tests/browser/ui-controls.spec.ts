import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const password = readFileSync("infra/local/runtime.env", "utf8").match(
  /^SEED_PASSWORD=(.+)$/m,
)![1];
test("organization navigation, routed editors, document actions and responsive layout", async ({
  page,
}) => {
  await page.context().request.post("http://localhost:8180/api/auth/login", {
    data: { email: "admin@example.com", password },
  });
  await page.goto("/app");
  await expect(
    page.getByRole("heading", { name: "My organizations" }),
  ).toBeVisible();
  await expect(page.getByLabel("Breadcrumbs")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open Nordhaus", exact: true })
    .click();
  const breadcrumbChildren = page
    .getByLabel("Breadcrumbs")
    .locator(":scope > *");
  await expect(breadcrumbChildren.last()).toHaveText("Agents");
  await expect(breadcrumbChildren.last().locator("svg")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Organization", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Edit agent", exact: true }).click();
  await expect(page.getByLabel("Agent name")).toHaveValue("Emma");
  await expect(page.getByLabel("Breadcrumbs")).toContainText("Edit agent");
  const breadcrumbTypography = await page
    .getByLabel("Breadcrumbs")
    .locator(":scope > *")
    .evaluateAll((items) =>
      items.map((item) => {
        const style = getComputedStyle(item);
        return [
          style.fontFamily,
          style.fontSize,
          style.fontWeight,
          style.lineHeight,
        ];
      }),
    );
  expect(
    new Set(breadcrumbTypography.map((style) => style.join("|"))).size,
  ).toBe(1);
  await page
    .getByLabel("Breadcrumbs")
    .getByRole("link", { name: "Agents", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();
  await page.getByRole("link", { name: "Knowledge", exact: true }).click();
  await page.getByRole("button", { name: "Open Resident handbook" }).click();
  const download = page.getByRole("button", { name: /^Download / }).first();
  await expect(download).toBeVisible();
  await expect(download).toHaveText("");
  await download.hover();
  await expect(page.getByRole("tooltip")).toContainText("Download document");
  await page.screenshot({
    path: "artifacts/knowledge-mantine.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "My organizations", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "My organizations" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open Nordhaus", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Employees", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Employees", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/mobile-mantine.png",
    fullPage: true,
  });
});

test("conversation history renders Markdown with the shared renderer", async ({
  page,
}) => {
  await page.context().request.post("http://localhost:8180/api/auth/login", {
    data: { email: "admin@example.com", password },
  });
  await page.route("**/api/organizations/*/conversations", (route) =>
    route.fulfill({
      json: [
        {
          id: "formatting-test",
          title: "Formatting check",
          status: "completed",
          agent_name: "Emma",
          user_name: "Test",
        },
      ],
    }),
  );
  await page.route(
    "**/api/organizations/*/conversations/formatting-test",
    (route) =>
      route.fulfill({
        json: {
          id: "formatting-test",
          title: "Formatting check",
          sources: [],
          messages: [
            {
              id: "one",
              role: "assistant",
              content:
                "## Summary\n\n**Confirmed**\n\n- First\n- Second\n\n| Time | Place |\n| --- | --- |\n| 18:30 | Berlin |\n\n```js\nconst ready = true;\n```",
            },
          ],
        },
      }),
  );
  await page.goto("/app/nordhaus/agents");
  await page.getByRole("link", { name: "Conversations", exact: true }).click();
  await page.getByRole("button", { name: /Formatting check/ }).click();
  await expect(page.locator(".history-detail h2")).toHaveText("Summary");
  await expect(page.locator(".history-detail strong")).toHaveText("Confirmed");
  await expect(page.locator(".history-detail li")).toHaveCount(2);
  await expect(page.locator(".history-detail table")).toContainText("Berlin");
  await expect(page.locator(".history-detail pre")).toContainText(
    "const ready",
  );
});

test("object cards open their detail pages without view buttons", async ({
  page,
}) => {
  await page.context().request.post("http://localhost:8180/api/auth/login", {
    data: { email: "admin@example.com", password },
  });
  await page.goto("/app/nordhaus/requests");
  await expect(page.getByText("View request", { exact: true })).toHaveCount(0);
  const request = page.getByRole("button", { name: /^Open request / }).first();
  await expect(request).toBeVisible();
  await request.click();
  await expect(
    page.getByRole("combobox", { name: "Request status" }),
  ).toBeVisible();
  await expect(page.getByLabel("Breadcrumbs")).toContainText("Request details");

  await page.getByRole("link", { name: "Forms", exact: true }).click();
  await expect(page.getByText("Edit form", { exact: true })).toHaveCount(0);
  const form = page.getByRole("button", { name: /^Edit / }).first();
  await expect(form).toBeVisible();
  await form.click();
  await expect(page.getByRole("heading", { name: "Edit form" })).toBeVisible();
});
