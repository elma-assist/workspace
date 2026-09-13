import { test, expect } from "@playwright/test";

test("new customer creates organizations, knowledge and a configured agent", async ({
  page,
}) => {
  await page.goto("/app");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByLabel("Full name").fill("Pilot Test");
  await page
    .getByLabel("Email address")
    .fill(`pilot-${Date.now()}@example.com`);
  await page.getByLabel(/^Password/).fill("pilot-test-password");
  await page
    .getByRole("button", { name: /Create account/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Create organization", exact: true })
    .click();
  await page.getByLabel("Organization name").fill("Pilot workspace");
  await page
    .getByRole("button", { name: "Create organization", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Agents", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Knowledge", exact: true }).click();
  await page.getByRole("button", { name: "New knowledge base" }).click();
  await page.getByLabel("Name").fill("Pilot manual");
  await page
    .getByRole("button", { name: "Create knowledge base", exact: true })
    .click();
  await page.getByRole("button", { name: /Pilot manual/ }).click();
  await page.getByRole("button", { name: "Add document" }).click();
  await page.getByLabel("Document title").fill("Operations.txt");
  await page
    .getByLabel("Or paste text")
    .fill(
      "The internal project code is ORCHID. Support hours are 10:00 to 16:00.",
    );
  await page.getByRole("button", { name: "Add & index document" }).click();
  await expect(
    page.locator(".document-row").filter({ hasText: "Operations.txt" }),
  ).toContainText("ready", { timeout: 30000 });
  await page.getByRole("link", { name: "Agents", exact: true }).first().click();
  await page.getByRole("button", { name: "Create agent", exact: true }).click();
  await page.getByLabel("Agent name").fill("Robin");
  await page
    .getByLabel("Role & instructions")
    .fill("You help our team with operations. Use our knowledge base.");
  await page.getByRole("checkbox", { name: /Pilot manual/ }).check();
  await page.getByRole("button", { name: "Save agent" }).click();
  await expect(
    page.getByRole("heading", { name: "Robin", exact: true }),
  ).toBeVisible();
  const firstUrl = page.url();
  await page
    .getByRole("link", { name: "My organizations", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create organization", exact: true })
    .click();
  await page.getByLabel("Organization name").fill("Second workspace");
  await page
    .getByRole("button", { name: "Create organization", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Robin", exact: true }),
  ).toHaveCount(0);
  await page.goto(firstUrl);
  await expect(
    page.getByRole("heading", { name: "Robin", exact: true }),
  ).toBeVisible();
});
